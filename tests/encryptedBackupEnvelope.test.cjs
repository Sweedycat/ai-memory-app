const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function loadUtility(relative, resolve) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { module: { exports: {} }, require: resolve };
  context.exports = context.module.exports;
  vm.runInNewContext(compiled, context);
  return context.module.exports;
}

const normalize = loadUtility('src/utils/normalizeStoredPeople.ts', () => {
  throw Error('Unexpected runtime dependency');
});
const snapshots = loadUtility('src/utils/backupSnapshot.ts', (id) => {
  if (id === './normalizeStoredPeople') return normalize;
  throw Error('Unexpected import ' + id);
});
const backup = loadUtility('src/utils/encryptedBackupEnvelope.ts', (id) => {
  if (id === './backupSnapshot') return snapshots;
  throw Error('Unexpected import ' + id);
});

/**
 * Test-only AES-256-GCM adapter using the audited Node.js crypto provider.
 * NOT a mobile implementation or installed app feature.
 */
function nodeTestAesGcmAdapter(key) {
  return {
    async encryptUtf8ToCombinedBase64(message) {
      const nonce = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
      const body = Buffer.concat([c.update(message, 'utf8'), c.final()]);
      return Buffer.concat([nonce, body, c.getAuthTag()]).toString('base64');
    },
    async decryptCombinedBase64ToUtf8(base64) {
      const packed = Buffer.from(base64, 'base64');
      if (packed.length < 29) throw Error('short GCM payload');
      const nonce = packed.subarray(0, 12);
      const tag = packed.subarray(packed.length - 16);
      const body = packed.subarray(12, packed.length - 16);
      const d = crypto.createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
      d.setAuthTag(tag);
      return Buffer.concat([d.update(body), d.final()]).toString('utf8');
    },
  };
}

const fakePerson = () => ({
  id: 'person-synthetic',
  name: 'Şifreli Örnek 🧠',
  role: 'Tester',
  company: 'Example only',
  relationship: 'not real',
  lastInteraction: '2026-11-04T10:00:00.000Z',
  notes: ['Ücretli servis yok', 'Synthetic note - do not upload'],
  followUp: {
    id: 'followup-1',
    text: 'Try again tomorrow',
    createdAt: '2026-11-04T10:00:00.000Z',
    reminderAt: '2026-11-05T10:00:00.000Z',
    notificationId: 'belongs-to-old-phone',
  },
  followUpHistory: [{
    id: 'followup-completed',
    text: 'Completed',
    createdAt: '2026-11-03T10:00:00.000Z',
    completedAt: '2026-11-04T10:00:00.000Z',
    notificationId: 'old-device-only',
  }],
  interactions: [{
    id: 'interaction-1',
    date: '2026-11-04T10:00:00.000Z',
    summary: 'Şifreli sesli konuşma testi',
    source: 'manual',
  }],
});

const owner = () => ({
  name: 'Demo Owner',
  preferredName: 'Test 22',
  role: 'Private beta tester',
});
const input = () => ({ owner: owner(), people: [fakePerson()], createdAt: '2026-11-04T11:00:00.000Z' });

test('AES-256-GCM encrypts a synthetic backup; envelope excludes plaintext personal notes', async () => {
  const key = crypto.randomBytes(32);
  const encrypted = await backup.sealBackupInMemory(input(), nodeTestAesGcmAdapter(key));
  assert.equal(encrypted.kind, backup.ENCRYPTED_BACKUP_KIND);
  assert.equal(encrypted.algorithm, 'AES-256-GCM');
  assert.equal(encrypted.version, 1);
  const serialized = JSON.stringify(encrypted);
  assert.ok(!serialized.includes('Şifreli Örnek'));
  assert.ok(!serialized.includes('Synthetic note'));
  assert.ok(!serialized.includes('Test 22'));
  const plan = await backup.unsealBackupForReview(
    encrypted, [fakePerson()], nodeTestAesGcmAdapter(key),
  );
  assert.equal(plan.status, 'review-required');
  assert.equal(plan.matchingPersonIds, 1);
  assert.equal(plan.candidateOwner.preferredName, 'Test 22');
  assert.equal(plan.candidatePeople[0].name, 'Şifreli Örnek 🧠');
  assert.equal(plan.candidatePeople[0].notes[0], 'Ücretli servis yok');
  assert.equal(plan.candidatePeople[0].followUp.notificationId, undefined);
  assert.equal(plan.candidatePeople[0].followUpHistory[0].notificationId, undefined);
  assert.equal(plan.requiresReminderRescheduling, true);
});

