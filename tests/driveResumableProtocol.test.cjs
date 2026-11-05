const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/utils/driveResumableProtocol.ts'), 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = { module: { exports: {} }, URL };
context.exports = context.module.exports;
vm.runInNewContext(transpiled, context);
const d = context.module.exports;

const session = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=syntheticSession123';
const threeGiB = 3 * 1024 ** 3;

test('Google Drive initiation describes an encrypted file of 3 GiB without buffering it', () => {
  const start = d.createResumableBackupStart(threeGiB, '2026-11-05T10:00:00Z');
  assert.equal(start.method, 'POST');
  assert.ok(start.url.includes('uploadType=resumable'));
  assert.equal(start.headers['X-Upload-Content-Length'], String(threeGiB));
  assert.equal(start.headers['X-Upload-Content-Type'], 'application/octet-stream');
  const metadata = JSON.parse(start.body);
  assert.equal(metadata.parents[0], 'appDataFolder');
  assert.equal(metadata.mimeType, 'application/octet-stream');
  assert.ok(!start.body.includes('user name'));
  assert.ok(start.body.length < 500);
});

test('3 GiB file divides into independently readable 8 MiB ranges', () => {
  const first = d.createResumableBackupChunk(session, threeGiB, 0);
  assert.equal(first.method, 'PUT');
  assert.equal(first.fileOffset, 0);
  assert.equal(first.fileLength, 8 * 1024 * 1024);
  assert.equal(first.headers['Content-Range'], 'bytes 0-8388607/' + threeGiB);
  assert.equal(first.body, undefined, 'large file bytes must not be copied into descriptor');

  const mid = d.createResumableBackupChunk(session, threeGiB, 8 * 1024 * 1024);
  assert.equal(mid.headers['Content-Range'], 'bytes 8388608-16777215/' + threeGiB);
  const last = d.createResumableBackupChunk(session, threeGiB, threeGiB - 123);
  assert.equal(last.fileLength, 123);
  assert.equal(last.headers['Content-Range'], 'bytes ' + (threeGiB - 123) + '-' + (threeGiB - 1) + '/' + threeGiB);
});

test('final chunk is allowed to be non-256KiB while regular chunk size must be aligned', () => {
  const total = threeGiB + 123;
  assert.equal(d.createResumableBackupChunk(session, total, threeGiB).fileLength, 123);
  assert.throws(() => d.createResumableBackupChunk(session, total, 0, 20), /chunk size/);
  assert.throws(() => d.createResumableBackupChunk(session, total, 0, 500000), /chunk size/);
  assert.equal(d.createResumableBackupChunk(session, total, 0, 256 * 1024).fileLength, 256 * 1024);
});

test('interrupted upload can query Google rather than repeating an unknown chunk', () => {
  const query = d.createResumableBackupStatusQuery(session, threeGiB);
  assert.equal(query.method, 'PUT');
  assert.equal(query.headers['Content-Length'], '0');
  assert.equal(query.headers['Content-Range'], 'bytes */' + threeGiB);
  assert.equal(query.body, undefined);
});

test('HTTP 308 committed byte range controls restart offset, including partial chunks', () => {
  assert.equal(d.interpretResumableBackupReply(308, null, threeGiB).nextOffset, 0);
  const received = d.interpretResumableBackupReply(308, 'bytes=0-10000000', threeGiB);
  assert.equal(received.state, 'continue');
  assert.equal(received.nextOffset, 10000001);
  const chunk = d.createResumableBackupChunk(session, threeGiB, received.nextOffset);
  assert.equal(chunk.fileOffset, 10000001);
  assert.equal(chunk.headers['Content-Range'], 'bytes 10000001-18388608/' + threeGiB);
});

test('completion and expired session are explicit and never silently overwrite records', () => {
  assert.equal(d.interpretResumableBackupReply(200, null, threeGiB).state, 'complete');
  assert.equal(d.interpretResumableBackupReply(201, null, threeGiB).nextOffset, threeGiB);
  assert.equal(d.interpretResumableBackupReply(404, null, threeGiB).state, 'expired');
  assert.equal(d.interpretResumableBackupReply(410, null, threeGiB).state, 'expired');
  assert.equal(d.interpretResumableBackupReply(503, null, threeGiB).state, 'query-status');
  assert.equal(d.interpretResumableBackupReply(403, null, threeGiB).state, 'failed');
});

test('unsafe session URLs must not receive encrypted backup contents', () => {
  const bad = [
    'http://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test',
    'https://www.googleapis.com.evil.example/upload/drive/v3/files?uploadType=resumable&upload_id=test',
    'https://evil.example/upload/drive/v3/files?uploadType=resumable&upload_id=test',
    'https://www.googleapis.com@evil.example/upload/drive/v3/files?uploadType=resumable&upload_id=test',
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test&upload_id=two',
    'https://www.googleapis.com/upload/drive/v3/other?uploadType=resumable&upload_id=test',
    'https://user:pass@www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test',
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test#insecure',
    'ftp://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test',
  ];
  for (const uri of bad) {
    assert.throws(() => d.createResumableBackupChunk(uri, threeGiB, 0), /Untrusted|Invalid/);
  }
});

test('reject invalid byte lengths offsets and corrupted 308 acknowledgements', () => {
  for (const size of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => d.createResumableBackupStart(size, '2026-11-05T10:00:00Z'), /positive safe integer/);
  }
  for (const offset of [-1, 1.5, threeGiB, threeGiB + 1]) {
    assert.throws(() => d.createResumableBackupChunk(session, threeGiB, offset), /offset/);
  }
  for (const range of ['bytes=10-100', 'bytes=0--1', 'bytes=0-NaN',
    'bytes=0-' + threeGiB, 'bytes=0-999999999999999999', 'bytes=0-3,5-8']) {
    assert.throws(() => d.interpretResumableBackupReply(308, range, threeGiB), /range|acknowledgement/);
  }
});

test('pure transport builders cannot read files, upload, or access private data', () => {
  const executable = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executable, /fetch\s*\(|XMLHttpRequest|AsyncStorage|SecureStore|console\.|readFile|writeFile|Share\.share/);
});
