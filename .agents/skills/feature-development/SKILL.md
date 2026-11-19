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

Follow AGENTS.md Rule 09 and the [V3 delivery policy](../../../docs/feature-delivery-policy.md): compare existing/new screens against the shared design and verify complete Turkish/English without mixed labels. Substantial visual changes require approved design direction; independent technical preparation can continue. Run relevant security/unit/regression/type checks and inspect persistence/native boundaries. Independently review, commit/push and verify exact-SHA CI; make the increment APK_READY with a tested free hosted build path and focused Turkish Galaxy S26 Ultra checklist. A triggered run is linked immediately, never polled through Gradle. Distinguish readiness, verified artifact, founder acceptance and commercial readiness. Await feedback before the next major release increment; prioritize corrections. Preserve records, disabled sensitive gates, V3's encryption release blocker, zero spending and 1% quota stop. Documentation/invisible refactoring do not independently require APKs.
