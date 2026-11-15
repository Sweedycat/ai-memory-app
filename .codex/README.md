# Repository specialist agents

The main agent is Principal Architect. `config.toml` defines its orchestration
instructions and caps concurrently open subagents at two (excluding the main
agent). Eleven standalone files in `agents/` define the requested specialists;
the `name` field is the runtime identifier. Model, reasoning, provider, service
tier, sandbox and approval settings inherit. No global settings are changed.

| Runtime name | Responsibility | Default authority |
| --- | --- | --- |
| `software_engineer` | Application logic and integration | Inspect; assigned-file implementation only |
| `security_engineer` | Privacy, consent, crypto and transfer review | Read-only |
| `qa_engineer` | Regression analysis and validation evidence | Read-only |
| `android_engineer` | Native lifecycle, permissions and upgrade safety | Inspect; assigned-file implementation only |
| `data_engineer` | Persistence, compatibility and recovery | Inspect; assigned-file implementation only |
| `devops_engineer` | CI, workflows and release-gate preparation | Inspect; assigned-file implementation only |
| `ui_ux_engineer` | Phone-first UX, accessibility and consent | Inspect; assigned-file implementation only |
| `performance_engineer` | Measured latency and bounded resource use | Inspect; assigned-file implementation only |
| `ai_engineer` | Local briefings/search and synthetic evaluation | Inspect; assigned-file implementation only |
| `wearables_engineer` | Opt-in future wearable interfaces | Inspect; assigned-file implementation only |
| `independent_reviewer` | Frozen-diff correctness and safety review | Read-only; must not be the implementation author |

All roles must read and preserve `AGENTS.md`. Delegation does not authorize
implementation, personal-data access, releases or external writes. The owner or
applicable project/skill instructions must authorize delegation for a task.
Select only the specialists needed; give each a bounded question, paths,
read/write scope, baseline and required evidence. One writer owns each file;
parallel writes require disjoint files or an explicitly isolated worktree.
Freeze the diff before independent review. Rule 11 changes remain disabled or
unpromoted until qualified independent review, applicable tests and owner approval.
No role may use paid external services. Apps, plugins, memories and permission
requests are disabled in each specialist; shell access is retained for necessary
repository inspection. Shell commands and inherited MCP tools remain subject to
task authorization and all repository rules.

## Verified configuration surface

Inspected native installation: `codex-cli 0.169.0`; `features list` reports
`multi_agent_v2 stable true`. The official
[Subagents guide](https://learn.chatgpt.com/docs/agent-configuration/subagents.md)
documents project `.codex/agents/*.toml`, required `name`, `description` and
`developer_instructions`, inherited model settings and supported capability
reductions. See also the
[configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).
Do not substitute legacy role/config-file examples or guess per-agent sandbox keys.

Custom agent files cannot establish their own sandbox, approval policy, provider
or MCP server configuration. Read-only roles are instruction restrictions, not
separate OS permissions. Use a read-only parent session if technical read-only
enforcement is required. Existing inherited MCP capabilities are not individually
revoked by these files. Do not claim universal tool isolation or paid-service
blocking at the operating-system level.

## Reproduce the local probe

Run `node .codex/verify-agents.cjs <installed-native-codex-executable>` from a
normal permitted shell. This uses only the installed CLI and Node standard
library. It does not run a model turn, install packages, inspect credential
files or print prompts/effective configuration. It verifies CLI version, the
V2 flag, strict startup parsing and discovery of all eleven names in the native
developer context; it emits SHA-256 identifiers for the twelve TOML files.
`--strict-config` is supported on `app-server`, not `debug prompt-input`.

Project config is loaded only for a trusted repository. A previously running
conversation may need a new session to discover new files. This host's current
`collaboration.spawn_agent` interface exposes `task_name`, not a custom-role
selector: explicitly reading a role file in its delegation test does not prove
automatic custom-role application. The native discovery probe is separate
evidence. No technical role sandbox, Android readiness or application behavior
is established by these checks. Application tests/device checks are unnecessary
for this configuration-only change and no build/install is authorized.

## Phase 03 validation record (2026-11-15)

- Baseline and final branch: `preview`; HEAD:
  `a438003b308d545dcd94a7a6e5495e1c0633de69`.
- Existing untracked `AGENTS.md` was preserved. Only `.codex/` files were added;
  application source, dependencies, versions and global permissions were untouched.
- Native local probe: exit 0; CLI `0.169.0`, V2 stable/enabled, strict startup
  PASS, Principal Architect loaded, all eleven custom agents discovered. The
  native spawn tool exposes `agent_type`; the current host wrapper does not.
- `node --check .codex/verify-agents.cjs`, `git diff --check`, new-file
  `git diff --no-index --check` and whitespace/conflict scans passed. Git emitted
  only LF-to-CRLF conversion notices. App tests, Expo Doctor and Android checks
  were not run because no application behavior or dependency changed.
- Minimal delegation: one `independent_reviewer` subagent, fresh context,
  inherited model, no nested delegation. It explicitly loaded its role TOML and
  read the config, eleven definitions, validator and this guide. It reported no
  actionable findings and no writes. This is an instruction-following read-only
  test, not a test of automatic `agent_type` selection or OS sandbox isolation.
- Independent reviewer checked the frozen twelve-TOML set against this HEAD;
  the manifest SHA-256 (SHA-256 of UTF-8 `JSON.stringify(manifest)` using the
  validator's emitted ordered file/hash entries) is
  `4a46bfcd11d3ddb9611324e9b44d2742fccccd4f426b5c687c4df45f5a41d342`.
  It independently confirmed config SHA-256
  `33b85b542465b25911a70440fe056aba8f002596580eea051ee6238713ce31ac`
  and reviewer-role SHA-256
  `39ca5fb3fe2fe65bdd8ca32837ff79557904e07310eb511173b9ed32897ba8e4`.
  Native probe results were lead-observed evidence, not rerun by the reviewer.
  This record was appended after review; the TOMLs remained unchanged.
- No package installs, secret-file inspection, paid external services, commits,
  pushes, merges, application builds, installations or deployments occurred.
  The official documentation download needed explicitly approved network access;
  native configuration probes needed a permitted shell because the restricted
  shell could not resolve the Codex home directory. No global policy was changed.
- Next: use a new trusted project session for automatic custom-role selection;
  use a read-only parent sandbox when enforced read-only access is required.
