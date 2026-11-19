# Phase 4 unified Cloud compatibility

Scope: engineering tooling only, based on clean
`development/omega-commercial-mvp` at
`95cb1deb51941b5164f4f2324ed7fda37e878c17`. Local and live remote SHA equality
was verified on 2026-11-19. No app source, feature flag, version, storage, device,
signing, product acceptance result or financial policy changes.

## Evidence model

`node tools/omega-runtime.cjs` collects bounded read-only OS, source identity,
branch/full SHA, dirty state, linked-worktree metadata, Node/npm and dependency
evidence. `VERIFIED` means the particular observation succeeded; `UNSUPPORTED`
means an observed interface/configuration mismatch; `UNTESTED` preserves missing
or failed evidence. Failure is not proof of permanent lack of support. Inventory
of eleven roles and twelve skills is separate from runtime activation.

The detector makes no network request and reads no account/session/credential
files. It cannot discover its host's tool schema or official quota from Node.
The pure `executionPlan` accepts only selected boolean observations; its output
explicitly labels caller-supplied evidence as unauthenticated. A caller must cite
the current actual interface/invocation. Environment variables, Linux, directory
names and TOML files do not authenticate a managed Cloud environment. No telemetry
percentages are invented or persisted.

| Capability | Current Windows evidence | Founder Cloud acceptance evidence supplied with Phase 4 |
| --- | --- | --- |
| Independent host | Actual `win32` commands in this task | Managed Linux x86_64 runs independently of workstation: VERIFIED, founder observation |
| Source | Approved branch/full baseline reverified | Initial `work` at old main `35f5238a90a901f410383594f9bbeffee5d3d7a0`; only origin/main initially; bounded target ls-remote/fetch and exact-SHA detach succeeded; clean tree preserved |
| Role definitions | Eleven files preserved | Eleven TOML files present; inventory only |
| Registered specialist invocation | Native DevOps/Security/QA dispatch recorded in validation as executed | `agent_type` selection unavailable in tested interface: UNSUPPORTED there; generic delegation is a separate observation |
| Skills | Twelve source files preserved; relevant instructions actually loaded in task | Twelve files exist but native inventory empty; native activation unverified; repository loader alternative provided |
| Hooks | Original Windows launcher/config preserved; subprocess tests separate from host event evidence | Existing Windows command paths incompatible with Linux; native hook execution UNTESTED |
| Node/dependencies | Initial Node 24.19.0, npm 11.17.0; Node22 validation separately recorded | Founder saw Node 24.22.1 and node_modules; selected-source lock/install compatibility UNTESTED |
| Network | Target ref observation succeeded under authorized network access | Target branch ls-remote/fetch succeeded; earlier operation stalled roughly 35 minutes before cancellation |
| Quota | Only fresh official observations can establish live allowance | No official live Cloud telemetry supplied; founder percentages at authorization are historical |

This table preserves the founder's real probes without repeating them. The new
startup, Linux execution, hooks, regression suite and specialist/skill alternatives
still require acceptance on the actual selected Cloud runtime.

## Execution adapters

**Mode A: Native Specialist Mode.** Invoke registered Omega `agent_type` only
after the current interface and successful dispatch establish support. Preserve
the existing Windows configuration, inherited model/reasoning, task routing,
two-specialist cap, one writer per file and no recursive delegation.

**Mode B: Role-Guided Cloud Mode.** Read the relevant existing definition with
`node tools/omega-runtime.cjs --role security_engineer` (or another approved
role). Use actual separate delegation only if exposed. Report it as role-guided,
never registered native execution. Read-only review roles stay read-only even
though their sandbox is inherited. If no separate execution is available, record
independent review as unavailable and defer changes requiring it; self-review
cannot satisfy Rule 11. There is no model router, API key, remote agent service
or model API dependency.

Native skills remain preferred when actually discovered. Otherwise
`node tools/omega-runtime.cjs --skill github-ci` returns the selected existing
SKILL.md, AGENTS and shared working contract with hashes and explicit manual-load
label. Names are fixed allowlists; paths/URLs are not accepted. It does not run
scripts, recursively import Markdown or download instructions. Read relevant
local references under the same repository with the same path limits. Higher
priority runtime instructions and current owner scope prevail. No duplicate skill
or role definitions are introduced.

