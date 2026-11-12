const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { TextEncoder } = require('node:util');

const root = path.resolve(__dirname, '..');
function load(relative, dependencies = {}) {
  const raw = fs.readFileSync(path.join(root, relative), 'utf8');
  const code = ts.transpileModule(raw, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = {
    TextEncoder,
    module: { exports: {} },
    require(name) {
      if (!(name in dependencies)) throw Error('Unknown module: ' + name);
      return dependencies[name];
    },
  };
  context.exports = context.module.exports;
  vm.runInNewContext(code, context);
  return context.module.exports;
}

const normalize = load('src/utils/normalizeStoredPeople.ts');
const snapshots = load('src/utils/backupSnapshot.ts', { './normalizeStoredPeople': normalize });
const encryption = load('src/utils/encryptedBackupEnvelope.ts', {
  './backupSnapshot': snapshots,
});
const drive = load('src/utils/driveBackupProtocol.ts', {
  './encryptedBackupEnvelope': encryption,
});

const envelope = () => ({
  kind: encryption.ENCRYPTED_BACKUP_KIND,
  version: encryption.ENCRYPTED_BACKUP_VERSION,
  algorithm: 'AES-256-GCM',
  encryptedPayload: 'A'.repeat(48),
});

test('Drive upload builder uses appDataFolder and contains encrypted content only', () => {
  const request = drive.createEncryptedAppDataUpload(
    envelope(), '2026-11-04T13:45:00.000Z', 'AI_MEMORY_BOUNDARY_1234567890',
  );
  assert.equal(request.method, 'POST');
  assert.equal(request.url, drive.DRIVE_UPLOAD_URL);
  assert.equal(request.headers['Content-Length'], String(new TextEncoder().encode(request.body).length));
  assert.ok(request.headers['Content-Type'].includes('multipart/related; boundary='));
  assert.ok(request.body.includes('"parents":["appDataFolder"]'));
  assert.ok(request.body.includes('ai-memory-encrypted-v1-20261104T134500000Z.json'));
  assert.ok(request.body.includes('"algorithm":"AES-256-GCM"'));
  assert.ok(!request.body.includes('private-memory'));
  assert.ok(!request.body.includes('recoveryKey'));
  assert.ok(!request.body.includes('Bearer'));
  assert.equal(drive.DRIVE_APPDATA_SCOPE, 'https://www.googleapis.com/auth/drive.appdata');
});

test('Drive upload builder rejects plaintext and malformed envelopes before construction', () => {
  assert.throws(() => drive.createEncryptedAppDataUpload({
    kind: encryption.ENCRYPTED_BACKUP_KIND, version: 1,
    algorithm: 'AES-256-GCM', encryptedPayload: 'private-memory',
  }, '2026-11-04T13:45:00Z', 'AI_MEMORY_BOUNDARY_1234567890'), /invalid|unsupported/);
  assert.throws(() => drive.createEncryptedAppDataUpload(
    { ...envelope(), algorithm: 'none' }, '2026-11-04T13:45:00Z',
    'AI_MEMORY_BOUNDARY_1234567890',
  ), /invalid|unsupported/);
});

test('Drive upload builder rejects invalid timestamps and unsafe multipart boundaries', () => {
  const goodBoundary = 'AI_MEMORY_BOUNDARY_1234567890';
  for (const date of ['Just now', '2026-11-04', '2026-11-04T13:45:00+03:00']) {
    assert.throws(() => drive.createEncryptedAppDataUpload(envelope(), date, goodBoundary), /ISO UTC/);
  }
  for (const boundary of ['', 'short', 'injection\r\nContent-Disposition: private', '../private-data']) {
    assert.throws(() => drive.createEncryptedAppDataUpload(envelope(), '2026-11-04T13:45:00Z', boundary), /boundary/);
  }
});

test('small multipart request never silently truncates or accepts oversized encrypted archives', () => {
  const bigEnvelope = { ...envelope(), encryptedPayload: 'A'.repeat(5_050_000) };
  assert.throws(
    () => drive.createEncryptedAppDataUpload(bigEnvelope, '2026-11-04T13:45:00Z', 'AI_MEMORY_BOUNDARY_1234567890'),
    /resumable upload/,
  );
});

test('Drive list is limited to appDataFolder and does not expose a broad Drive scope', () => {
  const r = drive.listEncryptedAppDataBackups();
  assert.equal(r.method, 'GET');
  assert.ok(r.url.includes('spaces=appDataFolder'));
  assert.ok(!r.url.includes('spaces=drive&'));
  const paged = drive.listEncryptedAppDataBackups('token+/= data');
  assert.ok(paged.url.includes('pageToken=token%2B%2F%3D%20data'));
  assert.throws(() => drive.listEncryptedAppDataBackups(''), /page token/);
});

test('Drive downloads refuse URL injection and never accept a freeform URL', () => {
  const safe = drive.getEncryptedAppDataBackup('abcDEFGhij_123-456');
  assert.equal(safe.method, 'GET');
  assert.ok(safe.url.endsWith('/abcDEFGhij_123-456?alt=media'));
  for (const bad of ['../../private', 'https://evil.example/api', 'short', 'file?alt=media&x=1']) {
    assert.throws(() => drive.getEncryptedAppDataBackup(bad), /Invalid backup file ID/);
  }
});

test('Google Drive transport helpers do not use network, storage, OAuth tokens or logs', () => {
  const file = fs.readFileSync(path.join(root, 'src/utils/driveBackupProtocol.ts'), 'utf8');
  const executable = file.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executable, /fetch\s*\(|XMLHttpRequest|AsyncStorage|SecureStore|console\./);
});
