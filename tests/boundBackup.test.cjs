const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(file, dependencies = {}) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { TextEncoder, module: { exports: {} }, require(id) {
    if (!(id in dependencies)) throw Error('Unexpected dependency: ' + id);
    return dependencies[id];
  } };
  context.exports = context.module.exports;
  vm.runInNewContext(js, context);
  return context.module.exports;
}
const normalizer = load('src/utils/normalizeStoredPeople.ts');
const snapshot = load('src/utils/backupSnapshot.ts', { './normalizeStoredPeople': normalizer });
const envelope = load('src/utils/encryptedBackupEnvelope.ts', { './backupSnapshot': snapshot });
const bound = load('src/utils/boundBackup.ts', {
  './backupSnapshot': snapshot,
  './encryptedBackupEnvelope': envelope,
});

function cipher(key) {
  return {
    async encryptUtf8ToCombinedBase64(s) {
      const nonce = crypto.randomBytes(12);
      const enc = crypto.createCipheriv('aes-256-gcm', key, nonce);
      const body = Buffer.concat([enc.update(s, 'utf8'), enc.final()]);
      return Buffer.concat([nonce, body, enc.getAuthTag()]).toString('base64');
    },
    async decryptCombinedBase64ToUtf8(s) {
      const b = Buffer.from(s, 'base64');
      const dec = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
      dec.setAuthTag(b.subarray(b.length - 16));
      return Buffer.concat([dec.update(b.subarray(12, -16)), dec.final()]).toString('utf8');
    },
  };
}
const identity = () => ({ ownerId: 'synthetic-owner', workspaceId: 'personal-synthetic' });
const person = () => ({
  id: 'synthetic-person', name: 'Örnek 🧠', relationship: 'QA',
  lastInteraction: '2026-11-12T00:00:00Z', notes: ['Synthetic only'],
  interactions: [],
});
const input = () => ({
  identity: identity(), owner: { name: 'Synthetic', preferredName: '', role: 'QA' },
  people: [person()], createdAt: '2026-11-12T00:00:00Z',
});

test('authenticated identity is private, roundtrips and never mutates source', async () => {
  const original = input();
  const before = JSON.stringify(original);
  const adapter = cipher(crypto.randomBytes(32));
  const encrypted = await bound.sealBoundBackupInMemory(original, adapter);
  const wire = JSON.stringify(encrypted);
  assert.ok(!wire.includes('synthetic-owner'));
  assert.ok(!wire.includes('personal-synthetic'));
  assert.ok(!wire.includes('Örnek'));
  const result = await bound.reviewBoundBackup(encrypted, [], identity(), adapter);
  assert.equal(result.authenticatedIdentity.ownerId, identity().ownerId);
  assert.equal(result.review.incomingPeople, 1);
  assert.equal(result.review.candidatePeople[0].name, 'Örnek 🧠');
  assert.equal(JSON.stringify(original), before);
});

test('other owner or workspace rejected even with correct recovery key', async () => {
  const adapter = cipher(crypto.randomBytes(32));
  const encrypted = await bound.sealBoundBackupInMemory(input(), adapter);
  await assert.rejects(bound.reviewBoundBackup(encrypted, [], {
    ...identity(), ownerId: 'other-owner',
  }, adapter), /mismatch/);
  await assert.rejects(bound.reviewBoundBackup(encrypted, [], {
    ...identity(), workspaceId: 'other-workspace',
  }, adapter), /mismatch/);
});

test('wrong key, tampering and legacy v1 payload fail closed', async () => {
  const key = crypto.randomBytes(32);
  const adapter = cipher(key);
  const encrypted = await bound.sealBoundBackupInMemory(input(), adapter);
  await assert.rejects(bound.reviewBoundBackup(
    encrypted, [], identity(), cipher(crypto.randomBytes(32)),
  ), /Cannot authenticate/);
  const altered = Buffer.from(encrypted.encryptedPayload, 'base64');
  altered[20] ^= 1;
  await assert.rejects(bound.reviewBoundBackup({
    ...encrypted, encryptedPayload: altered.toString('base64'),
  }, [], identity(), adapter), /Cannot authenticate/);
  const legacy = await envelope.sealBackupInMemory(input(), adapter);
  await assert.rejects(bound.reviewBoundBackup(legacy, [], identity(), adapter), /unsupported/);
});

