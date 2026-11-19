'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const runtime = require('../tools/omega-runtime.cjs');
const { within, gitLayout, samePath, gitEnvironment } = require('../tools/omega-paths.cjs');
const hooks = require('../.codex/hooks/omega-hooks.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'omega runtime spaces '));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert(path.basename(root).startsWith('omega runtime spaces '));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const git = args => {
    const r = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: root,
      encoding: 'utf8', timeout: 5000, windowsHide: true });
    assert.equal(r.status, 0, 'Synthetic Git command failed');
    return r.stdout.trim();
  };
  git(['init', '-b', 'work']);
  git(['config', 'user.name', 'Synthetic']); git(['config', 'user.email', 'synthetic@example.invalid']);
  git(['remote', 'add', 'origin', 'https://github.com/Sweedycat/ai-memory-app.git']);
  fs.mkdirSync(path.join(root, 'tools')); fs.writeFileSync(path.join(root, 'tools', 'synthetic.cjs'), 'initial\n');
  git(['add', 'tools/synthetic.cjs']); git(['commit', '-m', 'Synthetic baseline']);
  const head = git(['rev-parse', 'HEAD']);
  return { root, git, head, scope: { expectedSha: head, branch: 'work', task: 'phase-four', paths: ['tools/synthetic.cjs'] } };
}

