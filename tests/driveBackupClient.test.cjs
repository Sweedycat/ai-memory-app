const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { TextEncoder } = require('node:util');

function load(relative, deps = {}) {
  const raw = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  const js = ts.transpileModule(raw, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = {
    module: { exports: {} }, TextEncoder,
    require(id) {
      if (!(id in deps)) throw Error('Unexpected dependency ' + id);
      return deps[id];
    },
  };
  context.exports = context.module.exports;
  vm.runInNewContext(js, context);
  return context.module.exports;
}

const normalize = load('src/utils/normalizeStoredPeople.ts');
const snapshot = load('src/utils/backupSnapshot.ts', { './normalizeStoredPeople': normalize });
const envelopeModule = load('src/utils/encryptedBackupEnvelope.ts', { './backupSnapshot': snapshot });
const protocol = load('src/utils/driveBackupProtocol.ts', {
  './encryptedBackupEnvelope': envelopeModule,
});
const client = load('src/utils/driveBackupClient.ts', {
  './driveBackupProtocol': protocol,
  './encryptedBackupEnvelope': envelopeModule,
});

const envelope = () => ({
  kind: envelopeModule.ENCRYPTED_BACKUP_KIND,
  version: 1,
  algorithm: 'AES-256-GCM',
  encryptedPayload: 'A'.repeat(48),
});
const access = 'ya29.synthetic_OAuthTokenOnly_NotReal123';
const id = 'fakeBACKUP_id_123456';

function fakeResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get() { return null; } },
    async text() { return typeof payload === 'string' ? payload : JSON.stringify(payload); },
  };
}

test('encrypted upload is explicitly consent gated and sends ciphertext only to Google', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return fakeResponse({ id });
  };
  const base = {
    encryptedEnvelope: envelope(), backupTimeUtc: '2026-11-12T09:00:00Z',
    multipartBoundary: 'AI_MEMORY_BOUNDARY_1234567890',
    googleAccessToken: access, fetcher,
  };
  await assert.rejects(
    client.uploadEncryptedBackupToDrive({ ...base, userConfirmed: false }),
    /explicitly confirm/,
  );
  assert.equal(calls.length, 0);
  assert.equal(await client.uploadEncryptedBackupToDrive({ ...base, userConfirmed: true }), id);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.startsWith('https://www.googleapis.com/upload/drive/v3/files'));
  assert.equal(calls[0].init.headers.Authorization, 'Bearer ' + access);
  assert.equal(calls[0].init.headers['Content-Length'], undefined);
  assert.ok(calls[0].init.body.includes('"parents":["appDataFolder"]'));
  assert.ok(calls[0].init.body.includes('"algorithm":"AES-256-GCM"'));
  assert.ok(!calls[0].init.body.includes(access));
  assert.ok(!calls[0].init.body.includes('recoveryKey'));
});

test('rejects invalid OAuth tokens, malformed ciphertext, and errors without leaking account data', async () => {
  const req = {
    encryptedEnvelope: envelope(), backupTimeUtc: '2026-11-12T09:00:00Z',
    multipartBoundary: 'AI_MEMORY_BOUNDARY_1234567890', userConfirmed: true,
  };
  let sent = 0;
  const fetcher = async () => { sent++; return fakeResponse({ error: 'secret!' }, 403); };
  await assert.rejects(
    client.uploadEncryptedBackupToDrive({ ...req, googleAccessToken: 'foo\r\nX-evil: 1', fetcher }),
    /authorization/,
  );
  assert.equal(sent, 0);
  await assert.rejects(
    client.uploadEncryptedBackupToDrive({
      ...req, encryptedEnvelope: { ...envelope(), encryptedPayload: 'secret note' },
      googleAccessToken: access, fetcher,
    }),
    /invalid or unsupported/,
  );
  assert.equal(sent, 0);
  await assert.rejects(
    client.uploadEncryptedBackupToDrive({ ...req, googleAccessToken: access, fetcher }),
    /authorization expired or access denied/,
  );
  assert.equal(sent, 1);
});

test('Drive list only returns valid encrypted backup metadata', async () => {
  const files = [
    { id, name: 'ai-memory-encrypted-v1-20261112T090000000Z.json',
      createdTime: '2026-11-12T09:00:00.000Z', mimeType: 'application/json', size: '560' },
    { id: 'fakePERSONAL_id123456', name: 'sensitive-notes.txt',
      createdTime: '2026-11-12T09:00:00.000Z', mimeType: 'text/plain', size: '10' },
  ];
  const result = await client.listEncryptedBackupsFromDrive({
    googleAccessToken: access,
    fetcher: async (url, init) => {
      assert.ok(url.includes('spaces=appDataFolder'));
      assert.ok(!url.includes('spaces=drive&'));
      assert.equal(init.method, 'GET');
      return fakeResponse({ nextPageToken: 'page_2', files });
    },
  });
  assert.equal(result.backups.length, 1);
  assert.equal(result.backups[0].id, id);
  assert.equal(result.backups[0].sizeBytes, 560);
  assert.equal(result.nextPageToken, 'page_2');
});

test('download only accepts authenticated envelope shape, never a plaintext file', async () => {
  const success = await client.downloadEncryptedBackupFromDrive({
    backupId: id, googleAccessToken: access,
    fetcher: async (url) => {
      assert.ok(url.endsWith('/' + id + '?alt=media'));
      return fakeResponse(envelope());
    },
  });
  assert.equal(success.encryptedPayload, 'A'.repeat(48));
  await assert.rejects(client.downloadEncryptedBackupFromDrive({
    backupId: id, googleAccessToken: access,
    fetcher: async () => fakeResponse({ people: [{ name: 'PRIVATE' }] }),
  }), /invalid or unsupported/);
  await assert.rejects(client.downloadEncryptedBackupFromDrive({
    backupId: id, googleAccessToken: access,
    fetcher: async () => fakeResponse('z'.repeat(48_000_600)),
  }), /exceeds the safe size/);
});

test('review helper returns a plan and cannot persist, overwrite or reschedule', async () => {
  const result = await client.reviewDriveBackupWithoutRestoring({
    encryptedEnvelope: envelope(), existingPeople: [],
    cipher: {
      async decryptCombinedBase64ToUtf8() {
        return JSON.stringify({
          kind: snapshot.BACKUP_SNAPSHOT_KIND, version: 1,
          createdAt: '2026-11-12T09:00:00.000Z',
          owner: { name: 'Synthetic Tester', preferredName: '', role: '' },
          people: [],
        });
      },
    },
  });
  assert.equal(result.status, 'review-required');
  assert.equal(result.incomingPeople, 0);
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/utils/driveBackupClient.ts'), 'utf8');
  const executable = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executable, /AsyncStorage|setItem\(|SecureStore|scheduleNotification|console\./);
});
