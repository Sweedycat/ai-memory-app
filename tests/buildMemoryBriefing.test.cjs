const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/utils/buildMemoryBriefing.ts'), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const scope = { module: { exports: {} } };
scope.require = name => {
  assert.equal(name, './interactionDates');
  const dateSource = fs.readFileSync(path.join(__dirname, '..', 'src/utils/interactionDates.ts'), 'utf8');
  const dateScope = { module: { exports: {} } }; dateScope.exports = dateScope.module.exports;
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
