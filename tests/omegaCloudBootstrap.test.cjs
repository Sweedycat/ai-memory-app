'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { BRANCH, URL, parseArgs, safeTaskBranch, validOrigin, createGitRunner, main } = require('../tools/omega-cloud-bootstrap.cjs');

const expected = 'a'.repeat(40), other = 'b'.repeat(40), canary = 'SYNTHETIC-PRIVATE-CANARY';
const ref = `refs/heads/${BRANCH}`;
const ok = output => ({ status: 0, output });

function fixture(t, patch = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-bootstrap-test-'));
  fs.mkdirSync(path.join(root, '.git'));
  fs.writeFileSync(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/work\n');
  t.after(() => {
    // Bound recursive cleanup to this test's freshly created direct temp child.
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.match(path.basename(root), /^omega-bootstrap-test-/);
    fs.rmSync(root, { recursive: true, force: true });
  });
  const manifest = { name: 'ai-memory-app', version: '0.0.2', dependencies: { synthetic: '1.0.0' } };
  const lock = { ...manifest, lockfileVersion: 3, packages: { '': manifest, 'node_modules/synthetic': { version: '1.0.0' } } };
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify(lock));
  const state = { head: expected, branch: 'work', dirty: false, origin: URL, remote: expected,
    fetched: expected, statusReads: 0, ...patch };
  const calls = [];
  const git = (args, options) => {
    calls.push({ args, options });
    const custom = state.override?.(args, state, calls);
    if (custom) return custom;
    switch (args[0]) {
      case 'rev-parse':
        if (args[1] === '--show-toplevel') return ok(root);
        if (args[1] === '--git-path') return ok(path.join(root, '.git', 'hooks'));
        return ok(args[2] === 'HEAD' ? state.head : state.fetched);
      case 'status': state.statusReads++; return ok(state.dirty ? `?? ${canary}` : '');
      case 'symbolic-ref': return { status: state.branch === null ? 1 : 0, output: state.branch || '' };
      case 'config': return args[1] === '--get-all' ? ok(state.origin) : { status: 1, output: '' };
      case 'ls-remote': return ok(`${state.remote}\t${ref}`);
      case 'fetch': return ok('');
      case 'switch': state.head = args[2]; state.branch = null; return ok('');
      default: throw new Error(`Unexpected synthetic command: ${args[0]}`);
    }
  };
  const run = (args = ['--expected-sha', expected], extra = {}) => main(args, { cwd: root, nodeVersion: '22.1.0', git, ...extra });
  return { root, state, calls, manifest, lock, git, run };
}

function blocked(result, code) {
  assert.equal(result.exitCode, 1, result.output);
  assert.equal(JSON.parse(result.output).code, code);
  assert.equal(result.output.includes(canary), false);
}

test('CLI requires an explicit full SHA and rejects arbitrary commands, URLs and duplicate flags', () => {
  for (const args of [[], ['--expected-sha', 'aaaa'], ['--expected-sha', expected, '--url', canary],
    ['--expected-sha', expected, '--detach', '--detach'], ['--expected-sha', expected, '--expected-sha', expected],
    ['--expected-sha', expected.toUpperCase()], ['--help', '--detach']]) assert.equal(main(args).exitCode, 1);
  assert.deepEqual(parseArgs(['--expected-sha', expected]), { detach: false, expectedSha: expected });
  assert.equal(main(['--help']).exitCode, 0);
});

test('safe platform task branches are broader than the separate ownership advisory schema', () => {
  for (const branch of ['work', BRANCH, 'task/cloud-initial', 'codex/source', 'omega/cloud/source']) assert.equal(safeTaskBranch(branch), true);
  for (const branch of ['main', 'preview', 'MAIN', 'HEAD', '-work', 'task/../main', 'a//b', 'work.lock', 'a;b', 'a@{b}', 'a\\b', ''])
    assert.equal(safeTaskBranch(branch), false, branch);
});

test('origin identity only admits the exact approved repository without embedded credentials or extra URL components', () => {
  assert.equal(validOrigin(URL), true);
  assert.equal(validOrigin('git@github.com:Sweedycat/ai-memory-app.git'), true);
  for (const value of ['https://github.com/other/ai-memory-app.git', URL + '?token=' + canary,
    'https://user:password@github.com/Sweedycat/ai-memory-app.git', URL + '/extra', 'file:///tmp/repository'])
    assert.equal(validOrigin(value), false);
});

