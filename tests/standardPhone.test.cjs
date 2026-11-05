const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function load(relative, modules = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = {
    module: { exports: {} },
    require(name) {
      if (!(name in modules)) throw Error('Unexpected import ' + name);
      return modules[name];
    },
  };
  context.exports = context.module.exports;
  vm.runInNewContext(code, context);
  return context.module.exports;
}

const phone = load('src/utils/standardPhone.ts');
const normalized = load('src/utils/normalizeStoredPeople.ts');
const snapshots = load('src/utils/backupSnapshot.ts', {
  './normalizeStoredPeople': normalized,
});

function fakePerson() {
  return {
    id: 'test-person-01',
    name: 'Synthetic buyer',
    relationship: 'Test customer',
    lastInteraction: '2026-11-05T10:00:00.000Z',
    notes: ['Synthetic notes remain'],
    interactions: [{ id: 'interaction-1', date: '2026-11-05T10:00:00.000Z',
      summary: 'Synthetic test meeting', source: 'manual' }],
    followUpHistory: [{ id: 'completed-1', text: 'Test reminder',
      createdAt: '2026-11-05T10:00:00.000Z',
      completedAt: '2026-11-05T10:30:00.000Z' }],
  };
}

const owner = {
  name: 'Synthetic Account',
  preferredName: 'Owner',
  role: 'Tester',
};

test('accepts optional international phone without rewriting user formatting', () => {
  const raw = ' +90 (532) 123 45 67 ';
  assert.equal(phone.normalizeStandardPhone(raw), '+90 (532) 123 45 67');
  assert.equal(phone.normalizeStandardPhone('  '), undefined);
  assert.equal(phone.normalizeStandardPhone('555 1234 ext 123'), '555 1234 ext 123');
});

test('rejects invalid phone data before person creation or editing', () => {
  for (const raw of ['1', 'text-only', '123\n999', '123\u0000', '1'.repeat(65), '1'.repeat(21)]) {
    assert.throws(() => phone.normalizeStandardPhone(raw));
  }
});

test('old person records without a phone retain every existing note and history field', () => {
  const current = fakePerson();
  const restored = normalized.decodeStoredPeople(JSON.stringify([current]));
  assert.equal(restored.length, 1);
  assert.equal(restored[0].phone, undefined);
  assert.equal(restored[0].notes[0], 'Synthetic notes remain');
  assert.equal(restored[0].interactions.length, 1);
  assert.equal(restored[0].followUpHistory[0].id, 'completed-1');
});

test('new optional phone survives local normalization and encrypted-backup snapshot preparation', () => {
  const current = { ...fakePerson(), phone: '+1 212 555 0101' };
  const restored = normalized.decodeStoredPeople(JSON.stringify([current]));
  assert.equal(restored[0].phone, current.phone);
  const snapshot = snapshots.prepareInMemoryBackupSnapshot({
    owner,
    people: restored,
    createdAt: '2026-11-05T10:00:00.000Z',
  });
  const reread = snapshots.validateDecryptedBackupSnapshot(snapshot);
  assert.equal(reread.people[0].phone, current.phone);
  assert.equal(reread.people[0].notes[0], current.notes[0]);
  assert.equal(reread.people[0].interactions[0].summary, 'Synthetic test meeting');
});

test('invalid stored phone type fails closed, instead of silently dropping or overwriting records', () => {
  assert.throws(() => normalized.decodeStoredPeople(
    JSON.stringify([{ ...fakePerson(), phone: { secret: 'wrong format' } }]),
  ), /unsupported or invalid format/);
  assert.throws(() => normalized.decodeStoredPeople(
    JSON.stringify([{ ...fakePerson(), phone: '1'.repeat(80) }]),
  ), /unsupported or invalid format/);
});

test('UI distinguishes ordinary phone from encrypted Private Vault that is not implemented', () => {
  const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
  assert.ok(app.includes('PHONE (STANDARD ONLY)'));
  assert.ok(app.includes('Encrypted Private Vault is being developed'));
  assert.match(app, /phone: selected\.phone \?\? ''/);
  assert.match(app, /phone,\n\s+relationship: form\.relationship/);
  assert.match(app, /normalizeStandardPhone\(form\.phone\)/);
  // We must never implement a fake secret flag and leave it in plaintext AsyncStorage.
  assert.doesNotMatch(app, /secretPhone|privatePhone|confidentialPhone/);
});
