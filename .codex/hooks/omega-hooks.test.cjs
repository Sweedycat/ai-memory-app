'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const hooks = require('./omega-hooks.cjs');
const script = path.join(__dirname, 'omega-hooks.cjs');
const root = path.resolve(__dirname, '../..');
const pre = (name, args, branch = 'engineering/synthetic') => hooks.preTool({
  hook_event_name: 'PreToolUse', tool_name: name, tool_input: args, cwd: root,
}, () => branch);
const denied = result => result.hookSpecificOutput?.permissionDecision === 'deny';
const patch = content => `*** Begin Patch\n${content}\n*** End Patch\n`;
const syntheticToken = ['gh', 'p_', 'x'.repeat(36)].join('');

test('schema has only the two supported synchronous command handlers', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, '.codex/hooks.json'), 'utf8'));
  assert.deepEqual(Object.keys(config.hooks).sort(), ['PreToolUse', 'Stop']);
  for (const groups of Object.values(config.hooks)) {
    assert.equal(groups.length, 1);
    assert.equal(groups[0].hooks[0].type, 'command');
    assert.equal(groups[0].hooks[0].async, false);
    assert(groups[0].hooks[0].timeout <= 10);
  }
});
test('ordinary engineering patch and read-only command pass', () => {
  assert.deepEqual(pre('apply_patch', { input: patch('*** Add File: .codex/synthetic.md\n+fabricated evidence') }), {});
  assert.deepEqual(pre('Bash', { command: 'git status --short' }), {});
  assert.deepEqual(pre('Read', { file_path: '.codex/README.md' }), {});
  assert.deepEqual(pre('Write', { file_path: path.join(root, '.codex', 'synthetic.md'), content: 'fabricated' }), {});
  assert.deepEqual(pre('Read', { file_path: '.codex\\README.md' }), {});
  assert.deepEqual(hooks.preTool({ hook_event_name: 'PreToolUse', tool_name: 'Read', cwd: path.join(root, '.codex'),
    tool_input: { file_path: 'README.md' } }, () => 'engineering/synthetic'), {});
  assert.deepEqual(pre('apply_patch', { input: patch('*** Add File: .codex/synthetic.md\n+fabricated').replace(/\n/g, '\r\n') }), {});
});
for (const file of ['.env', '.ENV.local', '.codex/auth.json', '.aws/credentials', 'synthetic.keystore',
  '../outside.md', '//server/share/file', 'C:/outside.md', '.codex/file:stream', '.codex/file.']) {
  test(`deny protected or ambiguous synthetic path ${file}`, () => {
    assert(denied(pre('Write', { file_path: file, content: 'fabricated' })));
  });
}
test('all patch paths and move destinations are checked, including deletion', () => {
  assert(denied(pre('apply_patch', { patch: patch('*** Delete File: .env') })));
  assert(denied(pre('apply_patch', { patch: patch('*** Update File: .codex/synthetic.md\n*** Move to: .env\n@@\n+fabricated') })));
});
test('only added content is scanned; removal is permitted and findings are redacted', () => {
  const inserted = pre('apply_patch', { input: patch(`*** Add File: .codex/synthetic.md\n+${syntheticToken}`) });
  assert(denied(inserted));
  assert(!JSON.stringify(inserted).includes(syntheticToken));
  assert.deepEqual(pre('apply_patch', { input: patch(`*** Update File: .codex/synthetic.md\n@@\n-${syntheticToken}\n+redacted`) }), {});
});
test('private-key marker detection uses fabricated in-memory content', () => {
  assert(hooks.hasSecret(['-----BEGIN ', 'PRIVATE KEY-----'].join('')));
  assert(!hooks.hasSecret('sha256: ' + 'a'.repeat(64)));
});
test('quoted JSON and bare sensitive assignments deny insertion but permit removal', () => {
  const value = 'synthetic'.repeat(8);
  for (const key of ['access_token', 'refresh_token', 'client_secret', 'recoveryKey']) {
    for (const text of [JSON.stringify({ [key]: value }), `${key} = '${value}'`]) {
      assert(hooks.hasSecret(text));
      const result = pre('Write', { file_path: '.codex/synthetic.json', content: text });
      assert(denied(result));
      assert(!JSON.stringify(result).includes(value));
      assert.deepEqual(pre('apply_patch', { input: patch(`*** Update File: .codex/synthetic.json\n@@\n-${text}\n+redacted`) }), {});
    }
  }
});
test('main edits and obvious destructive/protected Git commands are denied', () => {
  assert(denied(pre('Edit', { file_path: '.codex/synthetic.md', new_string: 'fabricated' }, 'main')));
  for (const command of ['git push origin main', 'git push --force origin engineering/synthetic',
    'git reset --hard', 'git clean -fd', 'git merge preview', 'Get-Content .env']) {
    assert(denied(pre('Bash', { command })));
  }
});
test('unknown tools remain outside coverage; malformed known tool inputs deny', () => {
  assert.deepEqual(pre('hosted_uncovered_tool', { opaque: true }), {});
  assert(denied(pre('apply_patch', { input: 'not a patch' })));
  assert(denied(pre('Write', { file_path: '.codex/synthetic.md' })));
  assert(denied(hooks.preTool({})));
});
test('present link or junction is rejected before content reads', () => {
  const mod = { exports: {} };
  const fakeFs = { ...fs, lstatSync(file) {
    if (file.endsWith('synthetic-link')) return { isSymbolicLink: () => true };
    return fs.lstatSync(file);
  } };
  const sandboxRequire = name => name === 'node:fs' ? fakeFs : require(name);
  vm.runInNewContext(fs.readFileSync(script, 'utf8'), { require: sandboxRequire, __dirname, module: mod }, { timeout: 1000 });
  assert.throws(() => mod.exports.checkedPath('.codex/synthetic-link/anything.md'));
});
const fakeGit = status => args => args[0] === 'branch' ? 'engineering/synthetic\n'
  : args[0] === 'rev-parse' ? 'a'.repeat(40) + '\n' : args[0] === 'status' ? status : '';