test('verified work branch is preserved; dependency installation is instructions only', t => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.exitCode, 0, result.output);
  const output = JSON.parse(result.output);
  assert.equal(output.state, 'source_verified');
  assert.equal(output.taskBranch, 'work');
  assert.equal(output.selectedDetached, false);
  assert.equal(output.installedDependencies, 'unverified');
  assert.equal(output.ownership, 'advisory_only_see_omega_workspace');
  assert.equal(output.dependencyInstructions.outerProcessTimeoutMs, 120000);
  assert.equal(output.dependencyInstructions.requiresTaskScopedAuthorization, true);
  assert.equal(f.calls.some(c => ['fetch', 'switch', 'npm'].includes(c.args[0])), false);
  assert.deepEqual(f.calls.find(c => c.args[0] === 'ls-remote'), {
    args: ['ls-remote', '--exit-code', '--refs', URL, ref], options: { timeout: 20000 } });
});

test('Node 22 is checked before Git; a nested cwd is rejected before remote access', t => {
  const f = fixture(t);
  blocked(f.run(undefined, { nodeVersion: '24.19.0' }), 'node_version');
  assert.equal(f.calls.length, 0);
  const nested = path.join(f.root, 'nested'); fs.mkdirSync(nested);
  blocked(f.run(undefined, { cwd: nested }), 'git_layout');
  assert.equal(f.calls.length, 0);
});

test('dirty trees fail before any network or mutation without exposing changed paths', t => {
  const f = fixture(t, { dirty: true });
  blocked(f.run(['--expected-sha', expected, '--detach']), 'dirty_worktree');
  assert.equal(f.calls.some(c => ['fetch', 'switch', 'ls-remote'].includes(c.args[0])), false);
});

test('main and preview stay protected even when explicit detach is requested', t => {
  for (const branch of ['main', 'preview']) {
    const f = fixture(t, { branch, head: other });
    blocked(f.run(['--expected-sha', expected, '--detach']), 'protected_branch');
    assert.equal(f.calls.some(c => ['fetch', 'switch', 'ls-remote'].includes(c.args[0])), false);
  }
});

test('unapproved origins and Git URL rewriting are blocked before contacting a remote', t => {
  const f = fixture(t, { origin: `https://${canary}@example.invalid/repo` });
  blocked(f.run(), 'origin_identity');
  f.state.origin = URL;
  f.state.override = args => args[0] === 'config' && args[1] === '--get-regexp' ? ok(canary) : null;
  blocked(f.run(), 'url_rewrite');
  assert.equal(f.calls.some(c => c.args[0] === 'ls-remote'), false);
});

test('different HEAD defaults to a concrete non-mutating source-selection blocker', t => {
  const f = fixture(t, { head: other });
  blocked(f.run(), 'source_selection_required');
  assert.equal(f.calls.some(c => ['fetch', 'switch', 'ls-remote'].includes(c.args[0])), false);
});

test('detached checkout already at expected SHA is preserved', t => {
  const f = fixture(t, { branch: null });
  assert.equal(f.run().exitCode, 0);
  assert.equal(f.calls.some(c => ['fetch', 'switch'].includes(c.args[0])), false);
});

test('remote SHA mismatch or ambiguous output never causes a fetch or switch', t => {
  const f = fixture(t, { head: other, remote: other });
  blocked(f.run(['--expected-sha', expected, '--detach']), 'remote_sha');
  assert.equal(f.calls.some(c => ['fetch', 'switch'].includes(c.args[0])), false);
});

test('explicit initial selection uses one bounded single-branch fetch and detached switch with no force/reset/merge', t => {
  const f = fixture(t, { head: other });
  const result = f.run(['--expected-sha', expected, '--detach']);
  assert.equal(result.exitCode, 0, result.output);
  assert.equal(JSON.parse(result.output).selectedDetached, true);
  assert.equal(f.state.branch, null);
  assert.deepEqual(f.calls.filter(c => c.args[0] === 'fetch'), [{ args: ['fetch', '--no-tags', '--depth=1',
    '--no-recurse-submodules', '--no-auto-maintenance', URL, ref], options: { timeout: 30000 } }]);
  const index = f.calls.findIndex(c => c.args[0] === 'switch');
  assert.deepEqual(f.calls[index].args, ['switch', '--detach', expected, '--']);
  assert.deepEqual(f.calls.slice(index - 3, index).map(c => c.args[0]), ['status', 'rev-parse', 'symbolic-ref']);
  assert.equal(f.calls.some(c => c.args.some(a => ['--force', 'reset', 'merge', 'push', 'clean'].includes(a))), false);
});

