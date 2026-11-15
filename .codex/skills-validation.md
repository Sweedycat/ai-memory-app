# Phase 08 project Skills evidence

Date: 2026-11-15. Baseline branch: `engineering/ai-memory-omega`. Full HEAD:
`9cd5612b8ee99ef293a70c50795b1974f092aa22`. Working tree was clean before work.

## Supported format and design

The installed Windows native package and `--version` identify **codex-cli
0.169.0**. The official [Build skills guide](https://learn.chatgpt.com/docs/build-skills.md)
documents repository discovery under `.agents/skills` from CWD through the Git
root, required YAML `name`/`description`, Markdown instructions and optional
resources. It documents `$name` invocation and implicit description matching.
Repository skills therefore live at `.agents/skills/<name>/SKILL.md`; no
configuration registration, plugin, dependency or global installation was added.
User/admin/system discovery locations are outside this change's scope.

All twelve skills use only the two required frontmatter fields. Descriptions
are JSON-quoted YAML scalars. The bundled `skill-creator` instructions and
validator source were inspected for naming/description constraints. Optional
`agents/openai.yaml` is unnecessary here; default implicit invocation policy is
preserved. The native parser independently accepted/discovered these files.

Created skill folders (each contains `SKILL.md`):

| Folder | Focus |
| --- | --- |
| `omega-orchestrator` | Principal Architect routing, ownership and integration |
| `feature-development` | Authorized application implementation |
| `bug-investigation` | Synthetic reproduction and root cause |
| `security-audit` | Read-only security and independent critical review |
| `privacy-compliance` | Project privacy controls and consent evidence |
| `android-expo-build` | Build/upgrade preparation and separate execution gates |
| `automated-testing` | Meaningful tests and classified evidence |
| `github-ci` | CI reproducibility and indirect build triggers |
| `release-management` | Candidate-specific policy and readiness decisions |
| `performance-audit` | Bounded measurements and evidence-based changes |
| `wearables-integration` | Future opt-in contracts and synthetic evaluation |
| `memory-continuity` | Minimal nonsensitive engineering handoffs |

Each defines activation scope, workflow, relevant specialist responsibilities,
constraints, verification and completion. Bodies total **2,358 words**. A single
`omega-orchestrator/references/working-contract.md` shares governance/delegation
rules. No executable skill payloads, tool dependencies or automatic operations
were introduced. `.codex/verify-skills.cjs` is a separate read-only validation aid;
`.codex/verify-skills.test.cjs` tests its rejection boundaries without writing
fixtures. Together with this report, the change adds sixteen files.

## Reproduction and observed checks

From the repository root, using the installed native executable:

```text
node --check .codex/verify-skills.cjs
node --check .codex/verify-skills.test.cjs
node --test .codex/verify-skills.test.cjs
node .codex/verify-skills.cjs
node .codex/verify-skills.cjs --native <installed-native-codex-executable>
node .codex/verify-agents.cjs <installed-native-codex-executable>
```

- JavaScript syntax and local frontmatter/name/reference/whitespace/conflict
  checks: **PASS**, 12 skills. This validator intentionally supports the emitted
  minimal YAML subset; it is not a general YAML/schema validator.
- Complete skill-tree inventory: **PASS**. Unexpected files, directories and
  symbolic links are rejected before reading skill contents. In-memory Node
  tests: **4 passed, 0 failed/skipped**, covering the current inventory and those
  three rejection paths. Tests prohibit native subprocesses and write no fixtures.
- Native strict startup parsing: **PASS**. Principal Architect project config
  loaded; all twelve exact skill descriptions and repository file paths found
  in `debug prompt-input`. Codex emits short `rN` root aliases; the probe resolves
  them to actual paths instead of assuming unabridged paths.
- Existing native agent probe: **PASS**; `multi_agent_v2 stable true`, all eleven
  registered custom roles discovered and native `spawn_agent.agent_type` exposed.
- Twelve explicit `$name` debug input probes ran successfully as CLI commands;
  full skill-body expansion was **NOT_OBSERVED for all twelve**. These are input
  inspection probes, not live skill execution, automatic routing or adherence
  tests. No standalone model turns were started for these commands.
- The restricted shell could not resolve Codex home/startup; narrowly scoped
  approved shell execution made the native probes possible. No sandbox/config
  settings changed. The default PowerShell launcher was execution-policy-blocked;
  the installed CMD/native launchers were used without changing that policy.
- Python could not launch, so bundled `quick_validate.py` was **not run**; no
  package/interpreter installation was attempted. Local checks plus actual native
  metadata parsing/discovery supply the syntax evidence above.

The initial probe's unabridged-path and body-expansion assertions failed. The
first was corrected to match observed native aliases; the second became an
explicit observation/limitation. No skill or runtime setting was changed to
force success. Native discovery and syntax are verified; live invocation remains
unverified by that debug surface. After the catalog refreshed, all twelve skills
also appeared in this live host's available-skills list. The Principal Architect
read and applied `omega-orchestrator` and `automated-testing`; the independent
reviewer read and followed `security-audit` and the shared contract. This confirms
live metadata availability and controlled instruction-following, not automatic
routing or automatic native body injection. No restart was needed on this host.

### Real native interactive invocation

The installed `app-server generate-json-schema` output verified the native
`thread/start` and `turn/start` protocol, including `UserInput` with
`type: "skill"`, `name` and absolute `path`. An ephemeral native app-server thread
with `sandbox: "read-only"` and unchanged `on-request` approval policy completed
two actual model turns: explicit `omega-orchestrator` invocation followed by
explicit `memory-continuity` invocation in the same thread. Both emitted matching
`turn/completed` events with status `completed`. This is a real interactive
protocol test, distinct from the debug-input probes and manual scenarios above.
The synthetic prompts requested no tools, delegation, persistence or account/data
inspection; the test client denied every server-to-client capability request.
Only status summaries were emitted. No new provider, service or account was added.

The test helper and generated protocol schemas were kept in the permitted temp
directory, outside the repository. Restricted native startup failed; the narrowly
approved shell was reused. An initial test assertion used the request's
`read-only` spelling for the response; generated schema inspection corrected it
to response enum `readOnly`. Only the subsequent successful run establishes the
two invocation results. Automatic skill selection and runtime policy enforcement
are not established by this test.

## Specialist work and review identity

Native `devops_engineer` (`skills_plan`) was invoked with fresh context for
read-only workflow/gate planning. It confirmed CI/build/release separation,
read-only reviewer restrictions and safe continuity requirements; no files changed.
Native `independent_reviewer` (`skills_review`) was invoked separately for frozen
file review and manual read-only scenario evaluation. All implementation writes
belong to the Principal Architect; neither specialist implemented these files.

The final fifteen-file frozen review set is twelve skills, their shared contract,
the validator and its tests. Its manifest identity, produced by the validator as
SHA-256 of UTF-8 `JSON.stringify(manifest)`, is:

```text
aa8bda8e1ba4e51185012bd30612f4242c2026a617a11afd14ad91fa35c937da
```

This evidence report is outside that implementation manifest. File hashes
identify working-tree bytes; line-ending conversion can change hashes in another
checkout.

Initial review used fourteen-file manifest
`53f98c05ec9c97bdf769ed23370da9cf36293228805e2065fb96b533ed254c40`.
It found no blocking issues and one low-priority extra-descendant validation gap.
That gap was fixed and the same independent reviewer was reused for final review
against the fifteen-file manifest above. **No blocking security, policy or
authority-expansion findings remain; the inventory finding is resolved.** The
reviewer independently confirmed the final hash, complete inventory and 4/4 tests.
All thirteen skill/contract hashes are unchanged from the initial review. The
final native probe also passed against the final manifest, reusing the previously
approved narrowly scoped command without changing security settings.

Manual read-only exercises covered all twelve skills: governance security review;
repository-only Android upgrade and release preparation; response-only continuity
handoff; empty-list/read-failure test planning and bug diagnosis; proposed sorting
feature assessment; failed-CI inspection; cross-domain ownership planning; bounded
search measurement planning; proposed microphone consent review; and fabricated
wearable disconnect contracts. Guidance preserved authorization, original data,
version ambiguities, separate device evidence and disabled-capability gates. These
are independent instruction-following simulations after reading the files, not
automatic selection, live native activation or measured application behavior.
The reviewer made no writes and did not independently rerun native probes; those
results are Principal Architect observations. Neither specialist delegated further.

## Security and remaining gates

Existing AGENTS rules, policy ambiguities, all application/tests/data, eleven
agent definitions, configuration, sandbox settings, dependencies and versions
are preserved. Engineering continuity cannot store personal memories/secrets or
turn a historical handoff into fresh authority. No credential/personal-data
sources were inspected or persisted. No critical product capability was changed,
activated or independently approved under Rule 11.

Skills and role instructions are guidance, not technical sandbox enforcement.
Systematic automatic-selection and runtime enforcement remain unverified. The
debug surface did not demonstrate expansion; the separate interactive protocol
test above verified two explicit native invocations. No application tests, Expo
Doctor, remote CI, Android/device checks or
APKs were run because this change affects engineering instructions only. No
packages, paid services, PRs, merges, builds, installations or deployments occurred.
The owner subsequently authorized the Phase 08 commit and normal fast-forward push
to `engineering/ai-memory-omega`; checkpoint outcome is reported separately after
execution. No Phase 09 work belongs in that checkpoint.

Pre-checkpoint Git review: **16 new untracked files, no tracked edits/deletions or staged
changes**; branch and full HEAD remain the baseline above. All sixteen new-file
`git diff --no-index --check` checks and tracked `git diff --check` passed.
Git emitted LF-to-CRLF conversion notices only. The initial shell harness expected
exit 0 for new-file comparisons; it was corrected to recognize `--no-index` exit 1
for differences while still rejecting whitespace output and error exit codes.
Full-file inspection and the final inventory cover every added file. The final
fifteen-file reviewed implementation manifest remains unchanged. Local evidence
was collected on Windows PowerShell with Node `v24.19.0`; application CI's Node 22
environment was inspected, not executed. Phase 08 engineering work is complete;
no release or product-capability readiness is claimed.
