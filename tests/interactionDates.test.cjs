const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/utils/interactionDates.ts'), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const generatedContext = { module: { exports: {} } };
generatedContext.exports = generatedContext.module.exports;
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(root, 'src/i18n/catalogs/generated.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, generatedContext);
const context = { module: { exports: {} }, require(name) {
  assert.equal(name, '../i18n/catalogs/generated'); return generatedContext.module.exports;
} };
context.exports = context.module.exports;
vm.runInNewContext(js, context);
const { formatInteractionDate, createInteractionTimestamp } = context.module.exports;

test('new events preserve unambiguous ISO timestamp with UTC offset', () => {
  const instant = new Date('2026-11-04T09:30:12.000Z');
  assert.equal(createInteractionTimestamp(instant), '2026-11-04T09:30:12.000Z');
});

test('history renders date and time rather than a permanently stale relative label', () => {
  const date = formatInteractionDate('2026-11-04T09:30:12.000Z');
  assert.notEqual(date, 'Just now');
  assert.ok(date.includes('2026'));
  assert.ok(/\d{1,2}:\d{2}/.test(date), date);
});

test('different valid timezone offsets represent the same moment', () => {
  assert.equal(
    formatInteractionDate('2026-11-04T12:30:12+03:00'),
    formatInteractionDate('2026-11-04T09:30:12Z'),
  );
});

test('legacy Just now and other relative strings have no fabricated timestamp', () => {
  for (const legacy of ['Just now', 'Today, 14:20', '2 days ago', 'Last week', '', 'not a date']) {
    assert.equal(formatInteractionDate(legacy), 'Date not recorded', legacy);
  }
});

test('invalid ISO date is not shown as a real event time', () => {
  assert.equal(formatInteractionDate('2026-11-99T10:00:00Z'), 'Date not recorded');
});

test('app persists ISO dates, formats history, list and recent memory consistently', () => {
  const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
  assert.match(app, /const timestamp = createInteractionTimestamp\(\)/);
  assert.match(app, /lastInteraction: timestamp/);
  assert.match(app, /date: timestamp/);
  const history = fs.readFileSync(path.join(root, 'src/components/PersonHistory.tsx'), 'utf8');
  assert.match(app, /<PersonHistory key=\{selected\.id\} interactions=\{selected\.interactions\} completed=\{selected\.followUpHistory \?\? \[\]\}/);
  assert.match(history, /formatInteractionDate\(value(?:, locale)?\)/);
  assert.match(app, /formatInteractionDate\(latestDatedInteraction\(person\.interactions\)\?\.date, locale\)/);
  assert.match(app, /recentPersonMemory\(people\)/);
  assert.match(app, /recentDate}>\{formatInteractionDate\(recentMemory\.interaction\.date, locale\)\}/);
  assert.doesNotMatch(app, /date:\s*'Just now'/);
});

test('selected locale formats known dates and unknown labels without changing parsing', () => {
  const instant = '2026-11-04T09:30:12.000Z';
  assert.equal(formatInteractionDate('Last week', 'tr-TR'), 'Tarih kaydedilmedi');
  assert.equal(formatInteractionDate('Last week', 'en-US'), 'Date not recorded');
  assert.equal(formatInteractionDate('2026-11-99T10:00:00Z', 'tr-TR'), 'Tarih kaydedilmedi');
  const tr = formatInteractionDate(instant, 'tr-TR');
  const en = formatInteractionDate(instant, 'en-US');
  assert.ok(tr.includes('Kas'), tr);
  assert.ok(en.includes('Nov'), en);
  assert.equal(formatInteractionDate('2026-11-04T12:30:12+03:00', 'tr-TR'), tr);
});
