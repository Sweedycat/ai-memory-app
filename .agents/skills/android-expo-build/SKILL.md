---
name: android-expo-build
description: "Prepare or inspect AI Memory Expo Android build and in-place upgrade evidence. Building, signing, device access and installation require task-specific authorization."
---

# Android Expo build

Apply the [working contract](../omega-orchestrator/references/working-contract.md).

## Workflow and responsibilities

1. Default to preparation. Read `docs/android-preview-phone-upgrade.md`, branch policy, manifests, `app.config.js`, `eas.json` and `.eas/workflows/`. `android_engineer` owns native/upgrade analysis; authorized `devops_engineer` checks ref/profile/trigger/artifact evidence.
2. Record Git ref/full commit, EAS profile, app variant, original project/account and source package/version configuration separately. Source configuration and fingerprints do not establish installed package/certificate identity.
3. Before an authorized build/install, verify actual installed package, signing-certificate identity and versionCode through authorized evidence without exposing credentials. Preserve original linkage/signing; stop on mismatch or unavailable verification. Resolve only owner-policy ambiguities on which the proposed update depends.
4. Run a build only when explicitly in task scope and cost is approved; never provision substitutes or regenerate credentials. Independently inspect any produced APK identity and confirmed update-code policy before separately authorized installation. Never uninstall, clear data or switch variants.

## Verification and completion

Preparation completes with a concrete checklist and missing evidence; it is not a built APK. Execution requires applicable checks plus in-place retention, restart, lock, permission/revocation, reminder and follow-up evidence on Android. Record exact artifact/commit/config and outstanding review/owner gates; synthetic checks cannot prove upgrade safety.