## Hooks and explicit alternative gate

`.codex/hooks.json` remains unchanged to preserve existing Windows behavior and
trusted launch definitions. The hook script now normalizes both path separators,
verifies reciprocal linked-worktree admin metadata and refuses to inspect a cwd
outside its own checkout. It does not trust an arbitrary `.git` file, symlink or
junction. Admin metadata outside a linked worktree is accepted only through the
reciprocal Git layout; it is never used to load executable instructions.

The fixed Windows launcher is still unsuitable for Linux, and a launcher tied to
the primary checkout must not evaluate another worktree's branch. On a runtime
without a verified native launcher/event use the **explicit verification gate**:

```sh
node tools/omega-runtime.cjs --gate BASE_SHA ACTUAL_TASK_BRANCH TASK_SLUG tools/owned-file.cjs tests/owned-file.test.cjs
```

Supply a full immutable base SHA and every exact owned file; directories and
implicit ownership are not accepted by the gate. It checks actual source,
engineering-only changed paths, bounded content, sensitive literals, symlinks,
whitespace and conflicts without changing files. Deleted/renamed paths must also
be owned. It returns no grant of authorization or exclusive lock. It does not
validate app data, execute arbitrary shell, verify tests/review, or freeze a
concurrent writer. Establish one writer first; repeat immediately before an
authorized checkpoint. Native sandbox/approval controls remain authoritative.

This is cooperative verification, **not native hook enforcement**. Missing native
controls do not permit credentials, external personal-data transfers, signing,
authentication/privacy activation or destructive recovery. Those operations stay
blocked pending separately reviewed controls, independent review and applicable
owner/device gates. The Node gate rejects its `sensitive` API option. Do not use
its successful result as a capability/approval token.

