---
name: feature-development
description: "Implement an authorized AI Memory application feature or behavior change. Use bug-investigation for unexplained failures and release-management for promotion."
---

# Feature development

Apply the [working contract](../omega-orchestrator/references/working-contract.md).

## Workflow and responsibilities

1. Translate the request into observable acceptance criteria and compatibility requirements. Inspect `index.tsx`, `App.tsx`, affected components/hooks/utils/types and current manifests. Consult branch policy; keep unfinished product work off `main` and follow the owner's authorized branch scope.
2. `software_engineer` owns assigned implementation files. Bring `ui_ux_engineer` for phone accessibility/navigation, `android_engineer` for native lifecycle, `data_engineer` for persistence, or `ai_engineer` for local briefing/search only when those boundaries matter and delegation is authorized.
3. Make the smallest coherent change. Preserve existing features, legacy and intentionally empty records, gate failure handling and reminder semantics. Do not upgrade dependencies, connect AI/cloud services or activate prototypes by implication.
4. Identify privacy/authentication/transfer/migration changes early. Obtain independent Rule 11 review of the frozen result; preserve all activation gates.

## Verification and completion

Run relevant meaningful unit/regression tests and `npm run typecheck`; use `npm run test:unit` for affected application behavior. Check persistence, settings/gates and native boundaries as applicable. Mark Android checks outstanding when unavailable. Finish when acceptance criteria have evidence, the full diff is reviewed, existing behavior/data are preserved and unresolved gates are explicit.
