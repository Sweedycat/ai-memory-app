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
4. Apply the founder's standing authorization in AGENTS.md Rules 08-09 for one verified free Preview APK after a completed user-facing milestone, independent review and successful exact-SHA CI. Use the existing validated GitHub Actions pipeline without repetitive build approval. Verify free capacity/quota, preserve package/signing, use a strictly higher versionCode than prior delivered artifacts and follow the [delivery policy](../../../docs/feature-delivery-policy.md). Documentation/invisible refactoring do not independently require APKs; a current no-build instruction prevails. Never provision substitutes, regenerate credentials, spend money or create retry loops. Inspect the actual APK identity/integrity before delivery and retain separate installation gates; never uninstall, clear data or switch variants.

## Verification and completion

Preparation completes with a concrete checklist and missing evidence; it is not a built APK. Artifact production completes only with the actual APK, source/build identity, package/version/signature/integrity checks and stated limits. Installation remains separately gated on actual installed identity, recovery/preservation checks and authorization; in-place retention, restart, lock, permissions, reminders and follow-ups require physical Android evidence. Record outstanding gates; synthetic/artifact checks cannot prove installed-device compatibility or upgrade safety.
