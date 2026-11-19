'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');

test('Cloud launcher ignores fabricated curl config, caps seed downloads and never retries or installs by default', t => {
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
  if (!fs.existsSync(bash)) { t.skip('Bash unavailable; Linux CI must execute this launcher test'); return; }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-launcher-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.match(path.basename(directory), /^omega-launcher-/);
    fs.rmSync(directory, { recursive: true, force: true });
  });
  fs.writeFileSync(path.join(directory, '.curlrc'), 'url = "https://example.invalid/forbidden"\nupload-file = "fabricated"\n');
  const launcher = path.resolve(__dirname, '../.codex/cloud/setup.sh').replace(/\\/g, '/');
  const hash = createHash('sha256').update('synthetic seed\n').digest('hex');
  const harness = `
    set -euo pipefail
    node() { if [[ "\${1:-}" == -p ]]; then printf '22\\n'; else return 0; fi; }
    git() { pwd -P; }
    npm() { [[ "$*" == 'ls --depth=0 --json --ignore-scripts' ]]; }
    timeout() { shift; shift; shift; "$@"; }
    curl() {
      [[ "$1" == --disable ]] || { printf 'UNSAFE_CONFIG_READ\\n'; return 99; }
      [[ " $* " == *' --max-filesize 131072 '* ]] || return 98
      [[ " $* " == *' --max-time 20 '* ]] || return 97
      [[ " $* " == *' --retry 0 '* ]] || return 96
      while (( $# )); do if [[ "$1" == -o ]]; then shift; printf 'synthetic seed\\n' > "$1"; break; fi; shift; done
    }
    export -f node git npm timeout curl
    bash "$OMEGA_TEST_LAUNCHER"
  `;
  const result = spawnSync(bash, ['-c', harness], { encoding: 'utf8', windowsHide: true, timeout: 10000,
    env: { ...process.env, CURL_HOME: directory, OMEGA_REPO_DIR: directory, OMEGA_TEST_LAUNCHER: launcher,
      OMEGA_EXPECTED_SHA: 'a'.repeat(40), OMEGA_BOOTSTRAP_SHA256: hash, OMEGA_PATHS_SHA256: hash,
      OMEGA_INITIAL_DETACH: '0', OMEGA_INSTALL_DEPS: '0' } });
  assert.equal(result.status, 0, 'Synthetic launcher execution failed');
  assert(!result.stdout.includes('UNSAFE_CONFIG_READ'));
  assert(result.stdout.includes('preflight complete'));
  assert.equal(result.stderr, '');
  // Same request with mismatching expected hash must stop before source execution.
  const denied = spawnSync(bash, ['-c', harness], { encoding: 'utf8', windowsHide: true, timeout: 10000,
    env: { ...process.env, CURL_HOME: directory, OMEGA_REPO_DIR: directory, OMEGA_TEST_LAUNCHER: launcher,
      OMEGA_EXPECTED_SHA: 'a'.repeat(40), OMEGA_BOOTSTRAP_SHA256: 'b'.repeat(64), OMEGA_PATHS_SHA256: hash } });
  assert.notEqual(denied.status, 0);
  assert(!denied.stdout.includes('preflight complete'));
});
