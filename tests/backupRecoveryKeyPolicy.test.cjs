const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/backupRecoveryKeyPolicy.ts'), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
const { normalizeBackupRecoveryKey, formatBackupRecoveryKey, matchesRecoveryKeyConfirmation } = exportsObject;
const fixture = '0123456789abcdef'.repeat(4);
test('canonical and grouped recovery key formats round trip', () => {
  assert.equal(normalizeBackupRecoveryKey(fixture.toUpperCase()), fixture);
  assert.equal(normalizeBackupRecoveryKey(formatBackupRecoveryKey(fixture)), fixture);
  assert.equal(formatBackupRecoveryKey(fixture).split('-').length, 8);
});
test('rejects malformed recovery keys and passwords', () => {
  for (const bad of ['', 'password', fixture.slice(1), fixture + '0', 'g' + fixture.slice(1), fixture.slice(0, 8) + '--' + fixture.slice(8)]) {
    assert.throws(() => normalizeBackupRecoveryKey(bad));
    assert.equal(matchesRecoveryKeyConfirmation(fixture, bad), false);
  }
});
test('confirmation requires exact key bytes', () => {
  assert.equal(matchesRecoveryKeyConfirmation(fixture, formatBackupRecoveryKey(fixture).toUpperCase()), true);
  assert.equal(matchesRecoveryKeyConfirmation(fixture, 'f' + fixture.slice(1)), false);
});
