#!/usr/bin/env bash
set -euo pipefail
# Paste this reviewed file into the official Install script (or legacy setup
# script). Nothing changes account settings. Values are public source identities.
fail() { printf '%s\n' 'Omega startup blocked; preserve the checkout and inspect the documented gate.' >&2; exit 1; }
[[ ${OMEGA_EXPECTED_SHA:-} =~ ^[a-f0-9]{40}$ ]] || fail
[[ ${OMEGA_BOOTSTRAP_SHA256:-} =~ ^[a-f0-9]{64}$ ]] || fail
[[ ${OMEGA_PATHS_SHA256:-} =~ ^[a-f0-9]{64}$ ]] || fail
[[ $(node -p 'process.versions.node.split(".")[0]' 2>/dev/null) == 22 ]] || fail
cd -- "${OMEGA_REPO_DIR:-/workspace/ai-memory-app}" || fail
[[ $(pwd -P) == $(git -c core.fsmonitor=false rev-parse --show-toplevel 2>/dev/null) ]] || fail
seed_dir=$(mktemp -d /tmp/omega-phase4.XXXXXXXX) || fail
cleanup() {
  rm -f -- "$seed_dir/omega-cloud-bootstrap.cjs" "$seed_dir/omega-paths.cjs"
  rmdir -- "$seed_dir"
}
trap cleanup EXIT
for file in omega-cloud-bootstrap.cjs omega-paths.cjs; do
  curl --disable --silent --fail --proto '=https' --tlsv1.2 --connect-timeout 5 --max-time 20 --retry 0 --max-filesize 131072 \
    "https://raw.githubusercontent.com/Sweedycat/ai-memory-app/$OMEGA_EXPECTED_SHA/tools/$file" \
    -o "$seed_dir/$file" 2>/dev/null || fail
done
printf '%s  %s\n' "$OMEGA_BOOTSTRAP_SHA256" "$seed_dir/omega-cloud-bootstrap.cjs" \
  "$OMEGA_PATHS_SHA256" "$seed_dir/omega-paths.cjs" | sha256sum --check --status || fail
selection=()
if [[ ${OMEGA_INITIAL_DETACH:-0} == 1 ]]; then selection=(--detach); fi
node "$seed_dir/omega-cloud-bootstrap.cjs" --expected-sha "$OMEGA_EXPECTED_SHA" "${selection[@]}" || fail
if [[ ${OMEGA_INSTALL_DEPS:-0} == 1 ]]; then
  timeout --signal=TERM --kill-after=5s 120s npm ci --ignore-scripts --no-audit --no-fund \
    --fetch-retries=0 --fetch-timeout=30000 --maxsockets=2 > /dev/null 2>&1 || fail
fi
# No lifecycle scripts, privileged services, account linking or implicit retries.
timeout --signal=TERM --kill-after=5s 20s npm ls --depth=0 --json --ignore-scripts > /dev/null 2>&1 || fail
node tools/omega-runtime.cjs --ready "$OMEGA_EXPECTED_SHA" || fail
printf '%s\n' 'Omega source/dependency preflight complete; task ownership, independent review and Cloud acceptance remain separate.'
