const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const { TextEncoder, TextDecoder } = require('node:util');

const root = path.resolve(__dirname, '..');
function load(relative, modules) {
  const raw = fs.readFileSync(path.join(root, relative), 'utf8');
  const code = ts.transpileModule(raw, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { module: { exports: {} }, TextEncoder, TextDecoder,
    require(name) { if (modules[name]) return modules[name]; throw Error('Unexpected import: ' + name); } };
  context.exports = context.module.exports;
  vm.runInNewContext(code, context);
  return context.module.exports;
}

/**
 * Node.js AES-GCM simulation of documented Expo Crypto methods ONLY.
 * This is a contract test, not proof of real Android native functionality.
 */
function mockExpoCrypto() {
  return {
    AESEncryptionKey: {
      async generate(bits) {
        assert.equal(bits, 256);
        const key = crypto.randomBytes(32);
        return { async encoded(encoding) { assert.equal(encoding, 'hex'); return key.toString('hex'); } };
      },
      async import(hex, encoding) {
        assert.equal(encoding, 'hex');
        return { bytes: Buffer.from(hex, 'hex') };
      },
    },
    async aesEncryptAsync(bytes, key, options) {
      assert.equal(options.nonce.length, 12);
      assert.equal(options.tagLength, 16);
      const nonce = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', key.bytes, nonce);
      const encrypted = Buffer.concat([c.update(Buffer.from(bytes)), c.final()]);
      const payload = Buffer.concat([nonce, encrypted, c.getAuthTag()]);
      return { async combined(encoding) { assert.equal(encoding, 'base64'); return payload.toString('base64'); } };
    },
    AESSealedData: {
      fromCombined(payloadBase64, options) {
        assert.equal(options.ivLength, 12);
        assert.equal(options.tagLength, 16);
        return { payload: Buffer.from(payloadBase64, 'base64') };
      },
    },
    async aesDecryptAsync(sealed, key, options) {
      assert.equal(options.output, 'bytes');
      const payload = sealed.payload;
      const nonce = payload.subarray(0, 12);
      const tag = payload.subarray(payload.length - 16);
      const data = payload.subarray(12, payload.length - 16);
      const d = crypto.createDecipheriv('aes-256-gcm', key.bytes, nonce);
      d.setAuthTag(tag);
      return new Uint8Array(Buffer.concat([d.update(data), d.final()]));
    },
  };
}

const normalize = load('src/utils/normalizeStoredPeople.ts', {});
const snapshots = load('src/utils/backupSnapshot.ts', {
  './normalizeStoredPeople': normalize,
});
const envelope = load('src/utils/encryptedBackupEnvelope.ts', {
  './backupSnapshot': snapshots,
});
const expoCipher = load('src/utils/expoBackupCipher.ts', {
  'expo-crypto': mockExpoCrypto(),
});

const synthetic = {
  owner: { name: 'Demo', preferredName: 'Türkçe', role: 'test' },
  people: [{
    id: 'person-1', name: 'Şule 🧠', role: 'Tester', company: 'Sample',
    relationship: 'Local test', lastInteraction: 'Just now',
    notes: ['Önemli ve özel ✅'],
    interactions: [{ id: 'interaction-1', date: 'Just now', summary: 'Dün görüştük 📝', source: 'manual' }],
    followUpHistory: [],
  }],
  createdAt: '2026-11-04T10:00:00.000Z',
};

test('documented native adapter contract round-trips Turkish and emoji text with generated key', async () => {
  const key = await expoCipher.generateBackupRecoveryKey();
  assert.match(key, /^[0-9a-f]{64}$/);
  const adapter = await expoCipher.createExpoAesGcmCipher(key);
  const encrypted = await envelope.sealBackupInMemory(synthetic, adapter);
  const text = JSON.stringify(encrypted);
  assert.ok(!text.includes('Önemli ve özel'));
  assert.ok(!text.includes('Şule'));
  const review = await envelope.unsealBackupForReview(encrypted, [], adapter);
  assert.equal(review.status, 'review-required');
  assert.equal(review.candidatePeople[0].name, 'Şule 🧠');
  assert.equal(review.candidatePeople[0].notes[0], 'Önemli ve özel ✅');
  assert.equal(review.candidatePeople[0].interactions[0].summary, 'Dün görüştük 📝');
});

test('native adapter rejects user passwords and improperly shaped recovery keys', async () => {
  for (const key of ['', 'correct horse battery staple', 'a'.repeat(63), 'q'.repeat(64)]) {
    await assert.rejects(expoCipher.createExpoAesGcmCipher(key), /256-bit recovery key/);
  }
});

test('Expo AES adapter contract fails authentication with wrong 256-bit recovery key', async () => {
  const generated = await expoCipher.generateBackupRecoveryKey();
  const cipher = await expoCipher.createExpoAesGcmCipher(generated);
  const sealed = await envelope.sealBackupInMemory(synthetic, cipher);
  const other = await expoCipher.createExpoAesGcmCipher(await expoCipher.generateBackupRecoveryKey());
  await assert.rejects(
    envelope.unsealBackupForReview(sealed, [], other),
    /Cannot authenticate or decrypt this backup/,
  );
});

test('key and plaintext cannot be written to cloud or logs by native adapter', () => {
  const source = fs.readFileSync(path.join(root, 'src/utils/expoBackupCipher.ts'), 'utf8');
  assert.match(source, /AESEncryptionKey\.generate\(256\)/);
  assert.match(source, /AESSealedData\.fromCombined/);
  assert.doesNotMatch(source, /console\.|fetch\s*\(|AsyncStorage|SecureStore|Share\.share\(/);
});
