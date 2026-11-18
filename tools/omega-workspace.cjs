'use strict';

// Pure advisory decisions. No files, network, locks, shell or synchronization executor.
const ENVIRONMENTS = ['windows', 'cloud', 'android'];
const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const slug = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(value);
const fresh = (stamp, now) => Number.isSafeInteger(stamp) && Number.isSafeInteger(now)
  && stamp >= 0 && stamp <= now && now - stamp <= 120000;
const workspaceBranch = value => value === 'development/omega-commercial-mvp'
  || typeof value === 'string' && /^omega\/(windows|cloud|android)\/[a-z][a-z0-9-]{0,39}$/.test(value);

function safeOwnedPath(value) {
  if (typeof value !== 'string' || value.length > 200 || !/^[a-zA-Z0-9._/-]+$/.test(value)) return false;
  const parts = value.split('/');
  return parts.every(p => p && p !== '.' && p !== '..' && !p.endsWith('.')
    && !['.git', '.aws', '.ssh', '.gnupg'].includes(p.toLowerCase())
    && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)
    && !/^\.env(?:\.|$)/i.test(p) && !/^(auth|credentials|secrets|tokens)\.json$/i.test(p)
    && !/\.(key|pem|p12|pfx|jks|keystore)$/i.test(p));
}

function ownershipPlan(claim) {
  if (!claim || !slug(claim.task) || !ENVIRONMENTS.includes(claim.environment) || !sha(claim.baseSha)
    || claim.branch !== `omega/${claim.environment}/${claim.task}` || !Array.isArray(claim.paths)
    || claim.paths.length < 1 || claim.paths.length > 32 || claim.paths.filter(safeOwnedPath).length !== claim.paths.length)
    return { state: 'invalid', exclusiveLock: false };
  const paths = [...claim.paths].sort();
  if (new Set(paths.map(p => p.toLowerCase())).size !== paths.length) return { state: 'invalid', exclusiveLock: false };
  return { state: 'advisory_only', exclusiveLock: false, task: claim.task,
    environment: claim.environment, branch: claim.branch, baseSha: claim.baseSha, paths };
}

function ownershipConflict(a, b) {
  const left = ownershipPlan(a), right = ownershipPlan(b);
  if (left.state === 'invalid' || right.state === 'invalid' || left.branch === right.branch) return true;
  return left.paths.some(p => right.paths.some(q => {
    const a = p.toLowerCase(), b = q.toLowerCase();
    return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
  }));
}

function syncPlan(input, now = Date.now()) {
  const result = state => ({ state, executorEnabled: false });
  if (!input || !workspaceBranch(input.branch)) return result('blocked_branch');
  if (input.worktreeClean === false) return result('preserve_dirty_worktree');
  if (input.worktreeClean !== true || !sha(input.localHead)) return result('unverified_local_state');
  if (input.online === false) return result('offline_preserve_checkpoint');
  if (input.online !== true || !fresh(input.remoteObservedAt, now) || !sha(input.remoteHead)
    || input.remoteBranch !== input.branch) return result('unverified_remote_state');
  if (input.localHead === input.remoteHead) return result('in_sync');
  if (input.relation === 'remote_ancestor') return result('review_checkpoint_push');
  if (input.relation === 'local_ancestor') return result('review_fast_forward_only');
  if (input.relation === 'diverged') return result('diverged_isolate_and_review');
  return result('unverified_ancestry');
}

function projectWorkspace(evidence, repository, now = Date.now(), runtimePlatform = process.platform) {
  const declarationFresh = fresh(evidence?.observedAt, now);
  const s = evidence?.sync;
  return {
    runtimePlatform: ['win32', 'linux', 'darwin', 'android'].includes(runtimePlatform) ? runtimePlatform : 'unknown',
    declaredEnvironment: declarationFresh && ENVIRONMENTS.includes(evidence?.environment) ? evidence.environment : 'unknown',
    declarationVerified: false, // The collector must establish provenance; stdin is not authentication.
    task: declarationFresh && slug(evidence?.task) ? evidence.task : null,
    ownership: declarationFresh ? ownershipPlan(evidence?.ownership) : { state: 'invalid', exclusiveLock: false },
    quotaScopes: { hostAccount: 'separate_official_observation', cloudSpecific: 'unobserved', androidSpecific: 'unobserved' },
    synchronization: syncPlan({ branch: repository?.branch, localHead: repository?.head,
      worktreeClean: repository?.dirty === false ? true : repository?.dirty === true ? false : null,
      online: s?.online, remoteHead: s?.remoteHead, remoteBranch: s?.remoteBranch,
      remoteObservedAt: s?.observedAt, relation: s?.relation }, now),
  };
}

module.exports = { workspaceBranch, ownershipPlan, ownershipConflict, syncPlan, projectWorkspace };
