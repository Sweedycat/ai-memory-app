'use strict';

// Read-only configuration probe. No model turns, packages, network or prompt dumps.
// Local mode validates this project's deliberately minimal YAML subset.
// Native mode checks installed Codex discovery and observes prompt expansion.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const skillsRoot = path.join(root, '.agents', 'skills');
const expected = [
  'android-expo-build', 'automated-testing', 'bug-investigation',
  'feature-development', 'github-ci', 'memory-continuity', 'omega-orchestrator',
  'performance-audit', 'privacy-compliance', 'release-management',
  'security-audit', 'wearables-integration',
];
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === '--native'),
  'Usage: node .codex/verify-skills.cjs [--native <installed-native-codex-executable>]');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = [];
const records = [];
const expectedFiles = expected.map(name => `${name}/SKILL.md`)
  .concat('omega-orchestrator/references/working-contract.md').sort();
const expectedDirectories = new Set([...expected, 'omega-orchestrator/references']);
const actualFiles = [];
const rootInfo = fs.lstatSync(skillsRoot);
assert(rootInfo.isDirectory() && !rootInfo.isSymbolicLink(), 'Expected ordinary skills root');
function inspectInventory(directory, prefix = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    assert(!entry.isSymbolicLink(), 'Unexpected link in skill inventory');
    if (entry.isDirectory()) {
      assert(expectedDirectories.has(relative), 'Unexpected skill directory');
      inspectInventory(path.join(directory, entry.name), `${relative}/`);
    } else {
      assert(entry.isFile() && expectedFiles.includes(relative), 'Unexpected skill file');
      actualFiles.push(relative);
    }
  }
}
inspectInventory(skillsRoot);
assert.deepEqual(actualFiles.sort(), expectedFiles, 'Skill inventory mismatch');

function inspectFile(file) {
  const bytes = fs.readFileSync(file);
  const content = bytes.toString('utf8').replace(/\r\n/g, '\n');
  assert(!content.startsWith('\uFEFF'), 'Unexpected BOM');
  assert(!/^(?:<<<<<<<|=======|>>>>>>>)(?: |$)/m.test(content), 'Conflict marker');
  assert(!/[\t ]+$/m.test(content), 'Trailing whitespace');
  // Check all local Markdown references without following external URLs.
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^https?:\/\//.test(target)) continue;
    const resolved = path.resolve(path.dirname(file), target.split('#')[0]);
    assert(resolved.startsWith(root + path.sep), 'Reference escapes repository');
    assert(fs.statSync(resolved).isFile(), 'Missing local reference');
  }
  manifest.push({ file: path.relative(root, file).replace(/\\/g, '/'), sha256: sha256(bytes) });
  return content;
}

for (const name of expected) {
  const file = path.join(skillsRoot, name, 'SKILL.md');
  const content = inspectFile(file);
  // JSON-quoted scalars are valid YAML; rejecting richer YAML is a project
  // convention for this probe, not a claim about Codex's complete schema.
  const match = /^---\nname: ([a-z0-9]+(?:-[a-z0-9]+)*)\ndescription: ("[^\n]+")\n---\n([\s\S]+)$/.exec(content);
  assert(match, 'Expected only name and JSON-quoted description frontmatter');
  assert.equal(match[1], name);
  assert(name.length <= 64);
  const description = JSON.parse(match[2]);
  assert(typeof description === 'string' && description.trim().length > 0 && description.length <= 1024);
  assert(!/[<>]/.test(description));
  assert(!/\[TODO:/.test(content), 'Unfinished scaffold');
  records.push({ name, file, body: match[3].trim(), description });
}
inspectFile(path.join(skillsRoot, 'omega-orchestrator', 'references', 'working-contract.md'));
inspectFile(__filename);
inspectFile(path.join(__dirname, 'verify-skills.test.cjs'));
manifest.sort((a, b) => a.file.localeCompare(b.file, 'en'));
const output = {
  localSyntaxAndReferences: 'PASS', skillCount: records.length,
  skillWords: records.reduce((sum, record) => sum + record.body.split(/\s+/).length, 0),
  manifest, manifestSha256: sha256(JSON.stringify(manifest)),
};

if (args.length) {
  const executable = args[1];
  function run(commandArgs) {
    const result = spawnSync(executable, commandArgs, {
      cwd: root, encoding: 'utf8', windowsHide: true,
      timeout: 45000, maxBuffer: 16 * 1024 * 1024,
    });
    // Never emit raw prompts, stderr or effective configuration.
    assert(!result.error, `Native command could not complete: ${commandArgs[0]}`);
    assert.equal(result.status, 0, `Native command failed: ${commandArgs[0]} (exit ${result.status})`);
    return result.stdout;
  }
  const strings = value => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(strings);
    if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
    return [];
  };
  output.nativeVersion = run(['--version']).trim();
  JSON.parse(run(['app-server', '--strict-config', '--print-startup-config']));
  output.strictStartup = 'PASS';
  const prompt = JSON.parse(run(['debug', 'prompt-input', 'PHASE08_DISCOVERY_ONLY']));
  assert(Array.isArray(prompt), 'Unexpected native prompt format');
  const context = strings(prompt).join('\n');
  assert(context.includes('Act as Principal Architect for AI Memory'), 'Project config not loaded; verify trust');
  output.discovery = [];
  // This CLI may shorten file locations with the documented-in-prompt rN roots.
  const aliases = new Map([...context.matchAll(/^- `?(r\d+)`? = `([^`]+)`/gm)]
    .map(match => [match[1], match[2]]));
  for (const record of records) {
    const line = context.split('\n').find(line => line.startsWith(`- ${record.name}: `) && line.includes(record.description));
    assert(line, `Native discovery missing metadata: ${record.name}`);
    const location = /\(file: ([^)]+)\)/.exec(line)?.[1];
    assert(location, `Native discovery missing path: ${record.name}`);
    const prefix = /^(r\d+)\//.exec(location);
    const expanded = prefix && aliases.has(prefix[1])
      ? path.resolve(aliases.get(prefix[1]), location.slice(prefix[0].length)) : path.resolve(location);
    assert.equal(expanded, record.file, `Unexpected native skill location: ${record.name}`);
    output.discovery.push(record.name);
  }
  output.explicitPromptExpansion = [];
  for (const record of records) {
    const expanded = JSON.parse(run(['debug', 'prompt-input', `$${record.name} PHASE08_READ_ONLY_INPUT_TEST. Do not execute tools or change files.`]));
    const text = strings(expanded).join('\n').replace(/\r\n/g, '\n');
    // The debug command may only append the literal prompt. Absence of expansion
    // is an unverified invocation gate, not a syntax/discovery failure.
    output.explicitPromptExpansion.push({ name: record.name,
      status: text.includes(record.body) ? 'EXPANDED' : 'NOT_OBSERVED' });
  }
}
console.log(JSON.stringify(output, null, 2));
