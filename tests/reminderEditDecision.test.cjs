const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

// Load the real TypeScript policy without introducing a production test-only dependency.
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'reminderEditDecision.ts'), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleContext = { module: { exports: {} } };
moduleContext.exports = moduleContext.module.exports;
vm.runInNewContext(js, moduleContext);
const { planReminderEdit } = moduleContext.module.exports;

const now = new Date('2026-10-30T12:00:00.000Z').getTime();
const current = {
  text: 'Follow up',
  reminderAt: '2026-10-30T12:30:00.000Z',
  notificationId: 'android-notification-1',
};
const decide = (changes = {}) => planReminderEdit({
  current,
  nextText: current.text,
  nextReminderAt: current.reminderAt,
  personNameChanged: false,
  nowMs: now,
  ...changes,
});

test('keeps existing scheduled notification when unchanged', () => {
  assert.equal(decide(), 'reuse');
});

test('reschedules when the time is edited', () => {
  assert.equal(decide({ nextReminderAt: '2026-10-30T13:00:00.000Z' }), 'schedule');
});

test('reschedules when the follow-up text changes', () => {
  assert.equal(decide({ nextText: 'New follow-up text' }), 'schedule');
});

test('reschedules when the person name changes', () => {
  assert.equal(decide({ personNameChanged: true }), 'schedule');
});

test('repairs missing notification IDs by scheduling a new notification', () => {
  assert.equal(decide({ current: { ...current, notificationId: undefined } }), 'schedule');
});

test('rejects rearming an expired reminder without a new future time', () => {
  assert.equal(decide({ nowMs: new Date('2026-10-30T12:31:00.000Z').getTime() }), 'expired');
});

test('rejects a newly selected past reminder time', () => {
  assert.equal(decide({ nextReminderAt: '2026-10-30T11:00:00.000Z' }), 'invalid');
});

test('rejects an invalid reminder date', () => {
  assert.equal(decide({ nextReminderAt: 'not-a-date' }), 'invalid');
});

test('clears a follow-up when text is removed', () => {
  assert.equal(decide({ nextText: '' }), 'clear');
});

test('allows removing reminder time while keeping follow-up text', () => {
  assert.equal(decide({ nextReminderAt: undefined }), 'no-reminder');
});
