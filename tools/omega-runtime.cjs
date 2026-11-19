'use strict';

// Read-only local evidence. Configuration inventory is never activation proof.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { within, bounded, gitLayout, samePath, gitEnvironment } = require('./omega-paths.cjs');
const { ownershipPlan } = require('./omega-workspace.cjs');
const { validOrigin } = require('./omega-cloud-bootstrap.cjs');
const { hasSecret } = require('../.codex/hooks/omega-hooks.cjs');
const ROOT = path.resolve(__dirname, '..');
const BRANCH = 'development/omega-commercial-mvp';
const SKILLS = ['android-expo-build', 'automated-testing', 'bug-investigation', 'feature-development', 'github-ci',
  'memory-continuity', 'omega-orchestrator', 'performance-audit', 'privacy-compliance', 'release-management',
  'security-audit', 'wearables-integration'];
const ROLES = ['ai_engineer', 'android_engineer', 'automation_integration_engineer', 'data_engineer', 'devops_engineer', 'independent_reviewer',
  'performance_engineer', 'product_release_engineer', 'qa_engineer', 'security_engineer', 'software_engineer', 'ui_ux_engineer', 'wearables_engineer'];
const cap = (status = 'UNTESTED', detail = 'No direct runtime observation') => ({ status, detail });
const sha = s => typeof s === 'string' && /^[a-f0-9]{40}$/.test(s);

function run(file, args, cwd = ROOT, timeout = 5000) {
  const env = gitEnvironment(cwd);
  const result = spawnSync(file, args, { cwd, encoding: 'utf8', shell: false, windowsHide: true, timeout,
    maxBuffer: 256 * 1024, stdio: ['ignore', 'pipe', 'pipe'], env });
  if (result.error || result.status !== 0) throw Error('command_unavailable');
  return result.stdout;
}
function git(args, root = ROOT) {
  const base = ['--no-pager', '--no-optional-locks', '-c', 'core.fsmonitor=false'];
  const names = run('git', [...base, 'config', '--null', '--name-only', '--list'], root).split('\0').filter(Boolean);
  const filters = names.filter(k => /^filter\..*\.(?:clean|smudge|process)$/i.test(k));
  if (filters.length > 32 || filters.some(k => !/^filter\.[a-z0-9._-]+\.(clean|smudge|process)$/i.test(k))) throw Error('filter');
  const overrides = [...new Set(filters.map(k => k.replace(/\.(clean|smudge|process)$/i, '')))].flatMap(k =>
    ['-c', `${k}.clean=`, '-c', `${k}.smudge=`, '-c', `${k}.process=`, '-c', `${k}.required=false`]);
  return run('git', [...base, ...overrides, ...args], root);
}
function repository(root = ROOT) {
  const layout = gitLayout(root);
  if (!samePath(fs.realpathSync(git(['rev-parse', '--show-toplevel'], root).trim()), fs.realpathSync(root))) throw Error('wrong_root');
  const origins = git(['config', '--get-all', 'remote.origin.url'], root).trim().split(/\r?\n/);
  if (origins.length !== 1 || !validOrigin(origins[0])) throw Error('wrong_repository');
  const head = git(['rev-parse', '--verify', 'HEAD'], root).trim();
  if (!sha(head)) throw Error('head');
  const branch = git(['branch', '--show-current'], root).trim();
  if (branch && !/^[a-zA-Z0-9._/-]{1,160}$/.test(branch)) throw Error('branch');
  return { root, head, branch: branch || null, linkedWorktree: layout.linked,
    dirty: git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], root).length > 0 };
}
function instructions(kind, name, root = ROOT) {
  const list = kind === 'skill' ? SKILLS : kind === 'role' ? ROLES : [];
  if (!list.includes(name)) throw Error('instruction_not_approved');
  const file = kind === 'skill' ? `.agents/skills/${name}/SKILL.md` : `.codex/agents/${name}.toml`;
  const files = ['AGENTS.md', '.agents/skills/omega-orchestrator/references/working-contract.md', file];
  return { mode: 'manual_repository_instruction_loading', nativeActivation: false, authorizationGranted: false,
    references: 'Read relevant local references under the same repository; remote instructions are not loaded.',
    files: files.map(file => { const content = bounded(within(root, file).absolute); return {
      file, sha256: createHash('sha256').update(content).digest('hex'), content }; }) };
}

