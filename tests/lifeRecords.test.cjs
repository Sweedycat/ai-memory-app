const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');

const file = path.join(__dirname, '..', 'src/utils/lifeRecords.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const local = { exports: {} };
new Function('exports', 'module', compiled)(local.exports, local);
const { CATEGORIES, LIFE_LIMITS, validLifeDate, localLifeDate, lifeAgenda, completeLifeRecord, validateLifeRecord, validateLifeRecords } = local.exports;
const record = (id = 'synthetic-life', extra = {}) => ({ id, title: 'Synthetic insurance', category: 'insurance',
  dueDate: '2026-06-02', notes: 'Fabricated note', recurring: false, history: [], ...extra });
const now = new Date(2026, 5, 2, 12);

test('strict Gregorian calendar handles leap centuries, years 1..9999 and rollover', () => {
  for (const date of ['0001-01-01', '0099-12-31', '2000-02-29', '2028-02-29', '9999-12-31']) assert.equal(validLifeDate(date), true, date);
  for (const date of ['0000-01-01', '1900-02-29', '2100-02-29', '2026-02-29', '2026-04-31', '2026-00-12', '2026-13-01', '2026-01-00', '2026-1-01', '2026-01-01Z', '2026-01-01T00:00:00Z', '10000-01-01', '', null, 1]) assert.equal(validLifeDate(date), false, String(date));
  assert.equal(localLifeDate(now), '2026-06-02');
  assert.throws(() => localLifeDate(new Date(NaN)));
});

test('local calendar boundaries, DST and UTC offsets do not shift date-only deadlines', () => {
  const script = `const m={exports:{}};new Function('exports','module',${JSON.stringify(compiled)})(m.exports,m);const x=m.exports;const dates=['2026-03-08T04:30:00.000Z','2026-03-08T06:30:00.000Z','2026-03-09T03:30:00.000Z','2026-11-01T05:30:00.000Z','2026-11-01T06:30:00.000Z'];process.stdout.write(JSON.stringify(dates.map(d=>x.localLifeDate(new Date(d)))));`;
  const scenarios = [
    ['America/New_York', ['2026-03-07', '2026-03-08', '2026-03-08', '2026-11-01', '2026-11-01']],
    ['Europe/Istanbul', ['2026-03-08', '2026-03-08', '2026-03-09', '2026-11-01', '2026-11-01']],
    ['Pacific/Kiritimati', ['2026-03-08', '2026-03-08', '2026-03-09', '2026-11-01', '2026-11-01']],
  ];
  for (const [TZ, expected] of scenarios) {
    const result = execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(result), expected, TZ);
  }
});

test('agenda partitions all future dates, uses due-date sorting and normalized search without mutating input', () => {
  const records = [record('future-later', { dueDate: '2030-01-01' }), record('today'),
    record('past-b', { dueDate: '2026-05-31' }), record('past-a', { dueDate: '2026-05-01' }),
    record('done', { completedAt: '2026-06-01T12:00:00.000Z' }), record('future-next', { dueDate: '2026-06-03', title: 'İŞLEM', notes: 'Café synthetic', category: 'document' })];
  const original = JSON.stringify(records);
  const agenda = lifeAgenda(records, now);
  assert.deepEqual(agenda.overdue.map(x => x.id), ['past-a', 'past-b']);
  assert.deepEqual(agenda.today.map(x => x.id), ['today']);
  assert.deepEqual(agenda.upcoming.map(x => x.id), ['future-next', 'future-later']);
  assert.deepEqual(agenda.completed.map(x => x.id), ['done']);
  for (const query of ['islem', 'CAFE', 'DOCUMENT', '2026-06-03']) assert.equal(lifeAgenda(records, now, query).upcoming[0].id, 'future-next');
  assert.equal(lifeAgenda(records, now, 'missing').today.length, 0);
  assert.equal(JSON.stringify(records), original);
  assert.equal(lifeAgenda([record('inspection', { category: 'vehicle-inspection' })], now, 'Vehicle inspection', {
    'vehicle-inspection': 'Vehicle inspection',
  }).today[0].id, 'inspection');
  assert.equal(lifeAgenda([record()], now, 'sigorta', { insurance: 'Sigorta yenileme' }).today[0].id, 'synthetic-life');
});

test('completion requires an explicit later recurring date or explicit completion without rescheduling', () => {
  const base = record('recurring', { recurring: true, dueDate: '2026-06-01' });
  const next = completeLifeRecord(base, now, '2026-06-03');
  assert.equal(next.dueDate, '2026-06-03');
  assert.equal(next.completedAt, undefined);
  assert.deepEqual(next.history, [{ dueDate: base.dueDate, completedAt: now.toISOString() }]);
  assert.equal(base.history.length, 0);
  for (const invalid of ['2026-06-01', '2026-06-02', '2026-06-31', '', undefined]) assert.throws(() => completeLifeRecord(base, now, invalid));
  assert.throws(() => completeLifeRecord(record('future', { recurring: true, dueDate: '2026-07-01' }), now, '2026-06-30'));
  assert.throws(() => completeLifeRecord(record(), now, '2026-07-01'));
  for (const source of [base, record()]) {
    const done = completeLifeRecord(source, now, null);
    assert.equal(done.completedAt, now.toISOString());
    assert.equal(done.dueDate, source.dueDate);
    assert.equal(done.history.length, 1);
    assert.throws(() => completeLifeRecord(done, now, null));
  }
  const full = record('full', { history: Array.from({ length: LIFE_LIMITS.history }, () => ({ dueDate: '2025-01-01', completedAt: '2025-01-02T00:00:00.000Z' })) });
  assert.throws(() => completeLifeRecord(full, now, null));
  assert.equal(full.history.length, LIFE_LIMITS.history);
});

test('bounded strict records reject unsupported data without silently dropping fields or history', () => {
  assert.equal(CATEGORIES.length, 8);
  assert.deepEqual(validateLifeRecord(record()), record());
  const bad = [null, {}, record('', {}), record('a', { title: ' ' }), record('a', { notes: 42 }),
    record('a', { category: 'unknown' }), record('a', { recurring: 'yes' }), record('a', { dueDate: '2026-02-30' }),
    record('a', { notificationId: 'synthetic-old-device-id' }), record('a', { title: 'x'.repeat(LIFE_LIMITS.title + 1) }),
    record('a', { notes: 'x'.repeat(LIFE_LIMITS.notes + 1) }), record('x'.repeat(LIFE_LIMITS.id + 1)),
    record('a', { completedAt: '2026-02-30T00:00:00.000Z' }), record('a', { completedAt: '2026-06-01T12:00:00+00:00' }),
    record('a', { history: [{ dueDate: '2026-01-01', completedAt: '2026-01-01T00:00:00.000Z', extra: 1 }] }),
    record('a', { history: Array(LIFE_LIMITS.history + 1).fill({ dueDate: '2026-01-01', completedAt: '2026-01-01T00:00:00.000Z' }) })];
  for (const input of bad) assert.throws(() => validateLifeRecord(input));
  assert.throws(() => validateLifeRecords([record(), record()]));
  assert.throws(() => validateLifeRecords(Array.from({ length: LIFE_LIMITS.records + 1 }, (_, i) => record(String(i)))));
  assert.deepEqual(validateLifeRecords([]), []);
});
