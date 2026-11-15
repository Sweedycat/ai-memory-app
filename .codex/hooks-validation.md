# Phase 09 native engineering hooks

Date: 2026-11-15. Branch: `engineering/ai-memory-omega`. Phase 09 baseline and
remote-verified Phase 08 checkpoint:
`1a1c1fb4558e49fdb62332f6600e20bebd4d0789`.
Checkpoint message: `chore: establish AI Memory Omega project skills`.
Normal fast-forward push updated only that branch; `git ls-remote` confirmed the
same full commit. Phase 08 added sixteen files, including the validator tests.
No APK workflow targets pushes to this engineering branch.

## Supported native surface

Installed CLI: **0.169.0**, Windows native package. The official
[Hooks guide](https://learn.chatgpt.com/docs/hooks) documents project
`.codex/hooks.json`, command handlers, tool/session lifecycle events and native
trust review. The tagged [configuration schema](https://raw.githubusercontent.com/openai/codex/rust-v0.169.0/codex-rs/core/config.schema.json)
confirms event arrays, matcher groups and command/timeout/async fields.
No invented config keys, root environment variables or feature overrides were
introduced. Existing `.codex/config.toml` and custom agent definitions are unchanged.

Native feature output reports `hooks stable true`. Native strict startup parsing
passes. The installed app-server protocol schema was generated in a permitted
temporary directory; `hooks/list` recognizes the project handlers below with zero
errors/warnings. Protocol metadata uses `preToolUse`/`stop`; the JSON source uses
`PreToolUse`/`Stop`. The first probe incorrectly compared these casings; the probe
was corrected, without changing configuration to force success.

| Event | Purpose | Bound |
| --- | --- | --- |
| `PreToolUse` | Check known structured paths, patch moves/deletions, added sensitive literals, obvious prohibited Git commands | 256 KiB input; 5-second native timeout; no subprocesses |
| `Stop` | Advisory branch/HEAD/changed-engineering-file evidence, whitespace and JSON/skill-header checks | 64 paths; 128 KiB/file; 1 MiB total; at most five Git subprocesses; 10-second native timeout |

The handlers return JSON on stdout, never raw input, matched content or raw errors.
Pre-tool denials use supported `hookSpecificOutput.permissionDecision: "deny"`.
Stop uses only `systemMessage`, not a blocking continuation; repeated
`stop_hook_active` input returns an empty object. No hooks call Codex, models,
CI, npm, network services, builds or other hooks. No automatic evidence files,
transcripts or personal memory are written.

## Implementation and verification

New files:

- `.codex/hooks.json`: two synchronous native command declarations.
- `.codex/hooks/omega-hooks.cjs`: standard-library-only pre-tool and Stop handlers.
- `.codex/hooks/omega-hooks.test.cjs`: fabricated unit/mocked/subprocess scenarios.
- `.codex/verify-hooks.cjs`: local config/hash and optional native inventory probe.
- `.codex/hooks-validation.md`: this engineering evidence report.

The configured absolute script path is intentional: project hooks supply no
documented project-root variable, and native hook cwd can be nested. On Windows
the runner uses `COMSPEC`/`cmd.exe /C`. The quoted launcher was directly tested
from a nested cwd. Another checkout/OS requires a separately reviewed command-path
update and native quoting check; this configuration is not claimed portable.

Commands run:

```text
node --check .codex/hooks/omega-hooks.cjs
node --check .codex/hooks/omega-hooks.test.cjs
node --check .codex/verify-hooks.cjs
node --test .codex/hooks/omega-hooks.test.cjs
node .codex/verify-hooks.cjs
node .codex/verify-hooks.cjs <installed-native-codex-executable>
node --test .codex/verify-skills.test.cjs
node .codex/verify-skills.cjs
```

Initial hook tests: **27 passed, 0 failed**, covering protected/case/traversal/
UNC/ADS paths, present link/junction rejection, Windows absolute/backslash paths,
nested cwd, LF/CRLF patches, moves/deletions, insertion versus removal of fabricated
sensitive content, redacted findings, malformed/oversized stdin, main/destructive
Git checks, repeated Stop, Git failure, rename/deletion records, batching, file
limits, malformed JSON, whitespace, quoted JSON/bare sensitive assignments and
Git filter suppression arguments. The Windows command-launch test asserts
verified evidence output and unchanged before/after repository Git state. It does
not prove that a trusted native dispatcher executed the handlers.

QA's initial test run passed 23/23 but found that a smoke assertion accepted
`UNVERIFIED` and per-file Git calls could exceed the timeout. Both were corrected;
the expanded final suite passes. An initial Node-based Windows launcher test
failed because its argument quoting differed from the native runner; matching
`cmd.exe /C` with verbatim arguments fixed the test. Failures were not hidden or
converted into successful activation claims.

Initial native inventory: **PASS**, both handlers `enabled: true`,
`trustStatus: untrusted`. That initial implementation did not activate the hooks.
The later owner-authorized finalization below verifies both as trusted and active.
No agent trust-state write or bypass was used. Native inspection requires a
permitted shell because the restricted shell cannot resolve the Codex home.
Direct handler tests run within the existing workspace sandbox.

Initial reviewed four-file implementation manifest (SHA-256 of UTF-8
`JSON.stringify(manifest)` emitted by the verifier):

```text
13ad6880beeee09c87d27d569176c592a1be3273d785e421c9c47e0c242b3408
```

This report is outside that manifest. Native source hashes are handler declaration
hashes, distinct from this file-content review identity. Those declaration hashes
remained unchanged when invoked script bytes changed; they do not attest to script
contents. Review the full script manifest before any owner trust decision.

Historical implementation specialists: native `devops_engineer` (`skills_plan`) for schema,
events, Windows behavior and protocol planning; read-only `qa_engineer`
(`hooks_qa`) for initial 23-test coverage/evidence review; `security_engineer`
(`hooks_security`) for design and independent security review; and reused
`independent_reviewer` (`skills_review`) for frozen implementation review. The
Principal Architect alone wrote all files; no specialist delegated further.

Security review initially found two Medium issues: quoted JSON keys escaped the
assignment detector, and configured Git filters could execute additional programs.
Both were fixed and independently confirmed closed for the intended scope. The
revised 27-test suite was independently rerun by security and independent reviewers.
The final incremental timing change moved the existing seven-second deadline ahead
of Git calls; both reviewers verified the final manifest above and no new findings.
The Principal Architect reran 27/27 after that change. That initial review had no
blocking findings, but owner trust and native dispatcher verification were still
pending. Reviews do not grant activation or release approval. Finalization found
and repaired the native input mismatch described below.

## Security, limitations and rollout gate

These are **best-effort safeguards**, not an authorization engine or sandbox.
The tagged [pre-tool runtime](https://raw.githubusercontent.com/openai/codex/rust-v0.169.0/codex-rs/hooks/src/events/pre_tool_use.rs)
allows the tool to continue on hook crashes, timeouts and malformed output. Caught
input/check failures return valid denial, but external failures cannot be made
fail-closed by this script. Unknown tools, arbitrary shell/code encodings, hosted
tools and later `write_stdin` input are not comprehensively covered. Sensitive
literal patterns are deliberately limited and cannot prove absence of secrets.

Hook commands run host processes; do not assume they inherit model-tool filesystem
restrictions. See the tagged [command runner](https://raw.githubusercontent.com/openai/codex/rust-v0.169.0/codex-rs/hooks/src/engine/command_runner.rs).
The reviewed scripts use no writes or networking. Stop reads only changed regular
engineering files after path checks and bounds; application paths are counted,
not opened. Git uses argument arrays, no shell interpolation, optional locks
disabled, fsmonitor disabled and external diff/textconv disabled. Filter key names
are discovered once without reading values (maximum 32 keys); unsupported names or
discovery failures yield an unverified advisory. Per-process empty clean/smudge/
process overrides and `required=false` disable declared filter commands without
editing Git configuration. The metadata/diff work uses at most four calls plus
one key-discovery call, each capped at 1,250 ms. The seven-second elapsed budget
starts before metadata work; slow blocking filesystem operations can still trigger
the native outer timeout. Trusted, stable Git/Node executables and configuration
remain prerequisites; this is not a guarantee against concurrent tampering.

In a parent-run isolated temporary repository on Git `2.55.0.windows.3`, a required
synthetic `exit 79` filter rejected a fabricated hashing request; the empty filter
overrides preserved the exact unfiltered blob hash without stderr. No project or
owner Git configuration changed. The owned temporary target was verified before
cleanup. This is real local Git synthetic evidence, separate from mocked unit
assertions; reviewers did not repeat it. Git's
[attribute documentation](https://git-scm.com/docs/gitattributes.html#_filter)
explains filter command and required-filter behavior.

Symlink checks
are best-effort and do not eliminate concurrent filesystem replacement races.
Worktree `.git` indirection is intentionally unsupported in the pre-tool branch
check. Existing sandbox, approval, owner scope and Rule 11 gates remain binding.

The initial implementation did not change application source, existing application
tests, dependencies, versions, global configuration or system security settings.
Finalization changes only the five engineering files and the expressly authorized
local approval rules described below. No application tests, Expo Doctor, remote CI,
Android/device checks, APKs or deployments were performed; application behavior and
dependencies are unchanged. These checks are engineering/native synthetic evidence,
not Android, backup/recovery or application release-readiness evidence.

## Owner-authorized Phase 09 repair and finalization

Finalization date: 2026-11-15. Source baseline remains
`1a1c1fb4558e49fdb62332f6600e20bebd4d0789` on
`engineering/ai-memory-omega`. The owner authorized the compatibility repair,
one independent reviewer, tests, and a normal push of exactly the five Phase 09
files after all gates pass. No merge, app change, build or deployment is authorized.

Real native patch attempts exposed a gap missed by the original synthetic tests:
the installed native dispatcher supplies patch text in `tool_input.command`.
The original handler accepted a raw string or `input`/`patch`, so it incorrectly
denied harmless native patch calls. The tagged
[native patch handler](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/core/src/tools/handlers/apply_patch.rs#L348)
confirms that contract. The repaired handler reads `command` first and preserves
legacy fallback shapes and every subsequent path, branch and literal guard.

Before touching live implementation, the Principal Architect prepared frozen
local candidates. The single authorized `independent_reviewer`
(`phase09_independent_review`) inspected them read-only and reported no blocking
findings. It verified the exact one-line handler change, append-only four tests,
the two-rule transformation, syntax and 15 in-memory synthetic assertions. It
authored no implementation and delegated nothing. After mandatory runtime approval,
one scoped operation applied those exact candidates; no hook or sandbox was
disabled and no trust hash was modified.

Reviewed/applied content hashes:

| File | SHA-256 |
| --- | --- |
| `.codex/hooks/omega-hooks.cjs` | `02c539e58a124c11ac9e9cd8213a42a2e4251bbff98ebb53f7f625b832335239` |
| `.codex/hooks/omega-hooks.test.cjs` | `cdcde87a254f05bc05087e365b02bde7ead305fdaa87890d8dbe9b1dd98a4f13` |

Final four-file implementation manifest, using the existing verifier definition:

```text
916ac5c5ab3a6797c4ff512af4b99dbdc10c7eebd630bb5d3c828e4abe4996e8
```

Final observed checks:

- Hook suite: **31 passed, 0 failed**. New coverage includes actual native
  `command` input, LF/CRLF and legacy compatibility, protected paths/moves/deletions,
  main-branch/literal guards, malformed authoritative input and CLI stdin shape.
- Skill-validator suite: **4 passed, 0 failed**. Combined suites: **35/35**.
- Three hook JavaScript syntax checks and local hook/skill validators: **PASS**.
- Native hook inventory: **PASS**; CLI `0.169.0`, hooks stable/enabled, strict
  startup PASS, both handlers enabled/trusted, zero warnings. Declaration hashes
  still do not attest to script bytes; use the content manifest above.
- Native skill validator: **PASS**, strict startup and all 12 skills discovered.
  Debug prompt expansion remains `NOT_OBSERVED`; it is not claimed verified.
- Existing native agent validator: **PASS**, all 11 definitions discovered.

The same independent reviewer subsequently inspected the frozen five-file result,
reconstructed both manifests, independently reran all 31 hook tests, checked the
rule backup and inspected the supplied native evidence without replaying model
turns. It found no actionable findings or blockers for the owner-authorized
five-file commit and normal push. Skill/agent and real native results remain
Principal-Architect-run evidence; this review is not application release approval.

One ephemeral native app-server smoke turn used the inherited model/reasoning,
`workspaceWrite`, `on-request`, and `networkAccess: false`. It requested exactly
one Git read and three patch calls. Native hook notifications recorded:

| Operation | Native result | Hook duration |
| --- | --- | --- |
| `git rev-parse --is-inside-work-tree` | PreToolUse completed; command exit 0 | 403 ms |
| Add fabricated root `.tmp` marker | PreToolUse completed; patch completed | 403 ms |
| Add fabricated protected-extension `.key` marker | PreToolUse blocked before file creation | 382 ms |
| Delete the owned `.tmp` marker | PreToolUse completed; patch completed | 398 ms |
| Stop | Completed once with verified engineering evidence | 716 ms |

The driver observed the fabricated marker's expected content after creation,
verified both markers absent afterward, and matched Git state before/after.
There were zero client approval/capability requests, no hook failures or recursive
Stop continuation, and exactly two successful file-change events confined to the
owned marker. SHA-256 comparison of all 50 tracked files under application
entrypoints, `src`, and existing test directories confirmed unchanged bytes.
The final staged diff must contain only the five Phase 09 paths; application tests
and source are outside the commit. Commit and remote SHA verification are recorded
in the final task report after the authorized push.

## Phase 10 approval-rule cleanup and recommendations

The owner expressly authorized cleanup of obsolete AI Memory temporary-script
rules and the unsafe persistent engineering-push allowance. Before editing,
`C:/Users/raons/.codex/rules/default.rules` was backed up and byte-verified at
`C:/Users/raons/.codex/rule-backups/default.rules.phase09-20261115.43c7a3822d77.bak`.
The backup SHA-256 is
`43c7a3822d7743ff8f5cc227dbe3f9f6650ce1d1154beef5f9a1757d112075b3`.
The reviewed transformation:

- Removes only the allow rule for the obsolete temporary `interactive-skills.cjs`
  script under `ai-memory-omega-native-protocol-0169`.
- Changes `git push origin HEAD:refs/heads/engineering/ai-memory-omega` from
  `allow` to `prompt`, so trailing force options also require approval.
- Preserves all other rule bytes and leaves user/project config files unchanged.

The reviewed transformed-rules SHA-256 was
`c1513c90af74b0c546682e21f6bdf3fe36904e4da8120bca1b5ca598068843b1`.
At native-smoke time the normal runtime approval flow had saved one additional
exact command rule for the combined existing native hook/skill validator
invocation. Later it also saved the exact five-file staging command. These are
specific validator/staging operations, not general shell, Node, npm or Git
allowances, and were preserved as runtime-approved additions. The live rule-file
hash at native smoke verification, before the staging-rule addition, was
`367594635936bbaa030b439b8a57d33f10fccc95569fe6430c38e3fc5505e994`.
The final task report distinguishes these runtime-saved approvals from the two
owner-authorized cleanup edits; no new persistent push allowance is requested.

Policy evaluation against the actual rule file passed all nine scenarios:
normal engineering push, force suffix and force-with-lease suffix each returned
`prompt`; the existing remote-read rule returned `allow`; obsolete temporary
script, general shell, general Node, routine tests and routine Git reads had no
explicit rule and remain governed by runtime policy. These were parser/evaluator
calls only: no destructive Git operation was executed. Unmatched commands are
not claimed forbidden. Existing running sessions may cache earlier rules; use a
new session to load the cleanup. The authorized normal push still uses mandatory
runtime approval, without saving a new persistent push allowance.

Retain the verified `on-request` + workspace-write + network-off boundary.
Routine reads, edits outside protected metadata and tests can already run within
that sandbox; adding unsandboxed allow rules would expand access unnecessarily.
Batch independent read/test commands, preserve each exit status and stop dependent
work on failure. Keep edits, review, staging/commit and remote writes sequential.
Use a single narrowly scoped approval for a related batch when escalation is
necessary; never persist arbitrary shell or general interpreter prefixes.

The installed protocol schema supports `approvals_reviewer = "user"` and
`"auto_review"`. Official [Auto-review documentation](https://learn.chatgpt.com/docs/sandboxing/auto-review)
explains that eligible escalations go through a separate reviewer while sandbox
and command controls remain; it adds model usage. It was evaluated, not enabled
or reconfigured. Retain the inherited reviewer to avoid an unrequested global
behavior change and extra automatic model calls. No experimental permission
profile, network feature, custom reviewer policy or security bypass was activated.
See the official [command rules guide](https://learn.chatgpt.com/docs/agent-configuration/rules)
for prefix matching, strictest-decision precedence and restart requirements.

The local rule file and its backup are outside the repository and must not enter
the five-file Phase 09 commit. Outstanding limitations remain best-effort hook
coverage, native failure-open behavior, local absolute launcher paths, cached
session policy and unobserved debug skill expansion. None is an application
release-readiness claim.