Official [hooks documentation](https://learn.chatgpt.com/docs/hooks) separates
local trusted command hooks from Cloud orchestration. It also documents that
some hook errors/timeouts can allow execution; neither alternative gate nor
existing lexical hook checks are complete sandbox enforcement. We change no
trust settings, approval rules, OAuth scopes or account configuration.

## Founder-ready source and dependency startup

Use the existing authorized environment for `Sweedycat/ai-memory-app`. Do not
change GitHub's default branch. Current official
[Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments)
use **Install script** and **Start skill**; the
[legacy surface](https://learn.chatgpt.com/docs/environments/cloud-environment)
uses **setup script**, optional **maintenance script**, and **Set package versions**.
Use the fields actually present. Configuration changes are founder actions;
none were made by this implementation. Source refresh may happen after setup,
so each engineering task must recheck source before writing.

1. Select Node **22**, matching existing CI. The scripts refuse Node24. Set the
   actual root `/workspace/ai-memory-app` via `OMEGA_REPO_DIR` only if necessary.
2. Obtain the current approved development full SHA from GitHub. If it differs
   from the checkpoint accepted by the founder, stop and review the newer work.
   Never silently use old main or a moving branch as an expected SHA.
3. Pin `OMEGA_EXPECTED_SHA` and the two public blob SHA256 values from the
   [Phase 4 validation record](PHASE4-VALIDATION.md). Hashes apply to Git blob
   bytes, not CRLF working copies. Do not derive trust from a downloaded script
   and a hash supplied by the same unreviewed source.
4. Paste the reviewed [.codex/cloud/setup.sh](../../.codex/cloud/setup.sh) into
   Install/setup. It can run even when the checkout is old main on task branch
   `work`: it downloads only the pinned bootstrap/path helper from the fixed
   authoritative repository, verifies both hashes in an isolated temporary
   directory and runs them against the actual repository root. HTTPS has 5s
   connect/20s transfer limits, no redirects or retries. No app records leave
   the machine. Public source access is required; no credential workaround.
5. For a clean **initial** `work` task at old source, set
   `OMEGA_INITIAL_DETACH=1` only for this initialization. The bootstrap refuses
   current `main`/`preview` branches. It verifies remote identity and exact SHA,
   fetches only the necessary branch with 20s ref/30s fetch limits, verifies
   FETCH_HEAD and cleanliness again, then explicitly detaches without force.
   Without that option it refuses differing source. An already-correct safe
   platform task branch is preserved. Set this option back to `0` afterward.
6. Set `OMEGA_INSTALL_DEPS=1` for the authorized setup installation. It performs
   bounded `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0
   --fetch-timeout=30000 --maxsockets=2`, 120s outer timeout plus 5s termination
   grace. No lifecycle scripts run. A failure stops startup; no uncontrolled
   retry or manifest/lock change. Existing node_modules alone is insufficient.
   Use `0` for an already-prepared task; `npm ls` still must pass. Final
   `node tools/omega-runtime.cjs --ready "$OMEGA_EXPECTED_SHA"` refuses completion
   unless source is clean at that SHA and source/Node22/npm/dependency evidence
   is VERIFIED. Optional native/Cloud observations remain separate and unknown.
7. Copy [.codex/cloud/START.md](../../.codex/cloud/START.md) into Start skill,
   or use it verbatim as the task startup instruction in the older surface.
   A legacy maintenance script must use detach/install disabled and preserve
   active work; do not run the initial selector over dirty tasks.

The bootstrap blocks custom Git hooks requiring review, configured URL rewrites,
dirty submodules and unexpected origin. It disables content-filter execution for
its bounded Git calls, not Omega security controls. Credential helpers/prompts are
not invoked; anonymous HTTPS access must work. A partial failed Git transfer may
leave harmless objects/FETCH_HEAD, and failed npm ci may leave incomplete
node_modules. Stop and inspect; existing source/owner data is never reset.

There is no atomic cross-process checkout lock. Ownership is mandatory before
source selection. The existing Unified Workspace advisory planner remains the
shared conflict model; no automatic sync, merge or push is introduced.
Windows path comparisons reject symlink/junction components before native DOS
short-name canonicalization and require matching filesystem identity across
drive-letter casing; Linux stays case sensitive. Existing runtime Git trust is retained only
for an effective absolute exact-root `safe.directory` entry already supplied by
the host, with reset ordering preserved. No wildcard trust or new global trust is
added to work around a refusal.

## Minimal next actual Cloud acceptance

One founder-started task using the pinned checkpoint, no paid credits:

1. Run the prepared startup once in a clean task, then record OS, Node/npm,
   actual root/branch/full HEAD, clean status and detector output. Verify the
   platform did not refresh it to old main after installation.
2. Run `node --test tests/omegaRuntime.test.cjs tests/omegaCloudBootstrap.test.cjs
   .codex/hooks/omega-hooks.test.cjs`, `npm run typecheck`, `npm run test:unit`
   and the existing Doctor requirement once on selected-source dependencies.
3. Load one relevant skill and one role with the repository loader. Record manual
   loading separately from native discovery. Examine the current delegation
   interface; invoke registered roles only if actually supported. If generic
   delegation exists, obtain a separate bounded read-only role-guided review;
   otherwise mark independent review unavailable.
4. Inspect native hook inventory/trust and a safe synthetic event only if that
   runtime exposes them. Record unsupported/untested separately; do not claim
   the explicit gate was a native event. No sensitive activation is included.
5. Return a sanitized handoff with source SHA, task branch, owned paths, exact
   tests/review, capability classifications and remaining gates. No app data,
   credentials, account identifiers or raw quota responses in public Git.

Checkpoint after this bounded milestone. Apply the founder's replacement
[permanent quota policy](USAGE-STATUS.md#permanent-quota-policy) equally to both
windows; the older Phase4 reassessment/reserve restrictions are superseded.
Without reliable official telemetry, complete at most this one bounded milestone
then stop; do not calculate a precise consumption estimate or chain work.
Prepare earlier if checkpoint, authorized GitHub sync, CI evidence or handoff
needs headroom. No purchased credits/top-ups or automatic reset resume; backend
denial stops work. No service, subscription, port or daemon is provisioned.
Actual Cloud Phase4 acceptance remains **pending**.
