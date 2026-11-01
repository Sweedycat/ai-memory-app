const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
const compiled = ts.transpileModule(read('src/utils/reminderNotificationPrivacy.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const sandbox = { module: { exports: {} } };
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
  assert.match(onboarding, /await ensurePrivateFollowUpChannel\(\)/);
  assert.match(scheduler, /await ensurePrivateFollowUpChannel\(\)/);
  assert.doesNotMatch(onboarding, /follow-ups-v2/);
});

test('permissions disclosure mentions private previews and already scheduled reminders', () => {
  const disclosures = read('src/utils/permissionDisclosures.ts');
  assert.match(disclosures, /generic AI Memory reminder/);
  assert.match(disclosures, /Older reminders already scheduled/);
});
