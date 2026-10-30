const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(projectRoot, relative), 'utf8');
const source = read('src/utils/permissionDisclosures.ts');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const scope = { module: { exports: {} } };
scope.exports = scope.module.exports;
vm.runInNewContext(js, scope);
const {
  CURRENT_PERMISSIONS,
  FUTURE_PERMISSIONS,
  PERMISSION_PRIVACY_NOTE,
} = scope.module.exports;

test('current permission catalogue includes the entire phone-first MVP permission surface', () => {
  assert.deepEqual(
    Array.from(CURRENT_PERMISSIONS.map((entry) => entry.id)).sort(),
    ['biometrics', 'exact-alarms', 'network', 'notifications', 'reboot'],
  );
});

test('active permissions have clear purposes, grant explanations and timings', () => {
  for (const item of CURRENT_PERMISSIONS) {
    for (const field of ['name', 'purpose', 'howGranted', 'whenUsed']) {
      assert.ok(typeof item[field] === 'string' && item[field].trim().length >= 12, item.id + ' ' + field);
    }
    assert.ok(['user-choice', 'system-managed'].includes(item.access));
  }
});

test('only real user choices are labelled as permission prompts', () => {
  const choices = CURRENT_PERMISSIONS.filter((x) => x.access === 'user-choice').map((x) => x.id).sort();
  assert.deepEqual(Array.from(choices), ['biometrics', 'exact-alarms', 'notifications']);
});

test('new camera, microphone, location, contacts and files are not treated as current runtime requests', () => {
  assert.deepEqual(
    Array.from(FUTURE_PERMISSIONS.map((x) => x.id)).sort(),
    ['camera', 'contacts', 'files', 'location', 'microphone'],
  );
  for (const future of FUTURE_PERMISSIONS) {
    assert.ok(!CURRENT_PERMISSIONS.some((current) => current.id === future.id));
    assert.ok(future.context.length > 20);
  }
});

test('Android only declares relevant app permissions; no camera, location, mic, contacts or media permissions', () => {
  const android = JSON.parse(read('app.json')).expo.android;
  const permissions = android.permissions;
  assert.ok(permissions.includes('android.permission.SCHEDULE_EXACT_ALARM'));
  assert.ok(permissions.includes('android.permission.USE_BIOMETRIC'));
  const unexpected = /(CAMERA|RECORD_AUDIO|ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION|READ_CONTACTS|READ_MEDIA_|READ_EXTERNAL_STORAGE)/;
  assert.ok(permissions.every((permission) => !unexpected.test(permission)));
});

test('privacy overview does not claim encryption that this build does not provide', () => {
  assert.match(PERMISSION_PRIVACY_NOTE, /not a promise of encryption/);
  assert.match(PERMISSION_PRIVACY_NOTE, /not automatically attached/);
});

test('onboarding is first-run, non-blocking and offers all permission descriptions', () => {
  const gate = read('src/components/ReminderPermissionGate.tsx');
  assert.match(gate, /permission-transparency-setup\/v2/);
  assert.match(gate, /<PermissionOverview \/>/);
  assert.match(gate, /Continue to AI Memory/);
  assert.match(gate, /setShowSetup\(false\)/);
});

test('all permission details can be reopened from Settings', () => {
  const settings = read('src/components/SettingsPanel.tsx');
  assert.match(settings, /PERMISSIONS & PRIVACY/);
  assert.match(settings, /showPermissionDetails/);
  assert.match(settings, /<PermissionOverview \/>/);
  assert.match(settings, /<ReminderPermissionActions \/>/);
});

test('Android notification channel is set up before requesting runtime permission', () => {
  const actions = read('src/components/ReminderPermissionActions.tsx');
  const channel = actions.indexOf("setNotificationChannelAsync('follow-ups-v2'");
  const ask = actions.indexOf('Notifications.requestPermissionsAsync()');
  assert.ok(channel > 0 && ask > channel);
  assert.match(actions, /REQUEST_SCHEDULE_EXACT_ALARM/);
  assert.match(actions, /Returning here does not confirm/);
});