test('moving remote during fetch is detected before switch', t => {
  const f = fixture(t, { head: other, fetched: other });
  blocked(f.run(['--expected-sha', expected, '--detach']), 'fetch_sha');
  assert.equal(f.calls.some(c => c.args[0] === 'switch'), false);
  assert.equal(f.state.head, other);
});

test('concurrent dirtiness, HEAD movement or branch movement aborts before a switch', t => {
  for (const mutation of [s => { s.dirty = true; }, s => { s.head = 'c'.repeat(40); }, s => { s.branch = 'work/changed'; }]) {
    const f = fixture(t, { head: other, override(args, state) { if (args[0] === 'fetch') mutation(state); } });
    const result = f.run(['--expected-sha', expected, '--detach']);
    blocked(result, f.state.dirty ? 'dirty_worktree' : 'source_changed');
    assert.equal(f.calls.some(c => c.args[0] === 'switch'), false);
  }
});

test('post-selection dirty tree or unexpected HEAD fails without attempting recovery or reset', t => {
  const f = fixture(t, { head: other, override(args, state) {
    if (args[0] === 'switch') { state.head = other; state.branch = null; return ok(''); }
  } });
  blocked(f.run(['--expected-sha', expected, '--detach']), 'postcheck');
  assert.equal(f.calls.filter(c => c.args[0] === 'switch').length, 1);
});

test('missing, malformed or stale package locks block preflight without printing package contents', t => {
  const f = fixture(t);
  const lockPath = path.join(f.root, 'package-lock.json');
  for (const content of [canary, JSON.stringify({ ...f.lock, version: '9.9.9' }),
    JSON.stringify({ ...f.lock, packages: { '': { ...f.manifest, dependencies: { synthetic: '2.0.0' } } } }),
    JSON.stringify({ ...f.lock, packages: { '': f.manifest } })]) {
    fs.writeFileSync(lockPath, content);
    blocked(f.run(), 'manifest_lock');
  }
  assert.equal(f.calls.some(c => c.args[0] === 'ls-remote'), false);
});

test('subprocess execution uses shell false, bounded buffers/timeouts and redacts every failure', t => {
  let invocation;
  const git = createGitRunner(os.tmpdir(), (command, args, options) => {
    invocation = { command, args, options };
    return { status: 1, stdout: canary, stderr: canary, error: new Error(canary) };
  });
  assert.throws(() => git(['ls-remote']), error => !error.message.includes(canary));
  assert.equal(invocation.command, 'git');
  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.options.timeout, 10000);
  assert.equal(invocation.options.maxBuffer, 256 * 1024);
  assert.equal(invocation.options.env.GIT_TERMINAL_PROMPT, '0');
  assert.ok(invocation.args.includes('core.fsmonitor=false'));
  assert.equal(invocation.args.some(arg => arg.startsWith('core.hooksPath=')), false);
  const f = fixture(t, { override() { throw new Error(canary); } });
  blocked(f.run(), 'preflight_failed');
  for (const result of [{ status: null, signal: 'SIGKILL', stderr: canary }, { status: 128, stderr: canary },
    { status: 0, error: new Error(canary) }]) {
    const runner = createGitRunner(os.tmpdir(), () => result);
    assert.throws(() => runner(['status']), error => !error.message.includes(canary));
  }
});

