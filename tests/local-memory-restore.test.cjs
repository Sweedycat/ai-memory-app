const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const file = path.join(__dirname, '../src/utils/normalizeStoredPeople.ts');
const source = fs.readFileSync(file, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const localModule = { exports: {} };
const rejectUnexpectedImport = (name) => {
  throw new Error(`Unexpected runtime import: ${name}`);
};
new Function('require', 'module', 'exports', compiled)(
  rejectUnexpectedImport,
  localModule,
  localModule.exports,
);

const { decodeStoredPeople, normalizeStoredPeople } = localModule.exports;

const savedPerson = {
  id: 'person-1',
  name: 'Test Person',
  role: 'Designer',
  lastInteraction: 'Today',
  relationship: 'Met through work',
  notes: ['Remember their project'],
  interactions: [
    { id: 'interaction-1', date: 'Today', summary: 'Talked about a project', source: 'manual' },
  ],
};

test('restores existing valid people without dropping interactions or notes', () => {
  const restored = decodeStoredPeople(JSON.stringify([savedPerson]));
  assert.equal(restored.length, 1);
  assert.deepEqual(restored[0].notes, savedPerson.notes);
  assert.deepEqual(restored[0].interactions, savedPerson.interactions);
  assert.deepEqual(restored[0].followUpHistory, []);
});

test('supports an intentionally empty saved list', () => {
  assert.deepEqual(decodeStoredPeople('[]'), []);
});

test('preserves legacy follow-up text through migration', () => {
  const saved = { ...savedPerson, followUp: 'Call again next week' };
  const restored = decodeStoredPeople(JSON.stringify([saved]));
  assert.equal(restored[0].followUp.text, 'Call again next week');
  assert.equal(typeof restored[0].followUp.id, 'string');
});

test('does not mutate parsed input', () => {
  const stored = [savedPerson];
  normalizeStoredPeople(stored);
  assert.equal(Object.hasOwn(savedPerson, 'followUpHistory'), false);
});

test('rejects corrupt JSON instead of replacing it with demo data', () => {
  assert.throws(() => decodeStoredPeople('[invalid'), SyntaxError);
});

test('rejects a wrong top-level storage format', () => {
  assert.throws(() => decodeStoredPeople('{"people": []}'), /invalid format/);
});

test('rejects a partially corrupt person list without dropping records', () => {
  assert.equal(normalizeStoredPeople([savedPerson, null]), null);
  assert.equal(normalizeStoredPeople([savedPerson, { name: 'Missing id' }]), null);
});

test('rejects invalid interactions before persisting a partial migration', () => {
  const invalid = { ...savedPerson, interactions: [{ id: 'bad', summary: 12 }] };
  assert.equal(normalizeStoredPeople([invalid]), null);
});
