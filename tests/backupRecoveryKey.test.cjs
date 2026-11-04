const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'src/utils/backupRecoveryKey.ts');
const source = fs.readFileSync(file, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const ctx = { module: { exports: {} } };
ctx.exports = ctx.module.exports;
vm.runInNewContext(compiled, ctx);
const {
  normalizeRecoveryKeyInput,
  formatRecoveryKeyForOfflineStorage,
  recoveryKeyConfirmationMatches,
} = ctx.module.exports;

const key = '0123456789abcdef'.repeat(4);

test('64-hex recovery key gets readable, reversible eight-character groups', () => {
  const formatted = formatRecoveryKeyForOfflineStorage(key);
  assert.equal(formatted, '01234567-89ABCDEF-01234567-89ABCDEF-01234567-89ABCDEF-01234567-89ABCDEF');
  assert.equal(normalizeRecoveryKeyInput(formatted), key);
  assert.equal(normalizeRecoveryKeyInput(formatted.replace(/-/g, ' ')), key);
});

test('recovery confirmation accepts correctly re-entered key, case and whitespace', () => {
  const formatted = formatRecoveryKeyForOfflineStorage(key);
  assert.equal(recoveryKeyConfirmationMatches(key, formatted), true);
  assert.equal(recoveryKeyConfirmationMatches(key, formatted.toLowerCase()), true);
  assert.equal(recoveryKeyConfirmationMatches(key, formatted.replace(/-/g, '\n')), true);
});

test('recovery confirmation rejects wrong, truncated and malformed keys', () => {
  const changed = key.slice(0, -1) + (key.endsWith('f') ? '0' : 'f');
  for (const attempt of [changed, key.slice(0, -1), key + '0', 'not-a-key',
    'a'.repeat(63) + 'q', '0x' + key, '']) {
    assert.equal(recoveryKeyConfirmationMatches(key, attempt), false);
    assert.throws(() => normalizeRecoveryKeyInput(attempt), /64 hexadecimal|exactly 64|Invalid recovery key/);
  }
});

test('recovery helper neither generates predictable keys nor stores or uploads them', () => {
  const executable = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executable, /Math\.random|fetch\s*\(|AsyncStorage|SecureStore|Share\.share\s*\(|Clipboard|console\./);
  assert.ok(!executable.includes('localStorage'));
});
