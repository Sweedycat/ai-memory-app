---
name: bug-investigation
description: "Investigate an AI Memory failure, regression or unexplained result through safe reproduction and root-cause evidence. Do not treat diagnosis as authorization to fix."
---

# Bug investigation

Apply the [working contract](../omega-orchestrator/references/working-contract.md).

## Workflow and responsibilities

1. Capture expected/observed behavior, affected commit/environment, reproduction conditions and evidence gaps without logging personal records or raw errors. Reproduce with fabricated inputs and narrow searches before proposing changes.
2. Rank hypotheses and run the smallest discriminating checks. `software_engineer` traces application control flow; use `data_engineer` for load/validation/write behavior, `android_engineer` for lifecycle/permissions or read-only `qa_engineer` for regression analysis when delegation is authorized.
3. Trace failures through callers and persistence/gates/native boundaries. Preserve original storage bytes and prevent overwrite on validation failure; never reset data, seed demo records or bypass a failed gate to reproduce.
4. Separate confirmed cause from suspicion. If fixing is authorized, assign a writer and add a meaningful regression case, then apply the feature-development verification relevant to the fix. Otherwise return a bounded proposed correction.

## Verification and completion

Provide a synthetic reproduction or explain why reproduction is unavailable; cite source/test evidence and excluded hypotheses. For implemented fixes, rerun the reproducer, relevant unit tests and typecheck. Finish with root cause confidence, affected paths, preservation risks and remaining investigation/fix gates; never assign a release version from generic patch semantics.
