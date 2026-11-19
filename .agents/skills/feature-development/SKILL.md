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

Follow AGENTS.md Rule 09 and the [permanent delivery policy](../../../docs/feature-delivery-policy.md): compare existing/new screens with the application-wide design system and verify complete Turkish/English localization without mixed interface labels. Run relevant security/unit/regression checks and `npm run typecheck`; check persistence, settings/gates and native boundaries. Obtain independent review, commit/push within authorization and verify exact-SHA CI, then deliver one verified free Preview APK and focused Samsung Galaxy S26 Ultra checklist under standing build authorization. Await founder observations, record/prioritize corrections and keep the next major feature gated on required device acceptance. Distinguish source completion from full acceptance; preserve existing data, installation/security gates, zero spending and the 1% quota stop. Documentation-only and invisible refactoring do not independently require APKs; narrower current-task limits prevail.
