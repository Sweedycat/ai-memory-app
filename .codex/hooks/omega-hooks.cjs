'use strict';

// Best-effort native hooks; no writes, network, models, installs or raw diagnostics.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const ROOT = path.resolve(__dirname, '../..');
const MAX_INPUT = 256 * 1024;
const MAX_FILE = 128 * 1024;
const deny = reason => ({ hookSpecificOutput: {
  hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason,
} });

function hasSecret(text) {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
    || /\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(text)
    || /\bAKIA[A-Z0-9]{16}\b/.test(text)
    || /\bAIza[A-Za-z0-9_-]{30,}\b/.test(text)
    || /["']?\b(?:access_token|refresh_token|client_secret|recoveryKey)\b["']?\s*[:=]\s*["'][A-Za-z0-9_+\/=.-]{32,}["']/i.test(text);
}

function checkedPath(value, cwd = ROOT) {
  if (typeof value !== 'string' || !value || /[\x00-\x1f]/.test(value)) throw Error('path');
  const slash = value.replace(/\\/g, '/');
  if (slash.startsWith('//') || slash.split('/').includes('..')) throw Error('path');
  const absolute = path.resolve(cwd, value);
  const relative = path.relative(ROOT, absolute).replace(/\\/g, '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative) || relative.includes(':')) throw Error('path');
  const parts = relative.toLowerCase().split('/');
  if (parts.some(part => /[. ]$/.test(part))) throw Error('path');
  if (parts.some(part => ['.git', '.aws', '.ssh', '.gnupg'].includes(part))) throw Error('protected');
  const base = parts.at(-1);
  if ((/^\.env(?:\.|$)/.test(base) && base !== '.env.example')
    || /\.(?:jks|keystore|p12|pfx|pem|key)$/.test(base)
    || /^(?:auth|credentials|secrets|tokens)\.json$/.test(base)
    || /^(?:id_rsa|id_ed25519|google-services\.json)$/.test(base)) throw Error('protected');
  // Never follow a present symlink/junction before a read or proposed write.
  let current = ROOT;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw Error('link'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { absolute, relative };
}

function branch() {
  // No per-tool subprocess. Worktree .git files need a separately verified path.
  const gitDir = path.join(ROOT, '.git');
  if (!fs.lstatSync(gitDir).isDirectory() || fs.lstatSync(gitDir).isSymbolicLink()) throw Error('git');
  const headInfo = fs.lstatSync(path.join(gitDir, 'HEAD'));
  if (!headInfo.isFile() || headInfo.isSymbolicLink() || headInfo.size > 4096) throw Error('git');
  const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
  const match = /^ref: refs\/heads\/(.+)$/.exec(head);
  if (!match) throw Error('detached');
  return match[1];
}

function preTool(input, getBranch = branch) {
  try {
    if (!input || input.hook_event_name !== 'PreToolUse' || typeof input.tool_name !== 'string') throw Error('input');
    const name = input.tool_name.split(/[./]/).at(-1).toLowerCase();
    const args = input.tool_input;
    const cwd = input.cwd || ROOT;
    const paths = [];
    let added = '';
    let mutating = false;
    if (name === 'apply_patch') {
      const patch = typeof args === 'string' ? args : args?.command ?? args?.input ?? args?.patch;
      if (typeof patch !== 'string' || !/^\*\*\* Begin Patch\r?\n/.test(patch) || !patch.trimEnd().endsWith('*** End Patch')) throw Error('patch');
      for (const line of patch.split(/\r?\n/)) {
        const header = /^\*\*\* (?:(?:Add|Update|Delete) File|Move to): (.+)$/.exec(line);
        if (header) paths.push(header[1]);
        if (line.startsWith('+')) added += line.slice(1) + '\n';
      }
      if (!paths.length) throw Error('patch');
      mutating = true;
    } else if (['write', 'edit', 'write_file', 'read', 'read_file'].includes(name)) {
      paths.push(args?.file_path ?? args?.path ?? args?.filePath);
      mutating = !['read', 'read_file'].includes(name);
      if (mutating) {
        added = args?.content ?? args?.new_string ?? args?.newText;
        if (typeof added !== 'string') throw Error('write');
      }
    } else if (['bash', 'exec_command', 'shell', 'shell_command'].includes(name)) {
      const command = args?.cmd ?? args?.command;
      if (typeof command !== 'string') throw Error('shell');
      // Deliberately narrow lexical checks, not a shell parser or authorization engine.
      if (/\bgit\s+(?:push\b[^\r\n]*(?:--force|--delete|\b(?:main|preview)\b)|reset\s+--hard|clean\s+[^\r\n]*-[a-z]*f|(?:checkout|switch)\s+(?:main|preview)\b|merge\b)/i.test(command)) {
        return deny('Omega: protected branch or destructive Git operation requires a separately reviewed workflow.');
      }
      if (/(?:^|[\s"'\/\\])\.env(?:\.[a-z0-9_-]+)?(?:[\s"';]|$)/i.test(command.replace(/\.env\.example\b/g, 'synthetic-template'))
        || /\b(?:id_rsa|id_ed25519|credentials\.json|auth\.json)\b/i.test(command)) {
        return deny('Omega: command references a protected sensitive-file name.');
      }
      if (hasSecret(command)) return deny('Omega: potential sensitive literal in proposed command; value withheld.');
      if (getBranch() === 'main' && /\b(?:git\s+(?:commit|push)|Set-Content|Add-Content|Remove-Item|Move-Item)\b/i.test(command)) {
        return deny('Omega: main branch mutation requires a separately reviewed workflow.');
      }
      return {};
    } else { return {}; }
    for (const file of paths) checkedPath(file, cwd);
    if (mutating && getBranch() === 'main') return deny('Omega: edit on protected main branch requires a separately reviewed workflow.');
    if (mutating && hasSecret(added)) return deny('Omega: potential sensitive literal in added content; value withheld.');
    return {};
  } catch { return deny('Omega: proposed operation could not be safely checked; use a bounded, supported input and review protected paths.'); }
}

let filterOverrides;
const gitBase = ['--no-pager', '--no-optional-locks', '--literal-pathspecs', '-c', 'core.fsmonitor=false'];
function git(args) {
  const options = { cwd: ROOT, shell: false, windowsHide: true, encoding: 'utf8', timeout: 1250, maxBuffer: 128 * 1024 };
  if (!filterOverrides) {
    // Read key names only, never config values. Disable every declared filter
    // for these subprocesses so status/diff cannot launch clean/process helpers.
    const listed = spawnSync('git', [...gitBase, 'config', '--null', '--name-only', '--get-regexp', '^filter\\..*\\.(clean|smudge|process)$'], options);
    if (listed.error || ![0, 1].includes(listed.status)) throw Error('git');
    const keys = listed.stdout.split('\0').filter(Boolean);
    if (keys.length > 32 || keys.some(key => !/^filter\.[a-z0-9._-]+\.(clean|smudge|process)$/i.test(key))) throw Error('git');
    filterOverrides = [...new Set(keys.map(key => key.replace(/\.(clean|smudge|process)$/i, '')))].flatMap(driver => [
      '-c', `${driver}.clean=`, '-c', `${driver}.smudge=`, '-c', `${driver}.process=`, '-c', `${driver}.required=false`,
    ]);
  }
  const result = spawnSync('git', [...gitBase, ...filterOverrides, ...args], options);
  if (result.error || result.status !== 0) throw Error('git');
  return result.stdout;
}

function completion(input, runGit = git) {
  if (input?.stop_hook_active) return {};
  try {
    if (input?.hook_event_name !== 'Stop') throw Error('input');
    const deadline = Date.now() + 7000;
    const current = runGit(['branch', '--show-current']).trim();
    const head = runGit(['rev-parse', 'HEAD']).trim();
    if (!/^[a-f0-9]{40,64}$/.test(head) || !current) throw Error('git');
    const entries = runGit(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=all']).split('\0');
    const files = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;
      if (entry.length < 4) throw Error('status');
      files.push(entry.slice(3));
      if (/[RC]/.test(entry.slice(0, 2))) { if (!entries[++i]) throw Error('status'); files.push(entries[i]); }
    }
    const unique = [...new Set(files)];
    if (unique.length > 64) throw Error('limit');
    let inspected = 0, skipped = 0, total = 0;
    const checked = [];
    for (const file of unique) {
      if (Date.now() > deadline) throw Error('limit');
      if (!file.startsWith('.codex/') && !file.startsWith('.agents/skills/')) { skipped++; continue; }
      const location = checkedPath(file);
      checked.push(file);
      let info;
      try { info = fs.lstatSync(location.absolute); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_FILE || total + info.size > 1024 * 1024) throw Error('limit');
      total += info.size;
      const text = fs.readFileSync(location.absolute, 'utf8');
      if (hasSecret(text)) throw Error('secret');
      if (/^(?:<<<<<<<|=======|>>>>>>>)(?: |$)/m.test(text) || /[\t ]+$/m.test(text.replace(/\r\n/g, '\n'))) throw Error('whitespace');
      if (file.endsWith('.json')) JSON.parse(text);
      if (file.endsWith('/SKILL.md') && !/^---\r?\nname: [a-z0-9-]+\r?\ndescription: [^\r\n]+\r?\n---/.test(text)) throw Error('skill');
      inspected++;
    }
    // Four metadata/diff calls plus one bounded filter-key discovery subprocess.
    if (checked.length) runGit(['diff', '--no-ext-diff', '--no-textconv', '--check', 'HEAD', '--', ...checked]);
    const protectedBranch = ['main', 'preview'].includes(current) ? ' PROTECTED BRANCH: review scope.' : '';
    return { systemMessage: `Omega engineering evidence: HEAD ${head.slice(0, 12)}; ${inspected} changed engineering files checked (size, sensitive literals, whitespace, JSON/skill headers); ${skipped} other paths not inspected.${protectedBranch} Tests, CI, device evidence and owner release gates remain separate.` };
  } catch {
    return { systemMessage: 'Omega engineering evidence UNVERIFIED: a Git, path, size, syntax, whitespace or sensitive-content check requires manual review. Values and paths withheld. No automatic continuation or action was requested.' };
  }
}

if (require.main === module) {
  const mode = process.argv[2];
  const decoder = new StringDecoder('utf8');
  let input = '', size = 0;
  process.stdin.on('data', chunk => {
    size += chunk.length;
    if (size <= MAX_INPUT) input += decoder.write(chunk);
  });
  process.stdin.on('end', () => {
    let result;
    try {
      if (size > MAX_INPUT) throw Error('limit');
      input += decoder.end();
      const payload = JSON.parse(input);
      result = mode === 'pre' ? preTool(payload) : mode === 'stop' ? completion(payload) : deny('Omega: unknown hook mode.');
    } catch {
      result = mode === 'stop' ? { systemMessage: 'Omega engineering evidence UNVERIFIED: malformed or oversized hook input; content withheld.' }
        : deny('Omega: malformed or oversized hook input; content withheld.');
    }
    process.stdout.write(JSON.stringify(result) + '\n');
  });
} else { module.exports = { preTool, completion, hasSecret, checkedPath, MAX_INPUT }; }