test('content filter helpers are disabled per invocation using names only; Git and Omega hooks are not bypassed', () => {
  const invocations = [];
  const runner = createGitRunner(os.tmpdir(), (command, args, options) => {
    invocations.push({ command, args, options });
    if (args.includes('--name-only')) return { status: 0, stdout: 'filter.synthetic.clean\0filter.synthetic.smudge\0filter.synthetic.process\0' };
    return { status: 0, stdout: '' };
  });
  runner(['status', '--porcelain=v1']);
  assert.equal(invocations.length, 2);
  assert.ok(invocations[0].args.includes('--name-only'));
  for (const value of ['filter.synthetic.clean=', 'filter.synthetic.smudge=', 'filter.synthetic.process=', 'filter.synthetic.required=false'])
    assert.ok(invocations[1].args.includes(value));
  assert.ok(invocations[1].args.includes('core.fsmonitor=false'));
  assert.equal(invocations[1].args.some(arg => arg.startsWith('core.hooksPath=')), false);
  const invalid = createGitRunner(os.tmpdir(), () => ({ status: 0, stdout: 'filter.unsafe;command.clean\0' }));
  assert.throws(() => invalid(['status']), error => error.code === 'git_filters');
});

test('configured lifecycle hooks and existing checkout/index/reference hooks block before status, network or mutations', t => {
  for (const name of ['post-checkout', 'post-index-change', 'reference-transaction', 'pre-auto-gc']) {
    const f = fixture(t);
    fs.mkdirSync(path.join(f.root, '.git', 'hooks'));
    fs.writeFileSync(path.join(f.root, '.git', 'hooks', name), canary);
    blocked(f.run(['--expected-sha', expected, '--detach']), 'git_hooks');
    assert.equal(f.calls.some(c => ['status', 'ls-remote', 'fetch', 'switch'].includes(c.args[0])), false);
  }
  const f = fixture(t, { override: args => args[0] === 'config' && args[2] === 'core.hooksPath' ? ok(canary) : null });
  blocked(f.run(), 'git_hooks');
});

test('a lifecycle hook appearing during network verification prevents source selection', t => {
  const f = fixture(t, { head: other, override(args) {
    if (args[0] === 'ls-remote') {
      fs.mkdirSync(path.join(f.root, '.git', 'hooks'));
      fs.writeFileSync(path.join(f.root, '.git', 'hooks', 'post-checkout'), canary);
    }
  } });
  blocked(f.run(['--expected-sha', expected, '--detach']), 'git_hooks');
  assert.equal(f.calls.some(c => ['fetch', 'switch'].includes(c.args[0])), false);
});

test('unvalidated Git metadata redirection is blocked before Git execution', t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.root, '.git', 'HEAD'));
  fs.rmdirSync(path.join(f.root, '.git'));
  fs.writeFileSync(path.join(f.root, '.git'), 'gitdir: missing-synthetic-admin\n');
  blocked(f.run(), 'git_layout');
  assert.equal(f.calls.length, 0);
});

test('verified modules loaded from a separate temporary directory operate on cwd rather than their own location', t => {
  const target = fixture(t), isolated = fixture(t);
  for (const name of ['omega-cloud-bootstrap.cjs', 'omega-paths.cjs'])
    fs.copyFileSync(path.join(__dirname, '..', 'tools', name), path.join(isolated.root, name));
  const standalone = require(path.join(isolated.root, 'omega-cloud-bootstrap.cjs'));
  const result = standalone.main(['--expected-sha', expected], { cwd: target.root, nodeVersion: '22.1.0', git: target.git });
  assert.equal(result.exitCode, 0, result.output);
  assert.equal(JSON.parse(result.output).taskBranch, 'work');
  assert.equal(isolated.calls.length, 0);
});

test('oversize manifests fail before network even when an injected reader supplies valid fabricated content', t => {
  for (const [name, limit] of [['package.json', 128 * 1024], ['package-lock.json', 2 * 1024 * 1024]]) {
    const f = fixture(t);
    const file = path.join(f.root, name);
    const fd = fs.openSync(file, 'w');
    try { fs.ftruncateSync(fd, limit + 1); } finally { fs.closeSync(fd); }
    let injectedReads = 0;
    blocked(f.run(undefined, { readFile() { injectedReads++; return JSON.stringify(name === 'package.json' ? f.manifest : f.lock); } }), 'manifest_lock');
    assert.equal(injectedReads, 0);
    assert.equal(f.calls.some(c => ['ls-remote', 'fetch', 'switch'].includes(c.args[0])), false);
  }
});

