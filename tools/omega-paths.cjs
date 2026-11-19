'use strict';

const fs = require('node:fs');
const path = require('node:path');

function samePath(left, right) {
  const a = path.resolve(left), b = path.resolve(right);
  if (process.platform !== 'win32') return a === b;
  if (a.toLowerCase() !== b.toLowerCase()) return false;
  // Avoid conflating distinct entries in an NTFS case-sensitive directory.
  try { const x = fs.statSync(a, { bigint: true }), y = fs.statSync(b, { bigint: true }); return x.dev === y.dev && x.ino === y.ino; }
  catch { return false; }
}
function gitEnvironment(root, source = process.env) {
  const env = Object.fromEntries(Object.entries(source).filter(([key]) => !/^GIT_/i.test(key)));
  Object.assign(env, { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' });
  const count = Number(source.GIT_CONFIG_COUNT || 0);
  let rootTrusted = false;
  if (Number.isSafeInteger(count) && count >= 0 && count <= 32) for (let i = 0; i < count; i++) {
    // Preserve only an already supplied runtime trust entry for this exact root.
    // Never create trust, carry wildcard/other-root trust, or expose values.
    if (source[`GIT_CONFIG_KEY_${i}`]?.toLowerCase() === 'safe.directory') {
      const value = source[`GIT_CONFIG_VALUE_${i}`];
      if (value === '') rootTrusted = false; // Git's empty value resets earlier entries.
      else if (typeof value === 'string' && path.isAbsolute(value)
        && (process.platform !== 'win32' || path.parse(value).root.length > 1)
        && samePath(value, root)) rootTrusted = true;
    }
  }
  if (rootTrusted) Object.assign(env, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: root });
  return env;
}

function ordinary(file, directory = false) {
  const info = fs.lstatSync(file);
  if (info.isSymbolicLink() || !(directory ? info.isDirectory() : info.isFile())) throw Error('unsafe_path');
  return info;
}
function bounded(file, limit = 128 * 1024) {
  if (ordinary(file).size > limit) throw Error('size_limit');
  return fs.readFileSync(file, 'utf8');
}
function within(root, value, cwd = root) {
  if (typeof value !== 'string' || !value || /[\x00-\x1f]/.test(value)) throw Error('unsafe_path');
  const slash = value.replace(/\\/g, '/');
  if (slash.startsWith('//') || slash.split('/').includes('..')) throw Error('unsafe_path');
  // Interpret either separator consistently, including on Linux.
  const absolute = path.resolve(cwd, slash);
  const relative = path.relative(root, absolute).replace(/\\/g, '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative) || relative.includes(':')) throw Error('unsafe_path');
  const parts = relative.split('/');
  if (parts.some(p => !p || /[. ]$/.test(p) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)
    || ['.git', '.aws', '.ssh', '.gnupg'].includes(p.toLowerCase()) || /^\.env(?:\.|$)/i.test(p)
    || /^(?:auth|credentials|secrets|tokens)\.json$/i.test(p) || /\.(?:jks|keystore|p12|pfx|pem|key)$/i.test(p)
    || /^(?:id_rsa|id_ed25519|google-services\.json)$/i.test(p))) throw Error('protected_path');
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw Error('linked_path'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { absolute, relative };
}

// Linked worktree metadata may live outside the worktree. Only Git's reciprocal
// admin layout is accepted; it is never an instruction/script loading location.
function gitLayout(root) {
  ordinary(root, true);
  if (!samePath(path.resolve(root), fs.realpathSync(root))) throw Error('linked_root');
  const marker = path.join(root, '.git');
  const info = fs.lstatSync(marker);
  if (info.isSymbolicLink()) throw Error('linked_git');
  let gitDir = marker, linked = false;
  if (info.isFile()) {
    const match = /^gitdir: ([^\r\n\x00]+)\r?\n?$/.exec(bounded(marker, 4096));
    if (!match) throw Error('git_layout');
    gitDir = path.resolve(root, match[1]);
    ordinary(gitDir, true);
    if (!samePath(fs.realpathSync(gitDir), gitDir)) throw Error('linked_admin');
    const common = path.resolve(gitDir, bounded(path.join(gitDir, 'commondir'), 4096).trim());
    ordinary(common, true);
    if (!samePath(fs.realpathSync(common), common) || !samePath(path.dirname(gitDir), path.join(common, 'worktrees'))
      || !/^[a-zA-Z0-9._-]{1,100}$/.test(path.basename(gitDir))
      || !samePath(path.resolve(gitDir, bounded(path.join(gitDir, 'gitdir'), 4096).trim()), marker)) throw Error('git_backlink');
    linked = true;
  } else if (!info.isDirectory()) throw Error('git_layout');
  const head = bounded(path.join(gitDir, 'HEAD'), 4096).trim();
  return { gitDir, linked, head };
}

module.exports = { within, bounded, gitLayout, samePath, gitEnvironment };
