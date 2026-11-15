'use strict';

// Native metadata inspection only: no model turns, hook trust writes or raw dumps.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const configPath = path.join(__dirname, 'hooks.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const expectedEvents = ['PreToolUse', 'Stop'];
assert.deepEqual(Object.keys(config), ['hooks']);
assert.deepEqual(Object.keys(config.hooks).sort(), expectedEvents);
for (const [event, mode, timeout] of [['PreToolUse', 'pre', 5], ['Stop', 'stop', 10]]) {
  assert.equal(config.hooks[event].length, 1);
  assert.deepEqual(Object.keys(config.hooks[event][0]), ['hooks']);
  assert.equal(config.hooks[event][0].hooks.length, 1);
  assert.deepEqual(config.hooks[event][0].hooks[0], {
    type: 'command', command: `node "${path.join(__dirname, 'hooks', 'omega-hooks.cjs').replace(/\\/g, '/')}" ${mode}`,
    timeout, async: false,
  });
}
const files = ['.codex/hooks.json', '.codex/hooks/omega-hooks.cjs', '.codex/hooks/omega-hooks.test.cjs', '.codex/verify-hooks.cjs'];
const sha256 = value => createHash('sha256').update(value).digest('hex');
const manifest = files.map(file => {
  const bytes = fs.readFileSync(path.join(root, file));
  assert(!/[\t ]+$/m.test(bytes.toString('utf8').replace(/\r\n/g, '\n')), 'Whitespace issue');
  return { file, sha256: sha256(bytes) };
});
const output = { localConfiguration: 'PASS', manifest, manifestSha256: sha256(JSON.stringify(manifest)) };
assert(process.argv.length === 2 || process.argv.length === 3, 'Usage: node .codex/verify-hooks.cjs [native-codex-executable]');
if (process.argv.length === 2) { console.log(JSON.stringify(output, null, 2)); } else {
  const executable = process.argv[2];
  function run(args) {
    const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
    assert(!result.error && result.status === 0, `Native probe failed: ${args[0]}`);
    return result.stdout;
  }
  output.version = run(['--version']).trim();
  output.hooksFeature = run(['features', 'list']).split(/\r?\n/).find(line => /^hooks\s/.test(line))?.trim();
  assert(output.hooksFeature && /\bstable\s+true\s*$/.test(output.hooksFeature), 'Effective native hooks feature is not enabled');
  JSON.parse(run(['app-server', '--strict-config', '--print-startup-config']));
  output.strictStartup = 'PASS';
  const child = spawn(executable, ['app-server', '--stdio'], { cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let id = 0, buffer = '';
  const timer = setTimeout(() => { child.kill(); process.exitCode = 1; }, 30000);
  child.stderr.on('data', () => {});
  child.on('error', () => { for (const request of pending.values()) request.reject(Error('Native unavailable')); });
  child.on('exit', () => { for (const request of pending.values()) request.reject(Error('Native exited')); });
  child.stdout.on('data', bytes => {
    buffer += bytes.toString('utf8');
    if (buffer.length > 2 * 1024 * 1024) { child.kill(); return; }
    while (buffer.includes('\n')) {
      const index = buffer.indexOf('\n');
      const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (pending.has(message.id)) {
        const request = pending.get(message.id); pending.delete(message.id);
        message.error ? request.reject(Error('Native RPC rejected')) : request.resolve(message.result);
      } else if (message.id !== undefined) {
        child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Inventory probe denies client requests' } }) + '\n');
      }
    }
  });
  const request = (method, params) => new Promise((resolve, reject) => {
    const requestId = ++id; pending.set(requestId, { resolve, reject });
    child.stdin.write(JSON.stringify({ id: requestId, method, params }) + '\n');
  });
  (async () => {
    let stage = 'initialize';
    try {
      await request('initialize', { clientInfo: { name: 'omega_hook_inventory', version: '1.0.0' }, capabilities: { experimentalApi: true } });
      child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
      stage = 'hooks/list';
      const inventory = await request('hooks/list', { cwds: [root] });
      stage = 'inventory-validation';
      const entry = inventory.data.find(entry => path.resolve(entry.cwd) === root);
      assert(entry && entry.errors.length === 0, 'Native hook inventory contains errors');
      const hooks = entry.hooks.filter(hook => path.resolve(hook.sourcePath) === configPath);
      // Native protocol metadata uses camelCase; hooks.json uses PascalCase.
      assert.deepEqual(hooks.map(hook => hook.eventName).sort(), ['preToolUse', 'stop']);
      output.nativeProjectHooks = hooks.map(hook => ({ event: hook.eventName, enabled: hook.enabled,
        trustStatus: hook.trustStatus, timeout: hook.timeoutSec, currentHash: hook.currentHash }));
      output.warningCount = entry.warnings.length;
      console.log(JSON.stringify(output, null, 2));
    } catch {
      console.log(JSON.stringify({ localConfiguration: 'PASS', nativeInventory: 'UNVERIFIED', stage, note: 'Native inspection failed; raw diagnostics withheld' }));
      process.exitCode = 1;
    } finally { clearTimeout(timer); child.kill(); }
  })();
}