// Facts must come from the current host tool interface / actual invocation, not
// TOML files. This pure planner cannot authenticate facts supplied by a caller.
function executionPlan(facts = {}) {
  const fact = key => facts[key] === true ? cap('VERIFIED', 'Caller reports current direct observation; not authenticated by this helper')
    : facts[key] === false ? cap('UNSUPPORTED', 'Caller reports current interface does not support this capability') : cap();
  const native = fact('nativeSpecialists'), delegation = fact('delegation');
  return { evidenceSource: 'caller_supplied_not_authenticated', nativeSpecialists: native, delegation,
    nativeSkills: fact('nativeSkills'), hookExecution: fact('hookExecution'), quotaTelemetry: fact('quotaTelemetry'),
    managedCloud: fact('managedCloud'),
    mode: native.status === 'VERIFIED' ? 'A_NATIVE_SPECIALIST' : delegation.status === 'VERIFIED'
      ? 'B_ROLE_GUIDED_DELEGATION' : 'PRINCIPAL_ONLY_REVIEW_UNAVAILABLE',
    independentReviewRequired: true, selfReviewIsIndependent: false, sensitiveActivationAllowed: false };
}
function detect(root = ROOT) {
  const result = { platform: cap('VERIFIED', process.platform), environment: cap(), repository: cap(),
    node: cap('VERIFIED', process.version), node22: cap(process.versions.node.split('.')[0] === '22' ? 'VERIFIED' : 'UNSUPPORTED', 'CI requires Node 22'),
    npm: cap(), dependencies: cap(), definitions: { roles: [], skills: [] },
    native: executionPlan(), hookPaths: cap(), hookExecution: cap(), network: cap(), officialQuotaTelemetry: cap() };
  try { result.repository = { status: 'VERIFIED', ...repository(root) }; } catch { /* withheld */ }
  try {
    // Invoke the installed npm CLI with Node on Windows; never start cmd.exe or
    // depend on a changed PowerShell execution policy.
    const npmDirectories = [path.dirname(process.execPath), ...(process.env.PATH || process.env.Path || '').split(path.delimiter).slice(0, 128)];
    const npmCli = npmDirectories.map(p => path.join(p, 'node_modules/npm/bin/npm-cli.js')).find(p => {
      try { return fs.lstatSync(p).isFile(); } catch { return false; }
    });
    const npmRun = args => process.platform === 'win32' ? run(process.execPath, [npmCli, ...args], root, 15000) : run('npm', args, root, 15000);
    const version = npmRun(['--version']).trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('npm');
    result.npm = cap('VERIFIED', version);
    const pkg = JSON.parse(bounded(within(root, 'package.json').absolute));
    const lock = JSON.parse(bounded(within(root, 'package-lock.json').absolute, 2 * 1024 * 1024));
    const entry = lock.packages?.[''];
    if (!entry || pkg.name !== lock.name || pkg.version !== lock.version
      || JSON.stringify(pkg.dependencies) !== JSON.stringify(entry.dependencies)
      || JSON.stringify(pkg.devDependencies) !== JSON.stringify(entry.devDependencies)) throw Error('lock');
    const tree = JSON.parse(npmRun(['ls', '--depth=0', '--json', '--ignore-scripts']));
    if (tree.problems?.length) throw Error('dependencies');
    result.dependencies = cap('VERIFIED', 'Manifest/lock root matches and npm ls --depth=0 passed; no native/build acceptance implied');
  } catch { result.dependencies = cap('UNTESTED', 'Dependency/version/lock preparation incomplete or failed; raw output withheld'); }
  for (const [kind, names] of [['role', ROLES], ['skill', SKILLS]]) for (const name of names) {
    try { instructions(kind, name, root); result.definitions[kind === 'role' ? 'roles' : 'skills'].push(name); } catch { /* inventory only */ }
  }
  try {
    const hooks = JSON.parse(bounded(within(root, '.codex/hooks.json').absolute));
    const entries = Object.values(hooks.hooks).flatMap(groups => groups.flatMap(g => g.hooks));
    const windows = entries.every(h => /^node "C:\/Users\/raons\/Projects\/ai-memory-app\//.test(h.command));
    result.hookPaths = process.platform !== 'win32' && windows ? cap('UNSUPPORTED', 'Existing native launch commands target Windows; use explicit verification gate')
      : cap('UNTESTED', 'Inspect native hook inventory/trust and observe an actual event; config presence alone is insufficient');
  } catch { /* unknown */ }
  return result;
}

function gate({ expectedSha, branch, task, paths, sensitive = false }, root = ROOT) {
  if (sensitive) throw Error('sensitive_control_unavailable');
  const claim = ownershipPlan({ task, environment: 'cloud', baseSha: expectedSha, branch: `omega/cloud/${task}`, paths });
  if (claim.state === 'invalid' || !sha(expectedSha) || !/^[a-zA-Z0-9._/-]{1,160}$/.test(branch || '')
    || ['main', 'preview'].includes(branch)) throw Error('invalid_scope');
  const before = repository(root);
  if (before.head !== expectedSha || before.branch !== branch) throw Error('source_mismatch');
  const entries = git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], root).split('\0');
  const changed = [];
  for (let i = 0; i < entries.length; i++) {
    if (!entries[i]) continue;
    changed.push(entries[i].slice(3));
    if (/[RC]/.test(entries[i].slice(0, 2))) changed.push(entries[++i]);
  }
  if (changed.length > 64) throw Error('size_limit');
  let total = 0;
  for (const file of new Set(changed)) {
    if (!paths.includes(file) || !/^(?:tools|tests|docs|\.codex|\.agents|\.github)\//.test(file)) throw Error('unowned_change');
    const location = within(root, file);
    if (!fs.existsSync(location.absolute)) continue;
    const content = bounded(location.absolute);
    total += Buffer.byteLength(content);
    if (total > 1024 * 1024 || hasSecret(content) || /^(?:<<<<<<<|=======|>>>>>>>)(?: |$)/m.test(content)
      || /[\t ]+$/m.test(content.replace(/\r\n/g, '\n'))) throw Error('content_check');
  }
  git(['diff', '--no-ext-diff', '--no-textconv', '--check', 'HEAD'], root);
  const after = repository(root);
  if (before.head !== after.head || before.branch !== after.branch) throw Error('source_changed');
  return { status: 'VERIFIED', mode: 'explicit_local_verification_not_native_hook_enforcement', head: before.head,
    changedPathsChecked: new Set(changed).size, ownership: 'advisory_not_lock', authorizationGranted: false,
    sensitiveActivationAllowed: false, remaining: 'Tests, independent frozen-diff review, owner scope and remote revalidation remain mandatory' };
}