test('runtime plans distinguish native invocation, role-guided delegation and unavailable independent execution', () => {
  assert.equal(runtime.executionPlan().mode, 'PRINCIPAL_ONLY_REVIEW_UNAVAILABLE');
  assert.equal(runtime.executionPlan({ nativeSpecialists: false, delegation: true }).mode, 'B_ROLE_GUIDED_DELEGATION');
  const native = runtime.executionPlan({ nativeSpecialists: true, nativeSkills: true });
  assert.equal(native.mode, 'A_NATIVE_SPECIALIST');
  assert.equal(native.nativeSkills.status, 'VERIFIED');
  assert.equal(native.hookExecution.status, 'UNTESTED');
  assert.equal(native.sensitiveActivationAllowed, false);
  assert.equal(native.selfReviewIsIndependent, false);
  assert.equal(runtime.executionPlan({ nativeSpecialists: 'true' }).nativeSpecialists.status, 'UNTESTED');
  assert.equal(runtime.executionPlan({ quotaTelemetry: false }).quotaTelemetry.status, 'UNSUPPORTED');
});
test('manual loading preserves all twelve skills and eleven roles without claiming native activation', () => {
  assert.equal(runtime.SKILLS.length, 12); assert.equal(runtime.ROLES.length, 11);
  for (const name of runtime.SKILLS) {
    const loaded = runtime.instructions('skill', name);
    assert.equal(loaded.nativeActivation, false);
    assert.equal(loaded.authorizationGranted, false);
    assert(loaded.files[2].content.includes(`name: ${name}`));
    assert.match(loaded.files[2].sha256, /^[a-f0-9]{64}$/);
  }
  assert(runtime.instructions('role', 'security_engineer').files[2].content.includes('Work read-only'));
  for (const name of ['../security-audit', 'https://example.invalid/remote', 'unknown', 'security-audit/SKILL.md'])
    assert.throws(() => runtime.instructions('skill', name));
});
test('startup readiness refuses unknown or failed required evidence, dirty source and mismatched SHA', () => {
  const head = 'a'.repeat(40), report = { repository: { status: 'VERIFIED', head, dirty: false },
    node22: { status: 'VERIFIED' }, npm: { status: 'VERIFIED' }, dependencies: { status: 'VERIFIED' } };
  assert.equal(runtime.readiness(report, head).status, 'VERIFIED');
  assert.equal(runtime.readiness(report, head).cloudAcceptance, 'UNTESTED');
  for (const key of ['repository', 'node22', 'npm', 'dependencies'])
    assert.throws(() => runtime.readiness({ ...report, [key]: { status: 'UNTESTED' } }, head));
  assert.throws(() => runtime.readiness({ ...report, repository: { ...report.repository, dirty: true } }, head));
  assert.throws(() => runtime.readiness(report, 'b'.repeat(40)));
});
test('runtime and bootstrap accept the same canonical origin identities', t => {
  const f = fixture(t);
  for (const origin of ['https://github.com/Sweedycat/ai-memory-app', 'https://github.com/Sweedycat/ai-memory-app.git',
    'git@github.com:Sweedycat/ai-memory-app', 'git@github.com:Sweedycat/ai-memory-app.git',
    'ssh://git@github.com/Sweedycat/ai-memory-app', 'ssh://git@github.com/Sweedycat/ai-memory-app.git']) {
    f.git(['remote', 'set-url', 'origin', origin]);
    assert.equal(runtime.repository(f.root).head, f.head);
  }
});
test('path boundaries normalize both separators and preserve spaces', t => {
  const f = fixture(t);
  assert.equal(within(f.root, 'tools\\synthetic.cjs').absolute, path.join(f.root, 'tools', 'synthetic.cjs'));
  assert.equal(within(f.root, 'tools/synthetic.cjs').relative, 'tools/synthetic.cjs');
  for (const file of ['../outside', 'tools/../file', '/outside', 'C:/outside', '//host/share', '.git/HEAD',
    '.env', '.aws/file', 'tools/auth.json', 'tools/a.key', 'tools/NUL.txt', 'tools/file.', 'tools/file:stream'])
    assert.throws(() => within(f.root, file), file);
});
test('path identity respects Windows casing and Linux case sensitivity', t => {
  const f = fixture(t);
  assert.equal(samePath(f.root, f.root), true);
  if (process.platform === 'win32') {
    const driveVariant = f.root[0] === f.root[0].toUpperCase() ? f.root[0].toLowerCase() + f.root.slice(1) : f.root[0].toUpperCase() + f.root.slice(1);
    assert.equal(samePath(f.root, driveVariant), true);
    assert.equal(runtime.repository(driveVariant).head, f.head);
  } else assert.equal(samePath(f.root, f.root.toUpperCase()), false);
  assert.equal(samePath(f.root, path.join(f.root, 'other')), false);
});
test('Git environment retains only existing exact-root safe.directory trust', t => {
  const f = fixture(t);
  const input = { PATH: 'synthetic', GIT_DIR: '/unapproved', GIT_WORK_TREE: '/unapproved', GIT_CONFIG_COUNT: '3',
    GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: '*', GIT_CONFIG_KEY_1: 'http.extraHeader',
    GIT_CONFIG_VALUE_1: 'SYNTHETIC-CANARY', GIT_CONFIG_KEY_2: 'safe.directory', GIT_CONFIG_VALUE_2: f.root };
  const env = gitEnvironment(f.root, input);
  assert.equal(env.GIT_CONFIG_COUNT, '1'); assert.equal(env.GIT_CONFIG_KEY_0, 'safe.directory');
  assert.equal(env.GIT_CONFIG_VALUE_0, f.root); assert.equal(env.GIT_DIR, undefined);
  assert.equal(env.GIT_WORK_TREE, undefined); assert.equal(env.GIT_CONFIG_KEY_1, undefined);
  assert(!JSON.stringify(env).includes('SYNTHETIC-CANARY'));
  assert.equal(gitEnvironment(f.root, { ...input, GIT_CONFIG_COUNT: '1' }).GIT_CONFIG_COUNT, undefined);
  assert.equal(gitEnvironment(f.root, {}).GIT_CONFIG_COUNT, undefined);
  const trust = values => Object.fromEntries([['GIT_CONFIG_COUNT', String(values.length)], ...values.flatMap((value, i) =>
    [[`GIT_CONFIG_KEY_${i}`, 'safe.directory'], [`GIT_CONFIG_VALUE_${i}`, value]])]);
  for (const value of ['', '.', './', '*', 'relative/path'])
    assert.equal(gitEnvironment(process.cwd(), trust([value])).GIT_CONFIG_COUNT, undefined);
  assert.equal(gitEnvironment(f.root, trust([f.root, ''])).GIT_CONFIG_COUNT, undefined);
  assert.equal(gitEnvironment(f.root, trust(['', f.root])).GIT_CONFIG_VALUE_0, f.root);
  assert.equal(gitEnvironment(f.root, trust([f.root, '', '*'])).GIT_CONFIG_COUNT, undefined);
});
test('Windows DOS short aliases identify the same repository without accepting junctions', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(t);
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command',
    '$f=New-Object -ComObject Scripting.FileSystemObject; $f.GetFolder($env:OMEGA_TEST_LONG_PATH).ShortPath'], {
    env: { ...process.env, OMEGA_TEST_LONG_PATH: f.root }, encoding: 'utf8', timeout: 5000, windowsHide: true });
  if (result.status !== 0 || !result.stdout.trim()) { t.skip('Host cannot expose a synthetic DOS short path'); return; }
  const short = result.stdout.trim();
  if (short.toLowerCase() === f.root.toLowerCase()) { t.skip('Host does not create DOS short aliases'); return; }
  assert.equal(samePath(f.root, short), true);
  assert.equal(runtime.repository(short).head, f.head);
  const linked = path.join(f.root, 'synthetic-junction');
  fs.symlinkSync(path.join(f.root, 'tools'), linked, 'junction');
  assert.equal(samePath(linked, path.join(f.root, 'tools')), false);
});
test('path loader rejects symlinks or junctions before reading instructions', t => {
  const f = fixture(t);
  fs.symlinkSync(path.join(f.root, 'tools'), path.join(f.root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => within(f.root, 'linked/synthetic.cjs'));
});
test('real temporary linked worktree has reciprocal admin metadata; broken backlink fails closed', t => {
  const f = fixture(t), linked = path.join(f.root, 'linked worktree');
  f.git(['worktree', 'add', '-b', 'task-linked', linked]);
  assert.equal(gitLayout(f.root).linked, false);
  const layout = gitLayout(linked);
  assert.equal(layout.linked, true);
  assert.equal(runtime.repository(linked).branch, 'task-linked');
  const backlink = path.join(layout.gitDir, 'gitdir');
  fs.writeFileSync(backlink, path.join(f.root, 'wrong', '.git'));
  assert.throws(() => gitLayout(linked));
});
test('explicit gate checks only owned engineering changes and preserves bytes/HEAD', t => {
  const f = fixture(t), file = path.join(f.root, 'tools', 'synthetic.cjs');
  fs.writeFileSync(file, 'changed\n');
  const result = runtime.gate(f.scope, f.root);
  assert.equal(result.changedPathsChecked, 1);
  assert.equal(result.mode, 'explicit_local_verification_not_native_hook_enforcement');
  assert.equal(result.sensitiveActivationAllowed, false);
  assert.equal(f.git(['rev-parse', 'HEAD']), f.head);
  assert.equal(fs.readFileSync(file, 'utf8'), 'changed\n');
});
test('gate rejects wrong branch, wrong SHA, sensitive scope and conflicting writers', t => {
  const f = fixture(t);
  for (const patch of [{ branch: 'main' }, { branch: 'preview' }, { branch: 'other' },
    { expectedSha: 'b'.repeat(40) }, { sensitive: true }, { paths: ['../outside'] }])
    assert.throws(() => runtime.gate({ ...f.scope, ...patch }, f.root));
  fs.writeFileSync(path.join(f.root, 'unowned.txt'), 'fabricated\n');
  assert.throws(() => runtime.gate(f.scope, f.root));
  assert(fs.existsSync(path.join(f.root, 'unowned.txt')));
});
test('gate withholds malformed content and synthetic secret canary', t => {
  const f = fixture(t), file = path.join(f.root, 'tools', 'synthetic.cjs');
  for (const content of ['<<<<<<< conflict\n', 'trailing space \n', ['gh', 'p_', 'x'.repeat(36)].join('')]) {
    fs.writeFileSync(file, content);
    assert.throws(() => runtime.gate(f.scope, f.root), error => !error.message.includes(content));
  }
});
test('detector verifies OS/source but cannot infer Cloud, native activation, quota or network from files', t => {
  const f = fixture(t), report = runtime.detect(f.root);
  assert.equal(report.platform.status, 'VERIFIED');
  assert.equal(report.repository.head, f.head);
  for (const name of ['environment', 'network', 'officialQuotaTelemetry', 'hookExecution'])
    assert.equal(report[name].status, 'UNTESTED');
  assert.equal(report.native.nativeSpecialists.status, 'UNTESTED');
  assert.equal(report.dependencies.status, 'UNTESTED');
});
test('subprocess timeout stops safely with redacted error', () => {
  assert.throws(() => runtime.run(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], undefined, 50), /command_unavailable/);
});
test('hook refuses a cwd outside its own checkout instead of checking the wrong branch', () => {
  const response = hooks.preTool({ hook_event_name: 'PreToolUse', tool_name: 'Write', cwd: os.tmpdir(),
    tool_input: { path: 'fabricated.md', content: 'synthetic' } }, () => 'work');
  assert.equal(response.hookSpecificOutput.permissionDecision, 'deny');
});
