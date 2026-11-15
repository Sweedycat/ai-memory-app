---
name: automated-testing
description: "Plan, implement or evaluate focused AI Memory automated tests and regression evidence. Use for test coverage work; Android end-to-end observations remain separate."
---

# Automated testing

Apply the [working contract](../omega-orchestrator/references/working-contract.md).

## Workflow and responsibilities

1. Map changed behavior and failure risks to current `tests/*.test.cjs`, synthetic TypeScript execution helpers and package scripts. Choose observable outcomes rather than tests that copy implementation.
2. Authorized read-only `qa_engineer` owns scenarios, gaps and evidence assessment; the assigned implementation writer owns fixtures/test edits and artifact-producing runs. Use `data_engineer` or `android_engineer` analysis only for relevant boundaries.
3. Use fabricated cases for legacy/empty data, read/validation failures, gates, permission denial/revocation, reminders and native contracts as affected. For crypto/restore include Rule 09 failure cases and rollback requirements; do not enable capabilities to test with owner data.
4. Run relevant focused tests, `npm run typecheck` and `npm run test:unit` as applicable using installed dependencies. Inspect CI's Node 22 requirements and record local environment differences. Do not install dependencies or fetch Expo Doctor during a read-only check; obtain required authorization for those actions.

## Verification and completion

Record exact commands, exit results, meaningful assertion outcomes and omitted checks. Distinguish unit, mocked integration, native synthetic diagnostics and real-device tests. Finish when changed behavior and relevant regressions have evidence or explicit blockers; stop dependent work on mandatory failures, never weaken assertions or claim simulated backup/device readiness.