function main(args) {
  if (!args.length) return detect();
  if (args.length === 2 && args[0] === '--ready') return readiness(detect(), args[1]);
  if (args.length === 2 && ['--skill', '--role'].includes(args[0])) return instructions(args[0].slice(2), args[1]);
  if (args[0] === '--gate' && args.length >= 5) return gate({ expectedSha: args[1], branch: args[2], task: args[3], paths: args.slice(4) });
  throw Error('unsupported_arguments');
}
function readiness(report, expectedSha) {
  if (!sha(expectedSha) || ['repository', 'node22', 'npm', 'dependencies'].some(key => report[key]?.status !== 'VERIFIED')
    || report.repository.head !== expectedSha || report.repository.dirty !== false) throw Error('required_readiness_unverified');
  return { status: 'VERIFIED', sourceAndDependencies: report, cloudAcceptance: 'UNTESTED', authorizationGranted: false };
}
module.exports = { detect, readiness, executionPlan, instructions, repository, gate, git, run, SKILLS, ROLES, BRANCH };
if (require.main === module) {
  try { process.stdout.write(JSON.stringify(main(process.argv.slice(2)), null, 2) + '\n'); }
  catch { process.stdout.write('{"status":"UNTESTED","error":"verification_failed_stop_and_preserve_work"}\n'); process.exitCode = 2; }
}
