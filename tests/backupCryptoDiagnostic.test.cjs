const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

function load(relative, deps = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = {
    module: { exports: {} },
    require(id) {
      if (!(id in deps)) throw Error('Unknown dependency ' + id);
      return deps[id];
    },
  };
  context.exports = context.module.exports;
  vm.runInNewContext(transpiled, context);
  return context.module.exports;
}

const normalize = load('src/utils/normalizeStoredPeople.ts');
const snapshot = load('src/utils/backupSnapshot.ts', { './normalizeStoredPeople': normalize });
const encrypt = load('src/utils/encryptedBackupEnvelope.ts', { './backupSnapshot': snapshot });

const generatedKeys = [];
const nativeAdapter = {
  async generateBackupRecoveryKey() {
    const k = crypto.randomBytes(32).toString('hex');
    generatedKeys.push(k);
    return k;
  },
  async createExpoAesGcmCipher(keyHex) {
    const key = Buffer.from(keyHex, 'hex');
    return {
      async encryptUtf8ToCombinedBase64(plaintext) {
        const nonce = crypto.randomBytes(12);
        const c = crypto.createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
        const ciphertext = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
        return Buffer.concat([nonce, ciphertext, c.getAuthTag()]).toString('base64');
      },
      async decryptCombinedBase64ToUtf8(blob) {
        const joined = Buffer.from(blob, 'base64');
        const d = crypto.createDecipheriv('aes-256-gcm', key, joined.subarray(0, 12), { authTagLength: 16 });
        d.setAuthTag(joined.subarray(-16));
        return Buffer.concat([d.update(joined.subarray(12, -16)), d.final()]).toString('utf8');
      },
    };
  },
};

const diagnostic = load('src/utils/backupCryptoDiagnostic.ts', {
  './encryptedBackupEnvelope': encrypt,
  './expoBackupCipher': nativeAdapter,
});

test('synthetic Android diagnostic checks decrypt and wrong-key rejection with no owner data', async () => {
  assert.equal(await diagnostic.runSyntheticBackupCryptoDiagnostic(), true);
  assert.equal(generatedKeys.length, 2);
  assert.notEqual(generatedKeys[0], generatedKeys[1]);
});

test('synthetic diagnostic has no network, persistence, notifications, or real-owner hooks', () => {
  const relative = 'src/utils/backupCryptoDiagnostic.ts';
  const src = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  const executable = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executable, /AsyncStorage|fetch\(|Google|setItem\(|SecureStore|console\.|scheduleFollowUpNotification|usePersistentPeople|useOwnerControls/);
  assert.ok(executable.includes("Synthetic Test Owner"));
  const settings = fs.readFileSync(path.join(__dirname, '..', 'src/components/SettingsPanel.tsx'), 'utf8');
  assert.ok(settings.includes("Application.applicationId === 'com.sweedycat.aimemory.preview'"));
  assert.ok(settings.includes('Run encryption self-test'));
  assert.ok(settings.includes('does not'));
});
