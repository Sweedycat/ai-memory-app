const test = require('node:test');
const assert = require('node:assert/strict');
const { ownershipPlan, ownershipConflict, syncPlan, projectWorkspace, workspaceBranch } = require('../tools/omega-workspace.cjs');
const head = 'a'.repeat(40), remote = 'b'.repeat(40), now = 1795000000000;
const facts = () => ({ branch: 'development/omega-commercial-mvp', localHead: head, remoteHead: head,
  remoteBranch: 'development/omega-commercial-mvp', worktreeClean: true, online: true, remoteObservedAt: now - 1000 });
const claim = (environment = 'windows', paths = ['tools/omega-workspace.cjs']) => ({
  task: 'synthetic-task', environment, branch: `omega/${environment}/synthetic-task`, baseSha: head, paths });

test('dirty, offline and unverified environments never receive an automatic sync instruction', () => {
  assert.equal(syncPlan({ ...facts(), worktreeClean: false }, now).state, 'preserve_dirty_worktree');
  assert.equal(syncPlan({ ...facts(), online: false }, now).state, 'offline_preserve_checkpoint');
  assert.equal(syncPlan({ ...facts(), worktreeClean: null }, now).state, 'unverified_local_state');
  assert.equal(syncPlan({ ...facts(), remoteObservedAt: now - 120001 }, now).state, 'unverified_remote_state');
  assert.equal(syncPlan({ ...facts(), remoteObservedAt: now + 1 }, now).state, 'unverified_remote_state');
});
test('remote evidence must match the selected branch, full SHA and actual online observation', () => {
  for (const patch of [{ remoteBranch: 'main' }, { remoteHead: 'short' }, { online: null }, { localHead: null }])
    assert.notEqual(syncPlan({ ...facts(), ...patch }, now).state, 'in_sync');
  assert.equal(syncPlan(facts(), now).state, 'in_sync');
});
test('ahead, behind and diverged histories are proposals only; unsupported ancestry remains unknown', () => {
  for (const [relation, state] of [['remote_ancestor', 'review_checkpoint_push'], ['local_ancestor', 'review_fast_forward_only'],
    ['diverged', 'diverged_isolate_and_review'], ['invented', 'unverified_ancestry']]) {
    const plan = syncPlan({ ...facts(), remoteHead: remote, relation }, now);
    assert.deepEqual(plan, { state, executorEnabled: false });
  }
});
test('protected, detached, arbitrary and injected branches never enter the proposed sync path', () => {
  for (const branch of ['main', 'preview', 'HEAD', 'other', 'omega/cloud/../main', 'omega/cloud/x;command']) {
    assert.equal(workspaceBranch(branch), false); assert.equal(syncPlan({ ...facts(), branch }, now).state, 'blocked_branch');
  }
  assert.equal(workspaceBranch('omega/cloud/synthetic-task'), true);
});
test('ownership records are bounded advisory declarations, never exclusive or expiring locks', () => {
  const plan = ownershipPlan(claim());
  assert.equal(plan.state, 'advisory_only'); assert.equal(plan.exclusiveLock, false);
  for (const patch of [{ branch: 'main' }, { environment: 'unknown' }, { baseSha: 'short' }, { paths: [] },
    { task: 'Private user@example.com' }, { paths: new Array(33).fill('src') }]) assert.equal(ownershipPlan({ ...claim(), ...patch }).state, 'invalid');
});
test('ownership rejects traversal, sensitive locations and cross-platform ambiguous paths', () => {
  for (const value of ['../src', '/absolute', 'C:/private', 'src\\file', '.git/config', '.ssh/id_ed25519',
    '.env', '.env.local', 'src/../other', 'src//file', 'src/NUL.txt', 'src/file.', 'auth.json', 'private.key'])
    assert.equal(ownershipPlan(claim('cloud', [value])).state, 'invalid', value);
  assert.equal(ownershipPlan(claim('cloud', ['docs/Guide.md', 'docs/guide.md'])).state, 'invalid');
  assert.equal(ownershipPlan(claim('cloud', new Array(1))).state, 'invalid');
  assert.deepEqual(ownershipPlan(claim('cloud', ['src/CaseSensitive.ts'])).paths, ['src/CaseSensitive.ts']);
});
test('cross-environment ownership detects same file/directory overlaps and shared task branches', () => {
  assert.equal(ownershipConflict(claim('windows', ['src']), claim('cloud', ['src/utils/file.ts'])), true);
  assert.equal(ownershipConflict(claim('windows', ['src/File.ts']), claim('android', ['src/file.ts'])), true);
  assert.equal(ownershipConflict(claim('windows', ['src']), claim('windows', ['docs'])), true);
  assert.equal(ownershipConflict(claim('windows', ['src']), claim('cloud', ['docs'])), false);
  assert.equal(ownershipConflict(null, claim()), true);
});
test('environment declarations expire; platform alone cannot identify Cloud, tasks or quota allocations', () => {
  const repo = { branch: 'development/omega-commercial-mvp', head, dirty: false };
  const raw = { observedAt: now, environment: 'cloud', task: 'synthetic-task', privateId: 'PRIVATE-CANARY',
    ownership: claim('cloud'), sync: { ...facts(), observedAt: now } };
  const result = projectWorkspace(raw, repo, now, 'linux');
  assert.equal(result.declaredEnvironment, 'cloud'); assert.equal(result.declarationVerified, false);
  assert.equal(result.quotaScopes.cloudSpecific, 'unobserved'); assert.equal(result.synchronization.state, 'in_sync');
  assert.equal(JSON.stringify(result).includes('PRIVATE-CANARY'), false);
  assert.equal(projectWorkspace(raw, repo, now + 120001, 'linux').declaredEnvironment, 'unknown');
  assert.equal(projectWorkspace({}, repo, now, 'linux').declaredEnvironment, 'unknown');
});
