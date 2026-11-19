const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const local = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/dailyBriefing.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(local, local.exports);
const { buildDailyBriefing: build } = local.exports;
function person(id, reminderAt, overrides = {}) {
  return { id, name: 'Synthetic ' + id, relationship: '', lastInteraction: 'Just now', notes: [], interactions: [],
    followUp: { id: 'follow-' + id, text: 'Saved commitment ' + id, createdAt: '2026-01-01T12:00:00.000Z', reminderAt, ...overrides } };
}
function timezone(zone, run) {
  const old = process.env.TZ; process.env.TZ = zone;
  try { run(); } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
}
test('saved follow-ups occupy distinct due buckets and preserve actual source IDs/text without mutation', () => timezone('UTC', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const people = [person('past', '2026-11-17T11:00:00Z'), person('now', '2026-11-17T12:00:00Z'),
    person('today', '2026-11-17T23:59:59Z'), person('tomorrow', '2026-11-18T00:00:00Z'),
    person('day7', '2026-11-24T23:59:59Z'), person('later', '2026-11-25T00:00:00Z'), person('no-date')];
  const before = JSON.stringify(people), date = now.getTime();
  const result = build(people, now);
  assert.deepEqual(result.overdue.map(x => x.personId), ['past']);
  assert.deepEqual(result.today.map(x => x.personId), ['now', 'today']);
  assert.deepEqual(result.upcoming.map(x => x.personId), ['tomorrow', 'day7']);
  assert.deepEqual(result.later.map(x => x.personId), ['later']);
  assert.deepEqual(result.unscheduled.map(x => x.personId), ['no-date']);
  assert.equal(result.today[0].text, people[1].followUp.text);
  assert.equal(result.today[0].followUpId, people[1].followUp.id);
  assert.equal(JSON.stringify(people), before); assert.equal(now.getTime(), date);
}));
test('unknown/invalid/relative/rollover dates need review and never become fabricated reminder times', () => {
  const bad = ['Tomorrow', '2026-11-18', '2026-02-30T10:00:00Z', '2026-11-18T24:00:00Z',
    '2026-11-18T10:60:00Z', '2026-11-18T10:00:60Z', '2026-11-18T10:00:00+99:00', 'x'.repeat(100)];
  const result = build(bad.map((value, i) => person(String(i), value)), new Date());
  assert.equal(result.needsReview.length, bad.length);
  assert.equal(result.today.length + result.upcoming.length + result.overdue.length + result.later.length, 0);
  for (const item of result.needsReview) assert.equal(item.due, undefined);
});
test('completed tasks and history never become unfinished commitments; empty saved lists invent nothing', () => {
  const completed = person('done', '2026-11-17T12:00:00Z', { completedAt: '2026-11-17T11:00:00Z' });
  const noFollowUp = { ...person('history-only'), followUp: undefined, followUpHistory: [completed.followUp] };
  const result = build([completed, noFollowUp], new Date('2026-11-17T10:00:00Z'));
  assert.equal(Object.values(result).flat().length, 0);
  assert.equal(Object.values(build([], new Date())).flat().length, 0);
});
test('same names remain separate records and missing dates are not inferred from old relative interaction labels', () => {
  const people = [person('first'), person('second')].map(x => ({ ...x, name: 'Synthetic Maya' }));
  const result = build(people, new Date());
  assert.deepEqual(result.unscheduled.map(x => x.personId), ['first', 'second']);
  assert.ok(result.unscheduled.every(x => x.due === undefined));
  result.unscheduled[0].text = 'Changed returned copy';
  assert.equal(people[0].followUp.text, 'Saved commitment first');
});
test('timezone offsets use device-local calendar boundaries, including Türkiye midnight', () => timezone('Europe/Istanbul', () => {
  const result = build([person('today', '2026-11-17T20:30:00Z'), person('tomorrow', '2026-11-17T21:00:00Z')],
    new Date('2026-11-17T23:00:00+03:00'));
  assert.equal(result.today[0].personId, 'today');
  assert.equal(result.upcoming[0].personId, 'tomorrow');
}));
test('next-seven-day window follows local days across both daylight-saving transitions', () => timezone('America/New_York', () => {
  for (const [now, inside, outside] of [
    ['2026-03-07T23:00:00-05:00', '2026-03-14T23:59:59-04:00', '2026-03-15T00:00:00-04:00'],
    ['2026-10-31T23:00:00-04:00', '2026-11-07T23:59:59-05:00', '2026-11-08T00:00:00-05:00'],
  ]) {
    const result = build([person('inside', inside), person('outside', outside)], new Date(now));
    assert.equal(result.upcoming[0].personId, 'inside'); assert.equal(result.upcoming.length, 1);
    assert.equal(result.later[0].personId, 'outside');
  }
}));
test('invalid current date is rejected instead of producing a fabricated daily summary', () => {
  assert.throws(() => build([person('synthetic')], new Date('invalid')), /Invalid briefing date/);
});

test('midnight DST gaps do not carry an extra hour into today or the next-seven-day boundary', () => timezone('Africa/Cairo', () => {
  const today = build([person('inside', '2026-04-24T23:59:59+03:00'), person('outside', '2026-04-25T00:30:00+03:00')],
    new Date('2026-04-24T12:00:00+03:00'));
  assert.deepEqual(today.today.map(item => item.personId), ['inside']);
  assert.deepEqual(today.upcoming.map(item => item.personId), ['outside']);
  const upcoming = build([person('inside', '2026-04-30T23:59:59+03:00'), person('outside', '2026-05-01T00:30:00+03:00')],
    new Date('2026-04-23T12:00:00+02:00'));
  assert.deepEqual(upcoming.upcoming.map(item => item.personId), ['inside']);
  assert.deepEqual(upcoming.later.map(item => item.personId), ['outside']);
}));
