'use strict';

// Source selection only. Ownership remains advisory in omega-workspace.cjs.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitLayout, within, bounded, samePath, gitEnvironment } = require('./omega-paths.cjs');

const REPOSITORY = 'Sweedycat/ai-memory-app';
const BRANCH = 'development/omega-commercial-mvp';
const URL = `https://github.com/${REPOSITORY}.git`;
const REF = `refs/heads/${BRANCH}`;
const SHA = /^[0-9a-f]{40}$/;
const HELP = 'Usage: node tools/omega-cloud-bootstrap.cjs --expected-sha <full-40-character-SHA> [--detach]\n'
  + `Verifies ${REPOSITORY} ${BRANCH}. Requires Node 22 and a clean repository root.\n`
  + 'Preserves a safe task branch already at the expected SHA. --detach is only for founder-authorized initial source selection.\n'
  + 'Never installs dependencies. Run the separate dependency step only within task-scoped authorization after source verification.';

class PreflightError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function fail(code, message) { throw new PreflightError(code, message); }

function parseArgs(args) {
  const options = { detach: false };
  if (args.length === 1 && args[0] === '--help') return { help: true };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--expected-sha' && options.expectedSha === undefined) options.expectedSha = args[++i];
    else if (args[i] === '--detach' && !options.detach) options.detach = true;
    else fail('arguments', 'Use --expected-sha with one full SHA and optional --detach; no other arguments are accepted.');
  }
  if (!SHA.test(options.expectedSha || '')) fail('expected_sha', 'An explicit lowercase full 40-character expected SHA is required.');
  return options;
}

function safeTaskBranch(branch) {
  if (branch === BRANCH) return true;
  if (typeof branch !== 'string' || branch.length > 200 || /^(main|preview|HEAD)$/i.test(branch)) return false;
  return branch.split('/').every(part => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part)
    && !part.includes('..') && !part.endsWith('.') && !part.toLowerCase().endsWith('.lock'));
}

function validOrigin(value) {
  return [`https://github.com/${REPOSITORY}`, URL, `git@github.com:${REPOSITORY}.git`,
    `git@github.com:${REPOSITORY}`, `ssh://git@github.com/${REPOSITORY}.git`,
    `ssh://git@github.com/${REPOSITORY}`].includes(value);
}

