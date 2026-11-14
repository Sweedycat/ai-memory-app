const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/utils/restoreAdmission.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = { module: { exports: {} }, require() { throw Error('unexpected runtime import'); } };
context.exports = context.module.exports;
vm.runInNewContext(compiled, context);
const { admitRestoreForStaging } = context.module.exports;

const target = () => ({ workspaceId: 'personal-qa', ownerId: 'owner-qa' });
const review = () => ({
  status: 'review-required',
  createdAt: '2026-11-12T00:00:00Z',
  incomingPeople: 1,
  existingPeople: 2,
  matchingPersonIds: 0,
  requiresReminderRescheduling: false,
  candidatePeople: [{ id: 'synthetic-01' }],
  candidateOwner: { name: 'Synthetic', preferredName: '', role: '' },
});
const valid = () => ({
  review: review(),
  selectedTarget: target(),
  activeTarget: target(),
  backupTarget: target(),
  confirmedTarget: target(),
  userConfirmed: true,
  durableRollbackReady: true,
  activePeopleCount: 2,
});

test('matching confirmed synthetic workspace can enter staging without mutation', () => {
  const input = valid();
  const before = JSON.stringify(input);
  const result = admitRestoreForStaging(input);
  assert.equal(result.approved, true);
  assert.equal(result.expectedIncomingPeople, 1);
  assert.equal(JSON.stringify(input), before);
});

test('cross-workspace, cross-owner and unconfirmed target are rejected', () => {
  for (const field of ['selectedTarget', 'activeTarget', 'backupTarget', 'confirmedTarget']) {
    const input = valid();
    input[field] = { ...target(), workspaceId: 'another-workspace' };
    assert.throws(() => admitRestoreForStaging(input), /mismatch/);
  }
  const input = valid();
  input.backupTarget = { ...target(), ownerId: 'another-owner' };
  assert.throws(() => admitRestoreForStaging(input), /mismatch/);
});

test('missing consent, missing rollback and stale review fail closed', () => {
  for (const patch of [
    { userConfirmed: false },
    { durableRollbackReady: false },
    { activePeopleCount: 3 },
  ]) {
    assert.throws(() => admitRestoreForStaging({ ...valid(), ...patch }));
  }
  const input = valid();
  input.review.incomingPeople = 3;
  assert.throws(() => admitRestoreForStaging(input), /stale/);
});

test('invalid target and malformed review fail closed', () => {
  const input = valid();
  input.activeTarget.ownerId = '../bad';
  assert.throws(() => admitRestoreForStaging(input), /invalid/);
  const other = valid();
  other.review.status = 'ready';
  assert.throws(() => admitRestoreForStaging(other), /stale/);
});

test('admission utility has no storage, network or notification side effects', () => {
  assert.doesNotMatch(source, /AsyncStorage|fetch\s*\(|setItem|removeItem|scheduleNotification|console\./);
});

test('missing candidate array is refused instead of throwing an unsafe property error', () => {
  const input = valid();
  input.review.candidatePeople = null;
  assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
});

test('unsafe and negative existing review counts are rejected', () => {
  for (const count of [-1, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    const input = valid();
    input.review.existingPeople = count;
    input.activePeopleCount = count;
    assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
  }
});

test('invalid overlap count cannot pass restore admission', () => {
  for (const overlap of [-1, 2, 0.5, Infinity]) {
    const input = valid();
    input.review.matchingPersonIds = overlap;
    assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
  }
});

test('missing or malformed reminder rescheduling flag fails closed', () => {
  for (const flag of [undefined, null, 'false']) {
    const input = valid();
    input.review.requiresReminderRescheduling = flag;
    assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
  }
});

test('duplicate and malformed candidate IDs are refused', () => {
  for (const people of [
    [{ id: 'same' }, { id: 'same' }],
    [null],
    [{}],
    [{ id: '' }],
  ]) {
    const input = valid();
    input.review.candidatePeople = people;
    input.review.incomingPeople = people.length;
    assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
  }
});

test('missing review and target objects are rejected explicitly', () => {
  for (const field of ['review', 'selectedTarget', 'activeTarget', 'backupTarget', 'confirmedTarget']) {
    const input = valid();
    input[field] = null;
    assert.throws(() => admitRestoreForStaging(input), /missing/);
  }
});

test('incoming count beyond snapshot limit is rejected', () => {
  const input = valid();
  input.review.incomingPeople = 10_001;
  assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
});

test('existing count beyond snapshot limit is rejected', () => {
  const input = valid();
  input.activePeopleCount = 10_001;
  input.review.existingPeople = 10_001;
  assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
});

test('malformed review timestamp is refused', () => {
  for (const createdAt of [null, 'yesterday', '2026-11-12', '2026-99-99T00:00:00Z']) {
    const input = valid();
    input.review.createdAt = createdAt;
    assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
  }
});

test('malformed reviewed owner profile is refused', () => {
  for (const owner of [null, {}, { name: ' ', preferredName: '', role: '' }, { name: 'A', preferredName: null, role: '' }]) {
    const input = valid();
    input.review.candidateOwner = owner;
    assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
  }
});

test('valid timestamp allows an otherwise approved review', () => {
  assert.equal(admitRestoreForStaging(valid()).approved, true);
});

test('null admission request is rejected explicitly', () => {
  assert.throws(() => admitRestoreForStaging(null), /missing/);
});

test('truthy nonboolean approval and rollback values are refused', () => {
  for (const field of ['userConfirmed', 'durableRollbackReady']) {
    for (const value of [1, 'yes', {}, []]) {
      const input = valid();
      input[field] = value;
      assert.throws(() => admitRestoreForStaging(input), /confirmation/);
    }
  }
});

test('candidate count is bounded independently of metadata', () => {
  const input = valid();
  input.review.candidatePeople = Array.from({ length: 10001 }, (_, i) => ({ id: String(i) }));
  input.review.incomingPeople = 10001;
  assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
});

test('unsafe candidate IDs are refused', () => {
  for (const id of ['../bad', 'has spaces', 'a'.repeat(129), 'a/b']) {
    const input = valid();
    input.review.candidatePeople = [{ id }];
    assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
  }
});

test('oversized reviewed owner fields are refused', () => {
  for (const field of ['name', 'preferredName', 'role']) {
    const input = valid();
    input.review.candidateOwner[field] = 'x'.repeat(257);
    assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
  }
});

test('oversized fractional timestamp is refused', () => {
  const input = valid();
  input.review.createdAt = '2026-11-12T00:00:00.' + '1'.repeat(100) + 'Z';
  assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
});

test('timestamp with unsupported timezone grammar is refused', () => {
  for (const createdAt of ['2026-11-12T00:00:00+0000', '2026-11-12 00:00:00Z']) {
    const input = valid();
    input.review.createdAt = createdAt;
    assert.throws(() => admitRestoreForStaging(input), /stale or invalid/);
  }
});

test('valid timezone-offset timestamp is accepted', () => {
  const input = valid();
  input.review.createdAt = '2026-11-12T03:00:00+03:00';
  assert.equal(admitRestoreForStaging(input).approved, true);
});
