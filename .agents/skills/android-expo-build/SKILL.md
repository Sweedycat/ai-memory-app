---
name: android-expo-build
description: "Prepare or inspect AI Memory Android artifact and upgrade evidence. Qualifying milestone APKs have standing zero-cost authorization; device access and installation remain separately authorized."
---

# Android Expo build

Apply the [working contract](../omega-orchestrator/references/working-contract.md).

## Workflow and responsibilities

1. Default to preparation. Read `docs/android-preview-phone-upgrade.md`, branch policy, manifests, `app.config.js`, `eas.json` and `.eas/workflows/`. `android_engineer` owns native/upgrade analysis; authorized `devops_engineer` checks ref/profile/trigger/artifact evidence.
2. Record Git ref/full commit, EAS profile, app variant, original project/account and source package/version configuration separately. Source configuration and fingerprints do not establish installed package/certificate identity.
3. Separate artifact build authorization from installation authorization under the founder's clarification in AGENTS.md Rule 08. Before an artifact-only build, verify exact source/CI, approved pipeline/variant/package, historical artifact identity, reproducible signing configuration, version policy and zero-cost scope. Installed-device identity is not required to produce that authorized test artifact; keep compatibility unverified. Before any separately authorized installation, verify actual installed package, certificate and versionCode through authorized evidence. Preserve original linkage/signing; stop the affected action on a mismatch or missing required evidence. Resolve only policy ambiguities on which the proposed action depends.
4. Apply V3's standing zero-cost hosted delivery authority after independent review and successful exact-SHA CI. Make user-facing increments APK_READY with the existing GitHub Actions pipeline and a tested branch-scoped one-build-per-approved-checkpoint path; founder-triggered readiness is acceptable. Record exact source, expected version/code and artifact destination. If triggering, publish the acknowledged run URL immediately and let it complete independently; no long interactive Gradle waiting or repeated polling. Verify current produced metadata before incrementing and actual APK identity/integrity before claiming APK_VERIFIED. Follow the [delivery policy](../../../docs/feature-delivery-policy.md), preserve package/signing, installation gates, zero cost and quota. Documentation/invisible refactoring do not independently require APKs. No default-branch workaround, substitute package/key, retry loop or device action.

## Verification and completion

Distinguish APK_READY, BUILD_TRIGGERED, BUILD_RUNNING, APK_VERIFIED, FOUNDER_ACCEPTANCE_PENDING and ACCEPTED. A ready workflow is not a built APK. Give the workflow/run link, exact trigger instructions/branch/source, expected version/code, artifact destination and focused Turkish acceptance checklist. Installation remains separately gated on actual installed identity, recovery/preservation and authorization. Physical evidence is risk-targeted; do not repeat every previously successful check. Do not claim compatible installation, secure migration or commercial readiness from CI/artifact evidence.
