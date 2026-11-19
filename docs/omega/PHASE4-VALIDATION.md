# Phase 4 portability validation

Baseline: clean `development/omega-commercial-mvp` at
`95cb1deb51941b5164f4f2324ed7fda37e878c17`, local/live equality reverified.
Its exact-SHA [CI 44387226331](https://github.com/Sweedycat/ai-memory-app/actions/runs/44387226331)
was successful. Resolve the **new containing commit** and its own CI separately;
an older success is not a result for new source. Phase4 Cloud acceptance remains
pending. The founder's actual probes are attributed in
[CLOUD-COMPATIBILITY](CLOUD-COMPATIBILITY.md).

## Delivered scope and ownership

Principal Architect: `tools/omega-paths.cjs`, `tools/omega-runtime.cjs`,
`tests/omegaRuntime.test.cjs`, `tests/omegaCloudLauncher.test.cjs`, narrow
`.codex/hooks/omega-hooks.cjs` changes, `.codex/cloud/setup.sh`,
`.codex/cloud/START.md`, `.github/workflows/omega-portability.yml`, compatibility
and handoff/status docs. Native `devops_engineer`: only
`tools/omega-cloud-bootstrap.cjs` and `tests/omegaCloudBootstrap.test.cjs`;
ownership transferred back after bounded corrections. Native `security_engineer`
and `qa_engineer` are separate read-only executions, not implementation authors.
No recursive delegation or more than two concurrent specialists. Models and
reasoning inherited; native Windows dispatch does not prove Cloud dispatch.

The original eleven role definitions, twelve skills, hook launcher configuration,
AGENTS, app code, feature flags, versions, dependencies and financial/security
policies are unchanged. No app data, private records, credentials, account
identifiers or live quota responses are synchronized or committed.

## Checks and evidence classes

Windows actual host:

- Initial Node24.19.0/npm11.17.0 observed. Node22.23.5 obtained in the existing
  temporary npm cache; no project dependency/lock changes. PowerShell script
  execution policy preserved; npm.cmd/Node CLI used.
- Node22 strict TypeScript (`tsc --noEmit`, existing typecheck command): PASS.
- Complete existing `npm run test:unit` after integration: **360/360 PASS**.
  Subsequent security-specific bootstrap cases and launcher test were validated
  through the focused suite, without redundantly repeating every app test.
- Existing `npm run doctor`, Node22: **21/21 PASS**.
- Bootstrap focused final suite: **29 total, 27 PASS, 0 FAIL, 2 SKIP** on Windows.
  The skips are file-symlink privilege and FIFO availability; actual directory/
  junction and oversized-manifest cases passed. Linux CI must execute Linux cases.
- Existing hook tests: **32/32 PASS**, including actual Windows command launcher
  from nested cwd and unchanged Git state. This is subprocess evidence, not a
  newly observed native host hook event/trust attestation.
- Initial runtime tests: **11/11 PASS**, including actual temporary Git repositories,
  linked worktree/backlink checks, spaces, separator handling, junction refusal,
  scope/SHA/branch rejection and timeout. These are host integration/synthetic
  tests, not a Codex Cloud acceptance.
- Launcher test: **1/1 PASS** under Git Bash on Windows, fabricated curl config,
  bounded argument contract and wrong-hash denial. Git/Node/curl/npm are stubbed;
  no real network or real curl configuration parser is exercised by this test.
- Hook configuration validator PASS; twelve-skill syntax/reference validator
  PASS. The native agent validator requires an installed CLI path; a no-argument
  attempt correctly rejected usage. No accessible CLI executable was found on
  PATH, so its native inventory probe is unverified. Actual bounded specialist
  dispatch in this task is the narrower current participation evidence.
- Manifest/lock declarations agree; independent local `npm ls --depth=0` passed.
  Detector's conservative dependency observation can remain UNTESTED on timeout
  or unavailable npm resolution. Do not promote that to Cloud dependency proof.

Final Node22 focused run after Security/QA corrections: **75 total, 73 PASS,
0 FAIL, 2 Windows skips**, comprising 29 bootstrap, 13 runtime, 1 launcher and
32 hook tests. No changed app/TypeScript files required a second full app suite.
Exact-SHA CI is recorded in the completion report. The new portability workflow
runs Node22 on Windows and Ubuntu, focused
tool/hook/launcher tests, skill validation and Linux shell syntax. Existing
Notebook CI still runs clean npm install, Doctor, strict TypeScript and the full
regression suite on Ubuntu. CI Linux is actual Linux host execution, not actual
managed Cloud runtime acceptance. No APK, app installation, device action,
production deployment or paid service was performed.

## Independent security review

Security reviewer authored none of the reviewed implementation. Initial frozen
ten-file-scope predecessor (nine files, before launcher test) aggregate:
`8cf8d415fb46c70be3b648e580eec29a3a18e70556fd9fc4a6c747f82b17e36b`.
Found high ambient curl-config side effects, medium unbounded manifest reads,
and medium ambient Git HTTP credential consumption. Principal/DevOps corrected
all three and added focused regression coverage.

Independent re-review of ten files found **no remaining blocker in the bounded
source scope**. Frozen aggregate:
`e3b0b73f0eb68e20332927094fc077974b25be88b480c5e354dbf8aad13edc1f`.
Construction: SHA256 of PowerShell case-insensitive-sorted
`path + NUL + lowercase SHA256(raw file bytes) + LF`
records. Reviewed paths: the three tools, three tests, changed hook script,
Cloud setup/start files and portability workflow listed above. Hashes stayed
unchanged during review. Reviewer checked whitespace; no network, installs,
artifacts or tests were run by that read-only reviewer.

Closed findings: curl `--disable` first and 128KiB download cap; checked ordinary
bounded manifest files (128KiB/2MiB); names-only global/scoped HTTP/credential
configuration refusal before Git network calls. This review does not approve
app security changes, Cloud activation, release or owner/device gates.

## Public tool blob pins for founder setup

Final independent Security **and** QA reviews cover eleven frozen files: the
three tools, three tests, hook script **and hook test**, two Cloud files and
portability workflow. Both independently reported the same final aggregate:
`9bc21da7836ef89dbe321c0afcba59724957005a6bdb4f0d7d0b44dfaf89a5ca`.
This final identity supersedes the intermediate ten-file security snapshot for
current source. Use JavaScript `.sort()` ordinal case-sensitive ordering and
UTF-8 `path + NUL + lowercase SHA256(raw bytes) + LF` records, then SHA256.

QA initially found a hosted-Windows fixed-launcher CI failure and inconsistent
origin/readiness handling. Principal corrected both: fixed owner verifier is not
invoked on foreign Windows CI; subprocess tests use the configured launcher only
in its actual checkout; shared six-origin validation requires a single origin;
strict `--ready` requires VERIFIED source/Node22/npm/dependencies, exact expected
SHA and clean tree. Security and QA re-reviews found no remaining source blocker.
Both reviewers remained read-only and did not rerun parent execution evidence.
Final focused results above apply to this identity. Documentation evidence was
updated afterward under Principal ownership, with policy/link/whitespace review.

Set the expected SHA to the full **currently approved Phase4 checkpoint** shown
in the completion report and verify its remote branch equality. The SHA cannot
be embedded self-referentially in the commit containing this document. These
pins are SHA256 of LF Git blob bytes; confirm after staging/commit, not a CRLF
working-copy assumption:

```text
OMEGA_REPO_DIR=/workspace/ai-memory-app
OMEGA_EXPECTED_SHA=<full approved checkpoint SHA>
OMEGA_BOOTSTRAP_SHA256=2d7d61f4faf3573c9992a26f115fee5de297b27df3208b5d55add3d043014089
OMEGA_PATHS_SHA256=629e799e166a90012bc40b489f6c386a69476cf65eec98767ce819f07191f6e3
OMEGA_INITIAL_DETACH=1
OMEGA_INSTALL_DEPS=1
```

The two `1` options apply only to the clean initial setup authorized by this task.
Set detach back to `0` for subsequent tasks/maintenance; never overwrite active
work. Paste the reviewed setup script and Start instructions as described in
[CLOUD-COMPATIBILITY](CLOUD-COMPATIBILITY.md). No account setting was changed here.

## Remaining gates

Actual Cloud bootstrap/dependency and regression acceptance, current native skill
and delegation interface observations, and hook event support remain pending.
Generic role-guided delegation cannot be called registered specialist execution.
No separate reviewer means Rule11 work must stay deferred. The explicit gate is
cooperative verification, not native enforcement or a distributed lock.

Live official quota telemetry is unavailable in the current exposed tools;
historical founder readings are not current balances. Use bounded milestones,
the Phase4 reassessment point and global 15% checkpoint/10% stop safeguards.
No precise consumption estimate, credit purchase, paid obligation or revenue
claim is made. All existing app/device/backup gates remain as recorded.
