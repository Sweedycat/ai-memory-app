const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const { loadPure } = require('./helpers/presentation.cjs');

test('Settings keeps real backups disabled, showing synthetic check only', () => {
  const panel = fs.readFileSync(path.join(root, 'src/components/BackupSafetyDiagnostics.tsx'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'src/components/SettingsPanel.tsx'), 'utf8');
  assert.ok(settings.includes('<BackupSafetyDiagnostics />'));
  const copy = loadPure('src/i18n/catalog.ts').catalog.en.ui.backup;
  assert.match(copy.description, /Backup and restore are not yet available/);
  assert.equal(copy.check, 'Check encryption on this phone');
  assert.match(panel, /catalog\.ui\.backup/);
  assert.match(panel, /\{copy\.description\}/);
  assert.match(panel, /onPress=\{\(\) => void runCheck\(\)\}/);
  assert.ok(panel.includes('runSyntheticBackupCryptoSelfTest'));
  // Permit exactly one write of the two non-secret preferences; reject all other setItem calls.
  const allowedWrite = /AsyncStorage\.setItem\('ai-memory\.backup\.preferences\.v1',\s*JSON\.stringify\(\{ frequency, wifiOnly \}\)\)/g;
  assert.equal([...panel.matchAll(allowedWrite)].length, 1);
  assert.doesNotMatch(panel.replace(allowedWrite, ''), /uploadSmallEncryptedBackup|downloadSmallEncryptedBackupForReview|setPeople|setItem|multiSet|mergeItem|removeItem|Share\.share|fetch\(|generateBackupRecoveryKey/);
});

test('native preflight operates only on obvious synthetic objects and verifies fail closed', () => {
  const source = fs.readFileSync(path.join(root, 'src/utils/backupNativeSelfTest.ts'), 'utf8');
  assert.match(source, /Synthetic Test Person/);
  assert.match(source, /syntheticPerson\.notes\[0\]/);
  assert.match(source, /rejectedWrongKey/);
  assert.match(source, /rejectedTamperedFile/);
  assert.match(source, /notificationId !== undefined/);
  assert.doesNotMatch(source, /AsyncStorage|fetch\(|console\.|Share\.|Google/);
});