test('invalid identity rejected before encryption', async () => {
  await assert.rejects(bound.sealBoundBackupInMemory({
    ...input(), identity: { ownerId: '../invalid', workspaceId: 'personal' },
  }, cipher(crypto.randomBytes(32))), /invalid/);
});

test('bound backup has no network, file or storage effects', () => {
  const src = fs.readFileSync(path.join(root, 'src/utils/boundBackup.ts'), 'utf8');
  assert.doesNotMatch(src, /AsyncStorage|fetch\s*\(|setItem|removeItem|Share\.share|console\./);
});

test('oversized authenticated wrapper is rejected before decryption', async () => {
  let decryptCalled = false;
  const fakeCipher = {
    async decryptCombinedBase64ToUtf8() {
      decryptCalled = true;
      return 'x'.repeat(snapshot.MAX_SNAPSHOT_CHARACTERS + 1025);
    },
  };
  const envelopeValue = {
    kind: envelope.ENCRYPTED_BACKUP_KIND, version: 1,
    algorithm: 'AES-256-GCM', encryptedPayload: 'A'.repeat(40),
  };
  await assert.rejects(
    bound.reviewBoundBackup(envelopeValue, [], identity(), fakeCipher),
    /too large/,
  );
  assert.equal(decryptCalled, true);
});

test('UTF-8 byte budget rejects oversized multibyte archive before encryption', async () => {
  const original = input();
  // 5.7m UTF-16 characters, but over 16 MiB encoded UTF-8.
  original.people[0].notes = ['漢'.repeat(5_700_000)];
  let encryptCalled = false;
  const fakeCipher = {
    async encryptUtf8ToCombinedBase64() {
      encryptCalled = true;
      throw Error('Encryption should not run');
    },
  };
  await assert.rejects(
    bound.sealBoundBackupInMemory(original, fakeCipher),
    /UTF-8 byte budget/,
  );
  assert.equal(encryptCalled, false);
});

test('decrypted multibyte archive over byte budget fails before parsing', async () => {
  const fakeCipher = {
    async decryptCombinedBase64ToUtf8() {
      return '漢'.repeat(5_700_000);
    },
  };
  await assert.rejects(bound.reviewBoundBackup({
    kind: envelope.ENCRYPTED_BACKUP_KIND,
    version: 1,
    algorithm: 'AES-256-GCM',
    encryptedPayload: 'A'.repeat(40),
  }, [], identity(), fakeCipher), /UTF-8 byte budget/);
});

test('missing TextEncoder refuses backup instead of bypassing byte check', async () => {
  const src = fs.readFileSync(path.join(root, 'src/utils/boundBackup.ts'), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = {
    module: { exports: {} },
    TextEncoder: undefined,
    require(id) {
      if (id === './backupSnapshot') return snapshot;
      if (id === './encryptedBackupEnvelope') return envelope;
      throw Error('Unexpected dependency: ' + id);
    },
  };
  context.exports = context.module.exports;
  vm.runInNewContext(js, context);
  let encrypted = false;
  await assert.rejects(context.module.exports.sealBoundBackupInMemory(input(), {
    async encryptUtf8ToCombinedBase64() {
      encrypted = true;
      return 'A'.repeat(40);
    },
  }), /UTF-8 size validation unavailable/);
  assert.equal(encrypted, false);
});

test('UTF-8 chunks preserve surrogate pairs across chunk boundaries', async () => {
  const original = input();
  // The emoji straddles the nominal 16,384-code-unit chunk boundary.
  original.people[0].notes = ['a'.repeat(16_383) + '🧠' + 'z'];
  const adapter = cipher(crypto.randomBytes(32));
  const encrypted = await bound.sealBoundBackupInMemory(original, adapter);
  const restored = await bound.reviewBoundBackup(encrypted, [], identity(), adapter);
  assert.equal(restored.review.candidatePeople[0].notes[0], original.people[0].notes[0]);
});