test('Stop emits bounded evidence without continuation or application-content reads', () => {
  const result = hooks.completion({ hook_event_name: 'Stop' }, fakeGit(' M App.tsx\0?? .codex/hooks.json\0'));
  assert.match(result.systemMessage, /1 changed engineering files checked/);
  assert.match(result.systemMessage, /1 other paths not inspected/);
  assert(!result.decision);
  assert(result.systemMessage.length < 600);
  assert.deepEqual(hooks.completion({ hook_event_name: 'Stop', stop_hook_active: true }), {});
});
test('Stop reports Git failures, sensitive paths and resource limits as unverified', () => {
  assert.match(hooks.completion({ hook_event_name: 'Stop' }, () => { throw Error(syntheticToken); }).systemMessage, /UNVERIFIED/);
  assert.match(hooks.completion({ hook_event_name: 'Stop' }, fakeGit('?? .codex/auth.json\0')).systemMessage, /UNVERIFIED/);
  const many = Array.from({ length: 65 }, (_, i) => `?? fabricated-${i}.md\0`).join('');
  assert.match(hooks.completion({ hook_event_name: 'Stop' }, fakeGit(many)).systemMessage, /UNVERIFIED/);
});
for (const input of ['{bad JSON', 'x'.repeat(hooks.MAX_INPUT + 1)]) {
  test('CLI contract denies malformed/oversized stdin without leaking input', () => {
    const result = spawnSync(process.execPath, [script, 'pre'], { input, encoding: 'utf8', windowsHide: true, timeout: 3000 });
    assert.equal(result.status, 0);
    assert(denied(JSON.parse(result.stdout)));
    assert.equal(result.stderr, '');
    assert(result.stdout.length < 500);
  });
}
test('hook subprocess works from nested cwd; configured Windows launcher is used only in its own checkout', () => {
  const status = () => spawnSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', 'status', '--porcelain=v1', '-z'],
    { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 3000 }).stdout;
  const before = status();
  const config = JSON.parse(fs.readFileSync(path.join(root, '.codex/hooks.json'), 'utf8'));
  const configured = config.hooks.Stop[0].hooks[0].command;
  const useConfigured = process.platform === 'win32' && configured === `node "${script.replace(/\\/g, '/')}" stop`;
  const launcher = useConfigured ? (process.env.ComSpec || 'cmd.exe') : process.execPath;
  const args = useConfigured ? ['/C', configured] : [script, 'stop'];
  const result = spawnSync(launcher, args, {
    cwd: path.join(root, '.codex'), input: JSON.stringify({ hook_event_name: 'Stop' }),
    encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: useConfigured, timeout: 10000,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.match(JSON.parse(result.stdout).systemMessage, /Omega engineering evidence: HEAD/);
  assert.equal(status(), before);
});
test('Stop batches rename/deletion checks into at most four Git subprocesses', () => {
  const calls = [];
  const runGit = args => { calls.push(args); return fakeGit('R  .codex/hooks.json\0.codex/deleted-synthetic.md\0 D .codex/deleted-other.md\0')(args); };
  assert.match(hooks.completion({ hook_event_name: 'Stop' }, runGit).systemMessage, /evidence: HEAD/);
  assert.equal(calls.length, 4);
  assert.equal(calls.at(-1).filter(value => value === '--').length, 1);
  assert(calls.at(-1).includes('.codex/deleted-synthetic.md'));
});
test('Stop rejects fabricated oversize, secret, malformed JSON and whitespace without disclosure', () => {
  for (const fault of ['size', 'secret', 'json', 'whitespace']) {
    const mod = { exports: {} };
    const fakeFs = { ...fs,
      lstatSync(file) {
        if (file.endsWith('synthetic.json')) return { isSymbolicLink: () => false, isFile: () => true, size: fault === 'size' ? 129 * 1024 : 100 };
        return fs.lstatSync(file);
      },
      readFileSync(file, ...args) {
        if (file.endsWith('synthetic.json')) return fault === 'secret' ? syntheticToken : fault === 'json' ? '{invalid' : 'trailing space \n';
        return fs.readFileSync(file, ...args);
      },
    };
    vm.runInNewContext(fs.readFileSync(script, 'utf8'), {
      require: name => name === 'node:fs' ? fakeFs : require(name), __dirname, module: mod,
    }, { timeout: 1000 });
    const result = mod.exports.completion({ hook_event_name: 'Stop' }, fakeGit('?? .codex/synthetic.json\0'));
    assert.match(result.systemMessage, /UNVERIFIED/);
    assert(!result.systemMessage.includes(syntheticToken));
  }
});
test('Git content filters are disabled through argument overrides without reading values', () => {
  const calls = [];
  const mod = { exports: {} };
  const fakeProcess = { spawnSync(executable, args, options) {
    assert.equal(executable, 'git');
    assert.equal(options.shell, false);
    calls.push(args);
    if (args.includes('config')) return { status: 0, stdout: 'filter.synthetic.clean\0filter.synthetic.process\0' };
    for (const value of ['filter.synthetic.clean=', 'filter.synthetic.smudge=', 'filter.synthetic.process=', 'filter.synthetic.required=false']) assert(args.includes(value));
    return { status: 0, stdout: args.includes('branch') ? 'engineering/synthetic\n' : args.includes('rev-parse') ? 'a'.repeat(40) : '' };
  } };
  vm.runInNewContext(fs.readFileSync(script, 'utf8'), {
    require: name => name === 'node:child_process' ? fakeProcess : require(name), __dirname, module: mod,
  }, { timeout: 1000 });
  assert.match(mod.exports.completion({ hook_event_name: 'Stop' }).systemMessage, /evidence: HEAD/);
  assert.equal(calls.length, 4);
  assert(calls[0].includes('--name-only'));
});

// Native Codex projects apply_patch text into tool_input.command.
test('native command-shaped patches pass and preserve legacy input formats', () => {
  const text = patch('*** Add File: .codex/synthetic-native.md\n+fabricated evidence');
  for (const content of [text, text.replace(/\n/g, '\r\n')]) {
    assert.deepEqual(pre('apply_patch', { command: content }), {});
  }
  for (const input of [text, { input: text }, { patch: text }]) assert.deepEqual(pre('apply_patch', input), {});
});
test('native command-shaped patches retain protected-path, move, main and literal checks', () => {
  for (const body of [
    '*** Add File: .codex/synthetic.key\n+fabricated',
    '*** Update File: .codex/synthetic.md\n*** Move to: ../outside.md\n+fabricated',
    '*** Delete File: .git/synthetic-only',
  ]) assert(denied(pre('apply_patch', { command: patch(body) })));
  const safe = patch('*** Add File: .codex/synthetic-native.md\n+fabricated');
  assert(denied(pre('apply_patch', { command: safe }, 'main')));
  assert(denied(pre('apply_patch', { command: patch('*** Add File: .codex/synthetic-native.md\n+' + syntheticToken) })));
});
test('native command is authoritative and malformed commands cannot fall back to legacy fields', () => {
  const safe = patch('*** Add File: .codex/synthetic-native.md\n+fabricated');
  for (const command of ['', 'not a patch', 42, {}]) {
    assert(denied(pre('apply_patch', { command, input: safe, patch: safe })));
  }
  assert(denied(pre('apply_patch', { command: patch('*** Add File: ../outside.md\n+fabricated'), input: safe })));
});
test('CLI accepts actual native command-shaped payload without performing the patch', () => {
  const payload = { hook_event_name: 'PreToolUse', tool_name: 'apply_patch', cwd: root,
    session_id: 'synthetic-session', turn_id: 'synthetic-turn', tool_use_id: 'synthetic-tool',
    tool_input: { command: patch('*** Add File: .codex/synthetic-native.md\n+fabricated evidence') } };
  const result = spawnSync(process.execPath, [script, 'pre'], { input: JSON.stringify(payload),
    encoding: 'utf8', windowsHide: true, timeout: 3000 });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {});
  assert(!fs.existsSync(path.join(root, '.codex/synthetic-native.md')));
});

test('ancestry reads pass while merge mutations remain denied', () => {
  for (const command of ['git merge-base A B', 'git merge-base --is-ancestor main preview',
    'GIT MERGE-BASE A B', 'git merge-base A B; git status --short']) {
    assert.deepEqual(pre('exec_command', { cmd: command }), {});
  }
  for (const command of ['git merge preview', 'git merge --no-ff topic', 'git merge',
    'git merge; git status', 'git merge\npreview', 'git merge\tpreview',
    'git merge-file current base other', 'git merge-index driver --all', 'git merge-tree A B',
    'git merge-base A B; git merge preview', 'git push --force origin engineering/synthetic',
    'git reset --hard']) {
    assert(denied(pre('exec_command', { cmd: command })), command);
  }
});
