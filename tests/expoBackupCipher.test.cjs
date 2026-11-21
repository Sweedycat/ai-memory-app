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
  const context = { module: { exports: {} }, TextEncoder, TextDecoder, Uint8Array, atob,
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
      if (options.additionalData) c.setAAD(Buffer.from(options.additionalData));
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
      assert.equal(options.output, 'base64');
      const payload = sealed.payload;
      const nonce = payload.subarray(0, 12);
      const tag = payload.subarray(payload.length - 16);
      const data = payload.subarray(12, payload.length - 16);
      const d = crypto.createDecipheriv('aes-256-gcm', key.bytes, nonce);
      if (options.additionalData) d.setAAD(Buffer.from(options.additionalData));
      d.setAuthTag(tag);
      return Buffer.concat([d.update(data), d.final()]).toString('base64');
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
  const executable = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executable, /console\.|fetch\s*\(|AsyncStorage|SecureStore|Share\.share\(/);
});

test('local AAD authenticates every context field and never falls back to legacy decryption', async () => {
  const { localEncryptionContextAAD } = load('src/utils/localEncryptionContext.ts', {});
  const aad = localEncryptionContextAAD({ version: 1, schemaVersion: 1, domain: 'people',
    vaultId: '1'.repeat(32), keyId: '2'.repeat(32), generationId: '3'.repeat(32) });
  const key = await expoCipher.generateBackupRecoveryKey();
  const bound = await expoCipher.createExpoAesGcmCipher(key, aad);
  const text = 'Synthetic Türkçe 👩🏽‍💻 memory';
  const sealed = await bound.encryptUtf8ToCombinedBase64(text);
  assert.equal(await bound.decryptCombinedBase64ToUtf8(sealed), text);
  for (let i = 0; i < 7; i++) {
    const changed = JSON.parse(aad); changed[i] = typeof changed[i] === 'number' ? 2 : changed[i] + '-different';
    const other = await expoCipher.createExpoAesGcmCipher(key, JSON.stringify(changed));
    await assert.rejects(other.decryptCombinedBase64ToUtf8(sealed), /Backup decryption failed/);
  }
  const legacy = await expoCipher.createExpoAesGcmCipher(key);
  await assert.rejects(legacy.decryptCombinedBase64ToUtf8(sealed), /Backup decryption failed/);
  await assert.rejects(bound.decryptCombinedBase64ToUtf8(await legacy.encryptUtf8ToCombinedBase64(text)), /Backup decryption failed/);
  const wrongKey = await expoCipher.createExpoAesGcmCipher(await expoCipher.generateBackupRecoveryKey(), aad);
  await assert.rejects(wrongKey.decryptCombinedBase64ToUtf8(sealed), /Backup decryption failed/);
  const bytes = Buffer.from(sealed, 'base64'); bytes[15] ^= 1;
  await assert.rejects(bound.decryptCombinedBase64ToUtf8(bytes.toString('base64')), /Backup decryption failed/);
  await assert.rejects(bound.decryptCombinedBase64ToUtf8(Buffer.from(sealed, 'base64').subarray(1).toString('base64')), /Backup decryption failed/);
  const again = await bound.encryptUtf8ToCombinedBase64(text);
  assert.notEqual(Buffer.from(sealed, 'base64').subarray(0, 12).toString('hex'), Buffer.from(again, 'base64').subarray(0, 12).toString('hex'));
});

test('AAD validates UTF8 bounds and copies native arguments without changing omitted options', async () => {
  const native = mockExpoCrypto(), encrypt = native.aesEncryptAsync, decrypt = native.aesDecryptAsync;
  const calls = [];
  native.aesEncryptAsync = async (...args) => {
    const options = args[2]; calls.push(options);
    const sealed = await encrypt(...args); options.additionalData?.fill(0); return sealed;
  };
  native.aesDecryptAsync = async (...args) => {
    const options = args[2]; calls.push(options);
    const text = await decrypt(...args); options.additionalData?.fill(0); return text;
  };
  const api = load('src/utils/expoBackupCipher.ts', { 'expo-crypto': native });
  const key = await api.generateBackupRecoveryKey();
  const bound = await api.createExpoAesGcmCipher(key, 'A'.repeat(4096));
  const sealed = await bound.encryptUtf8ToCombinedBase64('Synthetic');
  assert.equal(await bound.decryptCombinedBase64ToUtf8(sealed), 'Synthetic');
  assert.equal(await bound.decryptCombinedBase64ToUtf8(sealed), 'Synthetic');
  assert.notEqual(calls[0].additionalData, calls[1].additionalData);
  const legacy = await api.createExpoAesGcmCipher(key);
  await legacy.decryptCombinedBase64ToUtf8(await legacy.encryptUtf8ToCombinedBase64('Legacy'));
  assert.equal(Object.hasOwn(calls.at(-1), 'additionalData'), false);
  assert.equal(Object.hasOwn(calls.at(-2), 'additionalData'), false);
  for (const invalid of ['', 'a'.repeat(4097), '€'.repeat(1366), '\uD800', null, new Uint8Array(2)])
    await assert.rejects(api.createExpoAesGcmCipher(key, invalid), /Invalid encryption context/);
});
