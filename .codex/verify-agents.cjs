'use strict';

// Local configuration/discovery probe only: no model turns or network requests.
// Pass the installed native Codex executable; no packages or credentials needed.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const executable = process.argv[2];
assert(executable, 'Usage: node .codex/verify-agents.cjs <native-codex-executable>');
const root = path.resolve(__dirname, '..');
const expected = [
  'ai_engineer', 'android_engineer', 'automation_integration_engineer', 'data_engineer', 'devops_engineer',
  'independent_reviewer', 'performance_engineer', 'product_release_engineer', 'qa_engineer',
  'security_engineer', 'software_engineer', 'ui_ux_engineer', 'wearables_engineer',
];

function run(args) {
  const result = spawnSync(executable, args, {
    cwd: root, encoding: 'utf8', timeout: 45000, maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  // Do not print native prompts, effective configuration, stderr or credentials.
  assert(!result.error, `Native command could not complete: ${args[0]}`);
  assert.equal(result.status, 0, `Native command failed: ${args[0]} (exit ${result.status})`);
  return result.stdout;
}

const version = run(['--version']).trim();
assert.match(version, /^codex-cli \d+\.\d+\.\d+/);
const feature = run(['features', 'list']).split(/\r?\n/)
  .find(line => /^multi_agent_v2\s/.test(line));
assert(feature && /\bstable\s+true\s*$/.test(feature), 'Native Multi Agent V2 is not stable/enabled');
JSON.parse(run(['app-server', '--strict-config', '--print-startup-config']));

const prompt = JSON.parse(run(['debug', 'prompt-input', 'PHASE03_DISCOVERY_ONLY']));
assert(Array.isArray(prompt), 'Unexpected native prompt format');
const serialized = JSON.stringify(prompt);
assert(serialized.includes('Act as Principal Architect for AI Memory'), 'Project config was not loaded (check project trust)');
const registry = prompt.filter(item => item.role === 'developer')
  .map(item => JSON.stringify(item)).join('\n');
const files = fs.readdirSync(path.join(__dirname, 'agents'))
  .filter(file => file.endsWith('.toml')).sort();
assert.deepEqual(files, expected.map(name => `${name}.toml`));
for (const name of expected) {
  assert(registry.includes(name), `Custom agent missing from native developer context: ${name}`);
}

const manifest = ['config.toml', ...files.map(file => `agents/${file}`)]
  .map(file => ({
    file: `.codex/${file}`,
    sha256: createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex'),
  }));
const toolSummaries = [];
function inspect(value) {
  if (!value || typeof value !== 'object') return;
  if (value.name && /spawn_agent$/.test(value.name)) {
    toolSummaries.push({
      name: value.name,
      parameters: Object.keys(value.parameters?.properties || {}),
    });
  }
  for (const child of Object.values(value)) inspect(child);
}
inspect(prompt);
console.log(JSON.stringify({
  version, multiAgentV2: feature.trim(), strictStartup: 'PASS',
  principalArchitect: 'DISCOVERED', nativeAgentDiscovery: expected,
  spawnTools: toolSummaries, manifest,
}, null, 2));
