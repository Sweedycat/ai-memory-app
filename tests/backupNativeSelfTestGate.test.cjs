const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('Settings keeps real backups disabled, showing synthetic check only', () => {
  const panel = fs.readFileSync(path.join(root, 'src/components/BackupSafetyDiagnostics.tsx'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'src/components/SettingsPanel.tsx'), 'utf8');
  assert.ok(settings.includes('<BackupSafetyDiagnostics />'));
  assert.ok(panel.includes('Backup and restore are not yet available'));
  assert.ok(panel.includes('Check encryption on this phone'));
  assert.ok(panel.includes('runSyntheticBackupCryptoSelfTest'));
  assert.doesNotMatch(panel, /uploadSmallEncryptedBackup|downloadSmallEncryptedBackupForReview|setPeople|setItem|Share\.share/);
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