function createGitRunner(cwd, execute = spawnSync) {
  // Avoid caller GIT_DIR/WORK_TREE/config injection and interactive credential prompts.
  const env = gitEnvironment(cwd);
  const config = ['--no-pager', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'credential.helper=', '-c', 'core.askPass=',
    '-c', 'http.followRedirects=false', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always',
    '-c', 'fetch.recurseSubmodules=false', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false'];
  function invoke(args, timeout, allowMissing = false) {
    let result;
    try {
      result = execute('git', [...config, ...args], { cwd, env, shell: false, windowsHide: true,
        encoding: 'utf8', timeout, killSignal: 'SIGKILL', maxBuffer: 256 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { fail('git_failed', 'Git operation failed; subprocess diagnostics were withheld.'); }
    if (result?.error || result?.signal || (result?.status !== 0 && !(allowMissing && result?.status === 1)))
      fail('git_failed', 'Git operation failed or exceeded its resource limit; subprocess diagnostics were withheld.');
    return { status: result.status, output: String(result.stdout || '') };
  }
  return function git(args, { timeout = 10000, allowMissing = false } = {}) {
    // Read key names only: helper commands/configuration values are never emitted.
    const names = invoke(['config', '--null', '--name-only', '--list'], 10000).output.split('\0').filter(Boolean);
    if (['ls-remote', 'fetch'].includes(args[0]) && names.some(name => {
      const key = name.toLowerCase();
      // The fixed public HTTPS route needs no ambient authentication, cookies,
      // client certificates or proxies. Unknown/scoped HTTP settings fail closed.
      return key.startsWith('http.') && key !== 'http.followredirects'
        || key.startsWith('credential.') && key !== 'credential.helper';
    })) fail('git_network_auth', 'Ambient Git HTTP or credential configuration needs separate review; no network operation was started.');
    const filters = names.filter(name => /^filter\..*\.(clean|smudge|process)$/i.test(name));
    if (filters.length > 32 || filters.some(name => !/^filter\.[a-z0-9._-]{1,100}\.(clean|smudge|process)$/i.test(name)))
      fail('git_filters', 'Git content-filter configuration requires separate review.');
    const overrides = [...new Set(filters.map(name => name.replace(/\.(clean|smudge|process)$/i, '')))].flatMap(name =>
      ['-c', `${name}.clean=`, '-c', `${name}.smudge=`, '-c', `${name}.process=`, '-c', `${name}.required=false`]);
    const result = invoke([...overrides, ...args], timeout, allowMissing);
    return { ...result, output: result.output.trim() };
  };
}

function verifyGitHooks(git, root) {
  const configured = git(['config', '--get', 'core.hooksPath'], { allowMissing: true });
  if (configured.status !== 1) {
    if (configured.output === '/dev/null') return; // Respect an already disabled Git hook configuration.
    fail('git_hooks', 'Configured Git lifecycle hooks need separate review; source selection will not bypass them.');
  }
  const hooks = path.resolve(root, git(['rev-parse', '--git-path', 'hooks']).output);
  try {
    if (fs.existsSync(hooks) && (fs.lstatSync(hooks).isSymbolicLink() || !fs.lstatSync(hooks).isDirectory()))
      fail('git_hooks', 'Git lifecycle hook layout needs separate review.');
    for (const name of ['post-checkout', 'post-index-change', 'reference-transaction', 'pre-auto-gc']) {
      try {
        fs.lstatSync(path.join(hooks, name));
        fail('git_hooks', 'Git lifecycle hooks need separate review; source selection will not bypass them.');
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  } catch (error) {
    if (error instanceof PreflightError) throw error;
    fail('git_hooks', 'Git lifecycle hook inspection failed; diagnostic details were withheld.');
  }
}

function readState(git) {
  const dirty = git(['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none']).output !== '';
  const head = git(['rev-parse', '--verify', 'HEAD']).output;
  const branchResult = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowMissing: true });
  const branch = branchResult.status === 1 ? null : branchResult.output;
  if (dirty) fail('dirty_worktree', 'Worktree has tracked, untracked or submodule changes. Preserve them and rerun from a clean task checkout.');
  if (!SHA.test(head)) fail('invalid_head', 'A verified full HEAD SHA is required.');
  if (branch !== null && !safeTaskBranch(branch))
    fail('protected_branch', 'Protected or unsupported branch. Use a separate approved task checkout.');
  return { head, branch };
}

function verifyUnchanged(git, before, root) {
  verifyGitHooks(git, root);
  const current = readState(git);
  if (current.head !== before.head || current.branch !== before.branch)
    fail('source_changed', 'Source changed during preflight. Preserve concurrent work and rerun.');
}

function verifyManifests(root) {
  let manifest, lock;
  try {
    manifest = JSON.parse(bounded(within(root, 'package.json').absolute, 128 * 1024));
    lock = JSON.parse(bounded(within(root, 'package-lock.json').absolute, 2 * 1024 * 1024));
  } catch { fail('manifest_lock', 'Manifest or package lock is missing or invalid; contents were withheld.'); }
  const locked = lock?.packages?.[''];
  if (!manifest || manifest.name !== 'ai-memory-app' || !locked || lock.lockfileVersion !== 3
    || manifest.name !== lock.name || manifest.version !== lock.version
    || manifest.name !== locked.name || manifest.version !== locked.version)
    fail('manifest_lock', 'Package manifest and lock metadata do not agree.');
  for (const group of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const declared = manifest[group] || {}, recorded = locked[group] || {};
    if (typeof declared !== 'object' || Array.isArray(declared) || typeof recorded !== 'object' || Array.isArray(recorded)
      || Object.keys(declared).length !== Object.keys(recorded).length
      || Object.entries(declared).some(([name, version]) => typeof version !== 'string' || recorded[name] !== version))
      fail('manifest_lock', 'Package manifest and lock dependency declarations do not agree.');
    if (group !== 'peerDependencies' && Object.keys(declared).some(name => !lock.packages[`node_modules/${name}`]))
      fail('manifest_lock', 'A declared dependency is missing from the package lock.');
  }
  return 'matching_root_metadata'; // Not a complete npm dependency-resolution or installed-tree validation.
}

function bootstrap(options, dependencies = {}) {
  if (!options || !SHA.test(options.expectedSha || '') || typeof options.detach !== 'boolean')
    fail('arguments', 'Validated CLI options are required.');
  const version = dependencies.nodeVersion || process.versions.node;
  if (!/^22\./.test(version)) fail('node_version', 'Node 22 is required. Select the approved runtime before rerunning.');
  const cwd = dependencies.cwd || process.cwd();
  try { gitLayout(cwd); } catch { fail('git_layout', 'An ordinary repository or validated reciprocal linked worktree is required.'); }
  const git = dependencies.git || createGitRunner(cwd);
  const root = git(['rev-parse', '--show-toplevel']).output;
  let sameRoot;
  try { sameRoot = samePath(fs.realpathSync(root), fs.realpathSync(cwd)); } catch { sameRoot = false; }
  if (!sameRoot) fail('repository_root', 'Run this command from the actual repository root.');
  verifyGitHooks(git, root);
  const before = readState(git);
  const origins = git(['config', '--get-all', 'remote.origin.url']).output.split(/\r?\n/);
  if (origins.length !== 1 || !validOrigin(origins[0])) fail('origin_identity', 'Origin does not exactly match the approved repository; remote details were withheld.');
  const rewrite = git(['config', '--get-regexp', '^url\\..*\\.(insteadof|pushinsteadof)$'], { allowMissing: true });
  if (rewrite.status !== 1) fail('url_rewrite', 'Git URL rewrite configuration must be reviewed separately before network access.');
  if (before.head !== options.expectedSha && !options.detach)
    fail('source_selection_required', 'HEAD differs from the expected SHA. Preserve this task branch; use a separate checkout or founder-authorized --detach for initial selection.');
  verifyManifests(root);
  const remote = git(['ls-remote', '--exit-code', '--refs', URL, REF], { timeout: 20000 }).output;
  if (remote !== `${options.expectedSha}\t${REF}`)
    fail('remote_sha', 'The approved remote branch does not exactly match the expected SHA. Obtain a current founder-approved full SHA.');
  verifyUnchanged(git, before, root);
  let selected = false;
  if (before.head !== options.expectedSha) {
    git(['fetch', '--no-tags', '--depth=1', '--no-recurse-submodules', '--no-auto-maintenance', URL, REF], { timeout: 30000 });
    if (git(['rev-parse', '--verify', 'FETCH_HEAD^{commit}']).output !== options.expectedSha)
      fail('fetch_sha', 'Fetched branch changed or differs from the expected SHA. No source switch was performed.');
    verifyUnchanged(git, before, root);
    git(['switch', '--detach', options.expectedSha, '--']);
    selected = true;
  }
  const after = readState(git);
  if (after.head !== options.expectedSha || (selected ? after.branch !== null : after.branch !== before.branch))
    fail('postcheck', 'Source verification after selection failed. Stop and inspect the checkout without resetting it.');
  const manifestLock = verifyManifests(root);
  return { state: 'source_verified', repository: REPOSITORY, sourceBranch: BRANCH, expectedSha: options.expectedSha,
    taskBranch: after.branch, selectedDetached: selected, node: '22', manifestLock,
    installedDependencies: 'unverified', ownership: 'advisory_only_see_omega_workspace',
    dependencyInstructions: { requiresTaskScopedAuthorization: true, afterVerifiedSourceOnly: true,
      command: 'npm', args: ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--fetch-retries=0',
        '--fetch-timeout=30000', '--maxsockets=2'], outerProcessTimeoutMs: 120000, automaticRetries: 0,
      note: 'No installation was run. Use an outer process timeout; ignored lifecycle scripts may require separately approved follow-up. Run npm ls and required checks afterward.' } };
}

function main(args = process.argv.slice(2), dependencies = {}) {
  try {
    const options = parseArgs(args);
    return { exitCode: 0, output: options.help ? HELP : JSON.stringify(bootstrap(options, dependencies), null, 2) };
  } catch (error) {
    // Never emit raw subprocess errors, paths, URLs, environment or file contents.
    const known = error instanceof PreflightError;
    return { exitCode: 1, output: JSON.stringify({ state: 'blocked', code: known ? error.code : 'preflight_failed',
      message: known ? error.message : 'Preflight failed; diagnostic details were withheld.' }) };
  }
}

if (require.main === module) {
  const result = main();
  process[result.exitCode ? 'stderr' : 'stdout'].write(result.output + '\n');
  process.exitCode = result.exitCode;
}
module.exports = { BRANCH, REPOSITORY, URL, parseArgs, safeTaskBranch, validOrigin, createGitRunner,
  verifyManifests, bootstrap, main };