test('ordinary manifest files are accepted at their exact bounded size limits', t => {
  const f = fixture(t);
  for (const [name, value, limit] of [['package.json', f.manifest, 128 * 1024], ['package-lock.json', f.lock, 2 * 1024 * 1024]]) {
    const content = JSON.stringify(value);
    fs.writeFileSync(path.join(f.root, name), content + ' '.repeat(limit - Buffer.byteLength(content)));
  }
  assert.equal(f.run().exitCode, 0);
});

test('nonordinary manifest directories and junctions are rejected before network', t => {
  for (const junction of [false, true]) {
    const f = fixture(t), outside = fixture(t);
    const file = path.join(f.root, 'package.json');
    fs.unlinkSync(file);
    if (junction) fs.symlinkSync(outside.root, file, 'junction');
    else fs.mkdirSync(file);
    blocked(f.run(), 'manifest_lock');
    assert.equal(f.calls.some(c => ['ls-remote', 'fetch', 'switch'].includes(c.args[0])), false);
  }
});

test('manifest file symlinks are rejected before network', t => {
  const f = fixture(t), outside = fixture(t);
  const file = path.join(f.root, 'package-lock.json');
  fs.unlinkSync(file);
  try { fs.symlinkSync(path.join(outside.root, 'package-lock.json'), file, 'file'); }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('Host does not permit synthetic file symlink creation.'); return; }
    throw error;
  }
  blocked(f.run(), 'manifest_lock');
  assert.equal(f.calls.some(c => ['ls-remote', 'fetch', 'switch'].includes(c.args[0])), false);
});

test('a special FIFO manifest is rejected without opening it', { skip: process.platform === 'win32' ? 'FIFO files are unavailable on Windows.' : false }, t => {
  const f = fixture(t), file = path.join(f.root, 'package-lock.json');
  fs.unlinkSync(file);
  const created = spawnSync('mkfifo', [file], { shell: false, timeout: 5000, stdio: 'ignore' });
  if (created.error?.code === 'ENOENT') { t.skip('Host does not provide mkfifo for a synthetic FIFO fixture.'); return; }
  assert.equal(created.status, 0);
  blocked(f.run(), 'manifest_lock');
  assert.equal(f.calls.some(c => ['ls-remote', 'fetch', 'switch'].includes(c.args[0])), false);
});

test('ambient global and URL-scoped HTTP/credential keys block each Git network operation without value inspection', () => {
  for (const key of ['http.extraHeader', 'http.cookieFile', 'http.sslCert', 'http.sslKey', 'http.sslCertPasswordProtected',
    'http.proxy', 'http.proxyAuthMethod', 'http.unknownAuthSetting', 'http.https://github.com/.extraHeader',
    'HTTP.https://github.com/Sweedycat/.sslKey', 'http.https://github.com/.proxySSLCertPasswordProtected',
    'credential.username', 'credential.https://github.com.helper']) {
    for (const command of ['ls-remote', 'fetch']) {
      const calls = [];
      const runner = createGitRunner(os.tmpdir(), (executable, args) => {
        calls.push(args);
        assert.ok(args.includes('--name-only'), 'Only names-only config inspection may execute.');
        return { status: 0, stdout: `${key}\0` };
      });
      assert.throws(() => runner([command, URL, ref]), error => error.code === 'git_network_auth'
        && !error.message.includes(key) && !error.message.includes(canary));
      assert.equal(calls.length, 1);
      assert.equal(calls[0].includes('--get'), false);
    }
  }
});

test('the fixed public HTTPS path still permits its forced safe config and rejects newly appearing auth before fetch', () => {
  const calls = [];
  let authAppeared = false;
  const runner = createGitRunner(os.tmpdir(), (executable, args) => {
    calls.push(args);
    if (args.includes('--name-only')) return { status: 0, stdout: authAppeared
      ? 'http.cookieFile\0' : 'http.followredirects\0credential.helper\0core.fsmonitor\0' };
    return { status: 0, stdout: '' };
  });
  runner(['ls-remote', '--refs', URL, ref]);
  assert.equal(calls.length, 2);
  authAppeared = true;
  assert.throws(() => runner(['fetch', URL, ref]), error => error.code === 'git_network_auth');
  assert.equal(calls.length, 3);
  assert.equal(calls.filter(args => args.includes('fetch')).length, 0);
});
