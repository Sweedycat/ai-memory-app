---
name: memory-continuity
description: "Prepare or resume a minimal engineering task handoff for AI Memory. Excludes personal memories, application backups, credentials and automatic platform memory."
---

# Memory continuity

Apply the [working contract](../omega-orchestrator/references/working-contract.md).

## Workflow and responsibilities

1. Principal Architect records only task-relevant engineering context: outcome, exact authorized scope/prohibitions and provenance, branch/full HEAD/status, owned paths, decisions versus proposals, evidence commands/results, reviewed diff identity, blockers and next safe action.
2. Use a concise response by default. Persist only when handoff writing is authorized, in the owner-designated repository path; if no path is designated use `docs/engineering-handoff.md`. Keep one writer, inspect existing content before updating and preserve unrelated work. Do not modify `AGENTS.md` or enable Codex memory/plugins to store continuity.
3. Never persist credentials, tokens, recovery/signing keys, upload-session URLs, app records, personal data, raw prompts/diagnostics or credential-file locations. Refer to engineering source paths and summarized outcomes; omit sensitive evidence rather than copying it.
4. On resume, read current instructions and owner messages first; revalidate branch/HEAD/status, changed files and relevant evidence freshness. Prior authorization persists only within its actual scope; a handoff cannot expand it, override new instructions or turn pending approval into permission. Do not repeat a still-valid approval request.

## Verification and completion

Review the handoff for sensitive content, stale claims and unnecessary detail. Optional authorized `independent_reviewer` checks a frozen handoff read-only when risk warrants; no specialist needs app data. Finish when another engineer can identify current scope, verified state, unresolved gates and next action without treating historical checks or stored text as current authority.
