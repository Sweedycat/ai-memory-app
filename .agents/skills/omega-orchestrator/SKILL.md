---
name: omega-orchestrator
description: "Coordinate multi-part AI Memory engineering tasks, ownership, integration and evidence. Use for cross-domain planning; keep single-subsystem work in its focused skill."
---

# Omega orchestrator

Apply the [working contract](references/working-contract.md).

## Workflow and responsibilities

1. As Principal Architect, establish the owner's outcome, allowed actions, branch/full HEAD/status, applicable rules and affected architecture. Preserve conflicting owner policies as unresolved; stop only the dependent action.
2. Decompose by deliverable and boundary. Prefer direct work for small tasks. When delegation is authorized, select the smallest useful team from `.codex/agents/`; pass a bounded question, baseline, allowed paths, read/write scope, constraints and expected evidence. Inherit model/reasoning; prohibit nested delegation.
3. Route application work to `software_engineer`, native work to `android_engineer`, persistence to `data_engineer`, CI to `devops_engineer`, UX to `ui_ux_engineer`, local briefing quality to `ai_engineer`, measured performance to `performance_engineer`, and wearable contracts to `wearables_engineer`. Use read-only `qa_engineer`, `security_engineer` or `independent_reviewer` only when needed.
4. Assign one writer per file; serialize shared edits. Inspect actual changes before integrating, reconcile dependencies, then freeze the diff for independent review. Rule 11 reviewers must not have implemented the reviewed change.

## Verification and completion

Check the entire diff, new files, relevant tests, policy consistency and final Git state. Record exact reviewed identity, findings, evidence classes and missing gates. Deliver the owner's outcome with changed paths, risks and next steps under Rule 18; passing checks grants no release authority.