test('different random IVs ensure repeated backup encryptions yield different ciphertext', async () => {
  const key = crypto.randomBytes(32);
  const adapter = nodeTestAesGcmAdapter(key);
  const a = await backup.sealBackupInMemory(input(), adapter);
  const b = await backup.sealBackupInMemory(input(), adapter);
  assert.notEqual(a.encryptedPayload, b.encryptedPayload);
});

test('wrong recovery key fails authentication without touching existing people', async () => {
  const current = fakePerson();
  const before = JSON.stringify(current);
  const encrypted = await backup.sealBackupInMemory(input(), nodeTestAesGcmAdapter(crypto.randomBytes(32)));
  await assert.rejects(
    backup.unsealBackupForReview(encrypted, [current], nodeTestAesGcmAdapter(crypto.randomBytes(32))),
    /Cannot authenticate or decrypt this backup/,
  );
  assert.equal(JSON.stringify(current), before);
});

test('a modified byte of authenticated ciphertext is rejected', async () => {
  const key = crypto.randomBytes(32);
  const adapter = nodeTestAesGcmAdapter(key);
  const encrypted = await backup.sealBackupInMemory(input(), adapter);
  const payload = Buffer.from(encrypted.encryptedPayload, 'base64');
  payload[20] ^= 0x20;
  await assert.rejects(
    backup.unsealBackupForReview({ ...encrypted, encryptedPayload: payload.toString('base64') }, [fakePerson()], adapter),
    /Cannot authenticate or decrypt this backup/,
  );
});

test('invalid envelope and unsupported versions fail without invoking the decryption adapter', async () => {
  let called = false;
  const cipher = {
    decryptCombinedBase64ToUtf8: async () => { called = true; throw Error('should not run'); },
  };
  const current = [fakePerson()];
  for (const tampered of [
    null,
    { kind: 'wrong', version: 1, algorithm: 'AES-256-GCM', encryptedPayload: 'a'.repeat(40) },
    { kind: backup.ENCRYPTED_BACKUP_KIND, version: 2, algorithm: 'AES-256-GCM', encryptedPayload: 'a'.repeat(40) },
    { kind: backup.ENCRYPTED_BACKUP_KIND, version: 1, algorithm: 'none', encryptedPayload: 'a'.repeat(40) },
    { kind: backup.ENCRYPTED_BACKUP_KIND, version: 1, algorithm: 'AES-256-GCM', encryptedPayload: '{}' },
  ]) {
    await assert.rejects(
      backup.unsealBackupForReview(tampered, current, cipher),
      /Encrypted backup is invalid or unsupported/,
    );
  }
  assert.equal(called, false);
});

test('authenticated but incompatible backup payload cannot enter review', async () => {
  const key = crypto.randomBytes(32);
  const adapter = nodeTestAesGcmAdapter(key);
  const invalid = await adapter.encryptUtf8ToCombinedBase64(JSON.stringify({
    kind: 'wrong-backup-kind', version: 1, createdAt: '2026-11-04T11:00:00Z',
    owner: owner(), people: [fakePerson()],
  }));
  await assert.rejects(
    backup.unsealBackupForReview({
      kind: backup.ENCRYPTED_BACKUP_KIND, version: 1,
      algorithm: 'AES-256-GCM', encryptedPayload: invalid,
    }, [fakePerson()], adapter),
    /Backup version or format is unsupported/,
  );
});

test('no uploads, sharing or persistence are performed by the in-memory encryption module', () => {
  const src = fs.readFileSync(path.join(root, 'src/utils/encryptedBackupEnvelope.ts'), 'utf8');
  assert.doesNotMatch(src, /fetch\s*\(|XMLHttpRequest|AsyncStorage|SecureStore|Share\.share\s*\(/);
});
