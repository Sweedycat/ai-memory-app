const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadUtility(relative, resolve) {
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { module: { exports: {} }, require: resolve };
  context.exports = context.module.exports;
  vm.runInNewContext(compiled, context);
  return context.module.exports;
}

const normalize = loadUtility('src/utils/normalizeStoredPeople.ts', () => {
  throw new Error('normalizeStoredPeople is not expected to import at runtime');
});
const {
  prepareInMemoryBackupSnapshot,
  validateDecryptedBackupSnapshot,
  planRestoreForReview,
  BACKUP_SNAPSHOT_KIND,
  BACKUP_SNAPSHOT_VERSION,
} = loadUtility('src/utils/backupSnapshot.ts', (id) => {
  if (id === './normalizeStoredPeople') return normalize;
  throw new Error('Unexpected dependency: ' + id);
});

const sourcePerson = () => ({
  id: 'person-01',
  name: 'Synthetic Example',
  role: 'Tester',
  company: 'Sample Co',
  relationship: 'Demo only',
  lastInteraction: '2026-11-04T09:00:00.000Z',
  notes: ['Fake note 1', 'Fake note 2'],
  interactions: [{ id: 'int-01', date: '2026-11-04T09:00:00.000Z',
    summary: 'Synthetic check', source: 'manual' }],
  followUp: { id: 'follow-01', text: 'Test future reminder',
    createdAt: '2026-11-04T09:00:00.000Z', reminderAt: '2026-11-05T09:00:00.000Z',
    notificationId: 'device-specific-id' },
  followUpHistory: [{ id: 'follow-old', text: 'Completed test',
    createdAt: '2026-11-03T09:00:00.000Z', completedAt: '2026-11-03T09:01:00.000Z',
    notificationId: 'legacy-device-id' }],
});

const owner = () => ({ name: 'Synthetic Owner', preferredName: 'Tester', role: 'QA' });
const makeSnapshot = (person = sourcePerson()) => ({
  kind: BACKUP_SNAPSHOT_KIND,
  version: BACKUP_SNAPSHOT_VERSION,
  createdAt: '2026-11-04T10:00:00.000Z',
  owner: owner(),
  people: [person],
});

test('in-memory portable snapshot strips old phone notification IDs but preserves source records', () => {
  const person = sourcePerson();
  const original = JSON.stringify(person);
  const snapshot = prepareInMemoryBackupSnapshot({
    owner: owner(),
    people: [person],
    createdAt: '2026-11-04T10:00:00.000Z',
  });

  assert.equal(snapshot.kind, BACKUP_SNAPSHOT_KIND);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.people.length, 1);
  assert.equal(snapshot.people[0].followUp.notificationId, undefined);
  assert.equal(snapshot.people[0].followUpHistory[0].notificationId, undefined);
  assert.equal(snapshot.people[0].notes[0], 'Fake note 1');
  assert.equal(snapshot.people[0].interactions[0].summary, 'Synthetic check');
  assert.equal(JSON.stringify(person), original, 'source data must not be changed');
});

test('restore plan is explicitly review-only and leaves local data untouched', () => {
  const current = sourcePerson();
  const original = JSON.stringify(current);
  const review = planRestoreForReview(makeSnapshot(), [current]);
  assert.equal(review.status, 'review-required');
  assert.equal(review.incomingPeople, 1);
  assert.equal(review.existingPeople, 1);
  assert.equal(review.matchingPersonIds, 1);
  assert.equal(review.requiresReminderRescheduling, true);
  assert.equal(review.candidatePeople[0].followUp.notificationId, undefined);
  review.candidatePeople[0].notes[0] = 'changed candidate';
  assert.equal(JSON.stringify(current), original, 'current dataset must remain intact');
});

test('unsupported backup version and invalid owner fail before any restore plan', () => {
  assert.throws(() => validateDecryptedBackupSnapshot({ ...makeSnapshot(), version: 2 }), /unsupported/);
  assert.throws(() => validateDecryptedBackupSnapshot({ ...makeSnapshot(), owner: null }), /owner/);
  assert.throws(() => validateDecryptedBackupSnapshot({ ...makeSnapshot(), createdAt: 'unknown' }), /unsupported/);
});

test('corrupt records and duplicate identities reject the entire snapshot', () => {
  assert.throws(() => validateDecryptedBackupSnapshot({
    ...makeSnapshot(), people: [{ ...sourcePerson(), notes: null }],
  }), /validation/);
  assert.throws(() => validateDecryptedBackupSnapshot({
    ...makeSnapshot(), people: [sourcePerson(), sourcePerson()],
  }), /duplicated person/);
  assert.throws(() => validateDecryptedBackupSnapshot({
    ...makeSnapshot(), people: [{ ...sourcePerson(),
      interactions: [{ id: 'same', date: '2026-11-04T09:00:00Z', summary: 'a', source: 'manual' },
        { id: 'same', date: '2026-11-04T09:01:00Z', summary: 'b', source: 'manual' }] }],
  }), /duplicated interaction/);
  assert.throws(() => validateDecryptedBackupSnapshot({
    ...makeSnapshot(), people: [{ ...sourcePerson(), followUp: 'old text only' }],
  }), /unsupported legacy/);
});

test('snapshot limits reject oversized and invalid data', () => {
  assert.throws(() => validateDecryptedBackupSnapshot({
    ...makeSnapshot(), people: [{ ...sourcePerson(), notes: ['x'.repeat(8_000_010)] }],
  }), /exceeds/);
  assert.throws(() => validateDecryptedBackupSnapshot({
    ...makeSnapshot(), people: 'not an array',
  }), /people list/);
});

test('source contains no cloud, network, file, or device-storage side effects', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/utils/backupSnapshot.ts'), 'utf8');
  assert.doesNotMatch(src, /from ['"](?:expo-file-system|@react-native-async-storage\/async-storage|expo-secure-store)['"]/);
  assert.doesNotMatch(src, /fetch\s*\(|XMLHttpRequest|Share\.share\s*\(/);
});
