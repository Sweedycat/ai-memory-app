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

test('local memory briefing uses saved notes, latest interaction and open follow-up', () => {
  const result = buildMemoryBriefing(person());
  assert.match(result, /^Test Person is Engineer at Testing Co\./);
  assert.match(result, /Context: Worked on the prototype\./);
  assert.match(result, /Last conversation: Discussed project milestones/);
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
