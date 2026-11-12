const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { module: { exports: {} }, require(name) {
    if (!(name in modules)) throw Error('Unexpected import ' + name);
    return modules[name];
  }, URL, TextEncoder };
  context.exports = context.module.exports;
  vm.runInNewContext(code, context);
  return context.module.exports;
}

const envelopeLib = load('src/utils/encryptedBackupEnvelope.ts', {
  './backupSnapshot': {
    MAX_SNAPSHOT_CHARACTERS: 8_000_000,
    BACKUP_SNAPSHOT_VERSION: 1,
  },
});
const protocol = load('src/utils/driveBackupProtocol.ts', {
  './encryptedBackupEnvelope': envelopeLib,
});
const transport = load('src/utils/driveBackupTransport.ts', {
  './driveBackupProtocol': protocol,
  './encryptedBackupEnvelope': envelopeLib,
});
const token = 'test_valid_google_access_token_not_real';
const boundary = 'ABCDEF1234567890_ABCDEF1234567890';
const createdAt = '2026-11-12T10:10:10.000Z';
const fileName = 'ai-memory-encrypted-v1-20261112T101010000Z.json';
const id = 'GoogleFileID1234';
const envelope = {
  kind: 'ai-memory-aesgcm-backup',
  version: 1,
  algorithm: 'AES-256-GCM',
  encryptedPayload: 'A'.repeat(64),
};

function fetchReturn(obj, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get(k) { return headers[k] ?? null; } },
    async text() { return JSON.stringify(obj); },
  };
}

test('uploads only an encrypted envelope to isolated appDataFolder', async () => {
  let request;
  const sent = await transport.uploadSmallEncryptedBackup(
    { envelope, createdAt, accessToken: token, boundary },
    async (url, options) => {
      request = { url, options };
      return fetchReturn({ id, name: fileName }, 200);
    },
  );
  assert.equal(sent.id, id);
  assert.equal(request.options.redirect, 'error');
  assert.equal(request.options.headers.Authorization, 'Bearer ' + token);
  assert.ok(request.options.body.includes('"appDataFolder"'));
  assert.ok(request.options.body.includes('"encryptedPayload"'));
  assert.ok(!request.options.body.includes('real person'));
  assert.ok(request.url.startsWith('https://www.googleapis.com/upload/drive/v3/files'));
});

test('never uploads malformed or plaintext backup', async () => {
  let calls = 0;
  const fetchMock = async () => { calls++; return fetchReturn({}); };
  await assert.rejects(
    transport.uploadSmallEncryptedBackup({
      envelope: { ...envelope, encryptedPayload: 'real person note' },
      createdAt, accessToken: token, boundary,
    }, fetchMock),
  );
  assert.equal(calls, 0);
});

test('lists only valid encrypted v1 backup metadata', async () => {
  const result = await transport.listSmallEncryptedBackups(token, async () => fetchReturn({
    files: [
      { id, name: fileName, size: '1200', mimeType: 'application/json',
        createdTime: createdAt },
      { id: 'OtherFileID123', name: 'notes.txt', size: '50', mimeType: 'text/plain',
        createdTime: createdAt },
    ],
    nextPageToken: 'next-1',
  }));
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].name, fileName);
  assert.equal(result.nextPageToken, 'next-1');
});

test('downloads encrypted envelope only, without modifying local records', async () => {
  const result = await transport.downloadSmallEncryptedBackupForReview(token, id,
    async (url, options) => {
      assert.ok(url.endsWith('/' + id + '?alt=media'));
      assert.equal(options.method, 'GET');
      return fetchReturn(envelope);
    },
  );
  assert.equal(result.encryptedPayload, envelope.encryptedPayload);
});

test('401, offline, invalid token and oversized responses safely fail', async () => {
  await assert.rejects(
    transport.listSmallEncryptedBackups(token, async () => fetchReturn({}, 401)),
    /authorization/i,
  );
  await assert.rejects(
    transport.listSmallEncryptedBackups(token, async () => { throw Error('secret token details'); }),
    /connection failed/,
  );
  await assert.rejects(
    transport.listSmallEncryptedBackups('bad\\nBearer', async () => fetchReturn({ files: [] })),
    /authorization/i,
  );
  await assert.rejects(
    transport.downloadSmallEncryptedBackupForReview(token, id, async () =>
      fetchReturn(envelope, 200, { 'Content-Length': '999999999999' })),
    /too large/,
  );
});
