const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { loadPure } = require('./helpers/presentation.cjs');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
const compiled = ts.transpileModule(read('src/utils/reminderNotificationPrivacy.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const sandbox = { module: { exports: {} } };
sandbox.require = name => {
  assert.equal(name, '../i18n/catalogs/notifications');
  return loadPure('src/i18n/catalogs/notifications.ts');
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled, sandbox);

const { PRIVATE_FOLLOW_UP_CHANNEL_ID, buildPrivateFollowUpContent } = sandbox.module.exports;

test('generic notification preview does not expose person name or follow-up text', () => {
  const personName = 'Private Person Name';
  const followUpText = 'Confidential follow-up about a private appointment';
  const content = buildPrivateFollowUpContent({
    personId: 'person-private-01',
    followUpId: 'followup-private-01',
  });
  assert.equal(content.title, 'AI Memory');
  assert.match(content.body, /Unlock AI Memory/);
  for (const visible of [content.title, content.body]) {
    assert.ok(!visible.includes(personName));
    assert.ok(!visible.includes(followUpText));
    assert.ok(!visible.includes('person-private-01'));
    assert.ok(!visible.includes('followup-private-01'));
  }
  assert.equal(content.data.personId, 'person-private-01');
  assert.equal(content.data.followUpId, 'followup-private-01');
  assert.equal(content.data.type, 'follow-up');
});

test('private follow-up channel has a new immutable id and lock-screen privacy policy', () => {
  assert.notEqual(PRIVATE_FOLLOW_UP_CHANNEL_ID, 'follow-ups-v2');
  const scheduler = read('src/utils/followUpNotifications.ts');
  assert.match(scheduler, /PRIVATE_FOLLOW_UP_CHANNEL_ID/);
  assert.match(scheduler, /lockscreenVisibility:\s*Notifications\.AndroidNotificationVisibility\.PRIVATE/);
  assert.match(scheduler, /channelId:\s*PRIVATE_FOLLOW_UP_CHANNEL_ID/);
});

test('notification scheduler uses generic preview while retaining routed person ids', () => {
  const scheduler = read('src/utils/followUpNotifications.ts');
  assert.match(scheduler, /content:\s*buildPrivateFollowUpContent\(/);
  assert.doesNotMatch(scheduler, /title:\s*args\.personName/);
  assert.doesNotMatch(scheduler, /body:\s*args\.text/);
  assert.match(scheduler, /personId:\s*args\.personId/);
  assert.match(scheduler, /followUpId:\s*args\.followUpId/);
});

test('onboarding and scheduling configure the same privacy-safe channel', () => {
  const onboarding = read('src/components/ReminderPermissionActions.tsx');
  const scheduler = read('src/utils/followUpNotifications.ts');
  assert.match(onboarding, /await ensurePrivateFollowUpChannel\(language\)/);
  assert.match(scheduler, /await ensurePrivateFollowUpChannel\(language\)/);
  assert.doesNotMatch(onboarding, /follow-ups-v2/);
});

test('permissions disclosure mentions private previews and already scheduled reminders', () => {
  const disclosures = read('src/utils/permissionDisclosures.ts');
  assert.match(disclosures, /generic AI Memory reminder/);
  assert.match(disclosures, /Older reminders already scheduled/);
});

test('Turkish notification copy stays generic and retains the same routing identifiers', () => {
  const content = buildPrivateFollowUpContent({ personId: 'synthetic-person', followUpId: 'synthetic-followup', language: 'tr' });
  assert.equal(content.body, loadPure('src/i18n/catalogs/notifications.ts').notificationsTr.body);
  assert.equal(content.title, 'AI Memory');
  assert.equal(content.data.personId, 'synthetic-person');
  for (const visible of [content.title, content.body]) {
    assert.ok(!visible.includes('synthetic-person'));
    assert.ok(!visible.includes('synthetic-followup'));
  }
});

test('actual scheduler localizes new private alerts without rescheduling and redacts native failure details', async () => {
  const channels = [], scheduled = [], warnings = [];
  let allowed = true, failNative = false;
  const notifications = {
    setNotificationHandler() {}, AndroidImportance: { HIGH: 'high' }, AndroidNotificationVisibility: { PRIVATE: 'private' },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    async setNotificationChannelAsync(id, config) { channels.push({ id, config }); },
    async getPermissionsAsync() { return { granted: allowed }; },
    async requestPermissionsAsync() { return { granted: allowed }; },
    async scheduleNotificationAsync(config) { if (failNative) throw Error('Synthetic confidential native payload'); scheduled.push(config); return 'synthetic-alarm'; },
    async cancelScheduledNotificationAsync() { throw Error('Synthetic confidential native payload'); },
  };
  const local = { exports: {} };
  new Function('require', 'module', 'exports', 'console', ts.transpileModule(read('src/utils/followUpNotifications.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => {
    if (name === 'react-native') return { Platform: { OS: 'android' } };
    if (name === 'expo-notifications') return notifications;
    if (name === '../i18n/catalogs/notifications') return loadPure('src/i18n/catalogs/notifications.ts');
    if (name === './reminderNotificationPrivacy') return sandbox.module.exports;
    throw Error('Unexpected import ' + name);
  }, local, local.exports, { warn: (...args) => warnings.push(args) });
  const api = local.exports;
  const args = { personId: 'synthetic-person', personName: 'Synthetic private name', followUpId: 'synthetic-followup',
    text: 'Synthetic private note', reminderAt: '2099-01-01T12:00:00Z', language: 'tr' };
  assert.equal(await api.scheduleFollowUpNotification(args), 'synthetic-alarm');
  assert.equal(scheduled.length, 1); assert.equal(channels[0].id, PRIVATE_FOLLOW_UP_CHANNEL_ID);
  assert.equal(channels[0].config.lockscreenVisibility, 'private');
  assert.equal(scheduled[0].content.body, loadPure('src/i18n/catalogs/notifications.ts').notificationsTr.body);
  assert.equal(scheduled[0].trigger.channelId, PRIVATE_FOLLOW_UP_CHANNEL_ID);
  allowed = false; assert.equal(await api.scheduleFollowUpNotification(args), null); assert.equal(scheduled.length, 1);
  allowed = true; failNative = true; assert.equal(await api.scheduleFollowUpNotification(args), null);
  await api.cancelFollowUpNotification('synthetic-alarm');
  assert.deepEqual(warnings, [['follow-up-scheduling-unavailable'], ['follow-up-cancellation-unavailable']]);
});
