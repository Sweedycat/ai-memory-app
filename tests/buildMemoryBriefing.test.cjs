const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const generatedScope = { module: { exports: {} } };
generatedScope.exports = generatedScope.module.exports;
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '..', 'src/i18n/catalogs/generated.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, generatedScope);

const source = fs.readFileSync(path.join(__dirname, '..', 'src/utils/buildMemoryBriefing.ts'), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const scope = { module: { exports: {} } };
scope.require = name => {
  if (name === '../i18n/catalogs/generated') return generatedScope.module.exports;
  assert.equal(name, './interactionDates');
  const dateSource = fs.readFileSync(path.join(__dirname, '..', 'src/utils/interactionDates.ts'), 'utf8');
  const dateScope = { module: { exports: {} }, require(name) {
    assert.equal(name, '../i18n/catalogs/generated'); return generatedScope.module.exports;
  } }; dateScope.exports = dateScope.module.exports;
  vm.runInNewContext(ts.transpileModule(dateSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, dateScope);
  return dateScope.module.exports;
};
scope.exports = scope.module.exports;
vm.runInNewContext(js, scope);
const { buildMemoryBriefing } = scope.module.exports;

const person = (overrides = {}) => ({
  id: 'person-1',
  name: 'Test Person',
  role: 'Engineer',
  company: 'Testing Co',
  relationship: 'Worked on the prototype',
  lastInteraction: 'Just now',
  notes: ['Keep private test data offline', 'Check launch plan', 'Older irrelevant note'],
  interactions: [{ id: 'interaction-1', date: 'Just now', summary: 'Discussed project milestones', source: 'manual' }],
  followUp: { id: 'followup-1', text: 'Revisit the test next week', createdAt: '2026-11-03T08:00:00Z' },
  followUpHistory: [],
  ...overrides,
});

test('local memory briefing uses saved notes, labelled undated interaction and open follow-up', () => {
  const result = buildMemoryBriefing(person());
  assert.match(result, /^Test Person is Engineer at Testing Co\./);
  assert.match(result, /Context: Worked on the prototype\./);
  assert.match(result, /Saved interaction \(date not recorded\): Discussed project milestones/);
  assert.match(result, /latest interaction cannot be confirmed/);
  assert.match(result, /Remember: Keep private test data offline Check launch plan/);
  assert.match(result, /Next step: Revisit the test next week\./);
  assert.ok(!result.includes('Older irrelevant note'), 'only two most recent notes should appear');
});

test('local memory briefing also works with a person who has no interactions or reminders', () => {
  const result = buildMemoryBriefing(person({
    role: undefined, company: undefined, relationship: '', notes: [],
    interactions: [], followUp: undefined,
  }));
  assert.equal(result, 'Test Person.');
});

test('completed follow-ups are not described as open next steps', () => {
  const result = buildMemoryBriefing(person({
    followUp: undefined,
    followUpHistory: [{ id: 'finished', text: 'Already completed', createdAt: '2026-11-01T10:00:00Z', completedAt: '2026-11-02T10:00:00Z' }],
  }));
  assert.ok(!result.includes('Next step:'));
  assert.ok(!result.includes('Already completed'));
});

test('briefing finds the latest dated past interaction instead of trusting source array order', () => {
  const result = buildMemoryBriefing(person({ interactions: [
    { id: 'old', date: '2026-01-01T12:00:00Z', summary: 'Older synthetic conversation', source: 'manual' },
    { id: 'new', date: '2026-02-02T12:00:00Z', summary: 'Latest synthetic interaction', source: 'manual' },
  ] }), new Date('2026-02-03T12:00:00Z'));
  assert.match(result, /Last dated interaction .*Latest synthetic interaction/);
  assert.ok(!result.includes('Older synthetic conversation'));
});

test('undated legacy interactions remain readable without a fabricated last-conversation claim', () => {
  const result = buildMemoryBriefing(person(), new Date('2026-02-03T12:00:00Z'));
  assert.match(result, /Saved interaction \(date not recorded\): Discussed project milestones/);
  assert.match(result, /latest interaction cannot be confirmed/);
  assert.ok(!result.includes('Last conversation:'));
});

test('future and unknown dates remain uncertain rather than replacing the last dated past interaction', () => {
  const source = person({ interactions: [
    { id: 'future', date: '2099-01-01T12:00:00Z', summary: 'Future synthetic entry', source: 'manual' },
    { id: 'past', date: '2026-01-01T12:00:00Z', summary: 'Actual dated synthetic entry', source: 'manual' },
    { id: 'legacy', date: 'Last week', summary: 'Legacy synthetic entry', source: 'manual' },
  ] });
  const before = JSON.stringify(source);
  const result = buildMemoryBriefing(source, new Date('2026-02-03T12:00:00Z'));
  assert.match(result, /Last dated interaction .*Actual dated synthetic entry/);
  assert.match(result, /Future-dated interactions need review/);
  assert.match(result, /latest interaction cannot be confirmed/);
  assert.equal(JSON.stringify(source), before);
  const onlyFuture = buildMemoryBriefing({ ...source, interactions: source.interactions.slice(0, 1) }, new Date('2026-02-03T12:00:00Z'));
  assert.match(onlyFuture, /Saved interaction \(future date, needs review\): Future synthetic entry/);
  assert.ok(!onlyFuture.includes('Last dated interaction'));
});

test('embedded completed follow-ups cannot become a promised next step; invalid now is rejected', () => {
  const result = buildMemoryBriefing(person({ followUp: { ...person().followUp, completedAt: '2026-01-01T12:00:00Z' } }));
  assert.ok(!result.includes('Next step:'));
  assert.throws(() => buildMemoryBriefing(person(), new Date('invalid')), /Invalid briefing date/);
});

test('Turkish briefing translates generated templates while preserving all original record text', () => {
  const record = person();
  const original = JSON.stringify(record);
  const result = buildMemoryBriefing(record, new Date('2026-11-20T12:00:00Z'), 'tr-TR');
  assert.match(result, /^Test Person — Engineer · Testing Co\./);
  assert.ok(result.includes('Bağlam: Worked on the prototype.'));
  assert.ok(result.includes('Kayıtlı etkileşim (tarih kaydedilmedi): Discussed project milestones'));
  assert.ok(result.includes('en son etkileşim doğrulanamıyor'));
  assert.ok(result.includes('Hatırla: Keep private test data offline Check launch plan'));
  assert.ok(result.includes('Sonraki adım: Revisit the test next week.'));
  assert.ok(!result.includes('Context:'));
  assert.ok(!result.includes('Next step:'));
  assert.equal(JSON.stringify(record), original);
});

test('Turkish briefing retains uncertainty and completed-follow-up exclusion', () => {
  const record = person({ interactions: [
    { id: 'future', date: '2099-01-01T12:00:00Z', summary: 'Original future record', source: 'manual' },
    { id: 'past', date: '2026-11-04T09:30:00Z', summary: 'Original past record', source: 'manual' },
  ], followUp: { ...person().followUp, completedAt: '2026-11-01T12:00:00Z' } });
  const now = new Date('2026-11-20T12:00:00Z');
  const dated = buildMemoryBriefing(record, now, 'tr-TR');
  assert.ok(dated.includes('Son tarihli etkileşim'));
  assert.ok(dated.includes('Kas'));
  assert.ok(dated.includes('Original past record'));
  assert.ok(dated.includes('Gelecek tarihli etkileşimler incelenmeli.'));
  assert.ok(!dated.includes('Sonraki adım:'));
  const future = buildMemoryBriefing({ ...record, interactions: record.interactions.slice(0, 1) }, now, 'tr-TR');
  assert.ok(future.includes('Kayıtlı etkileşim (gelecek tarihli, incelenmeli): Original future record'));
});

test('standalone generated catalogs preserve exact English and Turkish briefing output', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  assert.equal(buildMemoryBriefing(person(), now),
    'Test Person is Engineer at Testing Co. Context: Worked on the prototype. Saved interaction (date not recorded): Discussed project milestones Some interaction dates are not recorded; the latest interaction cannot be confirmed. Remember: Keep private test data offline Check launch plan Next step: Revisit the test next week.');
  assert.equal(buildMemoryBriefing(person(), now, 'tr-TR'),
    'Test Person — Engineer · Testing Co. Bağlam: Worked on the prototype. Kayıtlı etkileşim (tarih kaydedilmedi): Discussed project milestones Bazı etkileşimlerin tarihi kaydedilmemiş; en son etkileşim doğrulanamıyor. Hatırla: Keep private test data offline Check launch plan Sonraki adım: Revisit the test next week.');
});
