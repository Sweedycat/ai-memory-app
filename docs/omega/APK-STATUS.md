# Current APK and device evidence

Current snapshot: 2026-11-20. [TASK-REGISTRY.json](TASK-REGISTRY.json) is the sole current task/status authority. This is a synchronized projection; owner instructions/topic policies govern permissions. Historical material below is archived and cannot schedule work or override current status.

| ID | Status | Scope | Next action |
| --- | --- | --- | --- |
| V3-A-04 | VERIFIED | Tested branch-scoped free hosted delivery | Preserve verified checkpoint and narrow operational boundaries. |
| V3-B2-05 | APK_READY | Review, tests, APK_READY and founder acceptance | Trigger existing one-attempt hosted path, publish run link immediately and stop interactive build waiting. |
| V3-F-04 | PENDING | Safe upgrades, versions and retained records | Verify reviewed/published B2 source and exact CI before hosted build; installed-device identity remains unverified. |

No B2 artifact/physical acceptance verified; A internal APK job skipped. B1 tests are not an APK. Preserve release states APK_READY, BUILD_TRIGGERED, BUILD_RUNNING, APK_VERIFIED, FOUNDER_ACCEPTANCE_PENDING and ACCEPTED separately from task status.

Latest artifact evidence supplied by Principal from re-inspected build-tools logs (binary not downloaded again): successful [run44565432466](https://github.com/Sweedycat/ai-memory-app/actions/runs/44565432466), source `5b679b35a535ab723739a7b31d71ceeaa2b75acf`, job135706101231. Package `com.sweedycat.aimemory.githubtest`, versionName `0.1.0`, code `2`; apksigner V2 certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; APK SHA-256 `1478dd14018c759a8807730234b1bc7e606e5137d03c249c627e1054b63e5446`. [Artifact14552436266](https://github.com/Sweedycat/ai-memory-app/actions/runs/44565432466/artifacts/14552436266). This historical artifact is not B2; installed-device compatibility remains unverified.

B2 `0.2.0/code3` source aa7565cadc5737fca1581eb1ed52c4f499e45348 passed exact-SHA CI44669846988/full and44669847036/portability; APK_READY, no produced binary or physical acceptance yet. Preserve Preview/GitHub Test identities/signing; verify current artifact metadata before higher code. Installation remains separately authorized; never uninstall/reset/replace signing. No build for this docs milestone.

Focused Turkish checklist when candidate is ready: Sistem/TR/EN seçimi yeniden açılışta korunmalı; değişen ekranlarda karışık dil olmamalı. Beş ücretsiz temanın önizleme/uygulama/yeniden açılış ve sistem değişimi sınanmalı. Kayıtlar korunmalı; Geri/klavye/kenar boşlukları/büyük yazı/TalkBack ve etkilenen Ayarlar/Uygulama Kilidi yolları kontrol edilmeli. Aday APK ve beklenen/gözlenen sonuç kaydedilmeli.
## Historical archive (superseded status snapshot)

# APK and device acceptance

## Current standing delivery policy — 2026-11-19

The [permanent feature delivery policy](../feature-delivery-policy.md) grants
standing authorization for one verified free milestone APK after independent
review, a validated checkpoint and successful exact-SHA CI. Preserve the approved
development package/signing identity and strictly increase delivered versionCode;
verify package/version/certificate/integrity and supply a download/checklist.
Await founder Samsung Galaxy S26 Ultra observations, record/prioritize corrections
and do not mark fully accepted or advance the next major feature before required
device acceptance. Installed compatibility/installation remain separately gated.
Documentation and invisible refactoring do not independently require an APK.
The current policy-only session must not trigger a build or implement UI changes.
Historical configuration, task-specific build statements and results below are
dated evidence, not current standing authority or a device acceptance claim.

As of 2026-11-18 UTC: **no accepted Android candidate for the current development
checkpoint**. This task built, signed, installed and released nothing.
Remote Control Phase 1 adds only the
[subsequent Emulator/Maestro plan](ANDROID-EMULATOR-MAESTRO-PLAN.md).
No emulator runtime was observed; a PATH lookup finding no tool command is not
proof the tools are uninstalled. The monitor reports this boundary as unknown.

## Source configuration, not installed/artifact evidence

| Field | Inspected source value |
| --- | --- |
| Display version | `0.0.2` in [app.json](../../app.json) / [package.json](../../package.json) |
| Preview identity | `AI Memory Preview`, `com.sweedycat.aimemory.preview` when `APP_VARIANT=preview`, in [app.config.js](../../app.config.js) |
| Preview versionCode | `2` in source configuration; not a verified installed or proposed update code |
| EAS Preview profile | Internal APK, Preview variant, local version source in [eas.json](../../eas.json); build profile is separate from the Git branch |
| Notebook | `NOTEBOOK_PRODUCTION_ENABLED=false` in [NotebookBoundary](../../src/components/NotebookBoundary.tsx) |
| Current code | `7cfb7737ed2cf39be6f1f4973319d91a44f3878d`; green CI is not an APK |

Installed package, certificate identity, actual versionCode, original project
linkage, approved artifact/source and retained-data update are **unverified here**.
Old screenshots or build fingerprints cannot establish signing compatibility.
Do not copy signing material, account/session identifiers or personal records
into this public center.

Use the existing [Android Notebook acceptance plan](../android-notebook-acceptance-plan.md)
and [Preview upgrade checklist](../android-preview-phone-upgrade.md). They require
separate authorization, synthetic isolated failure tests, recoverable data
safeguards, native App Lock/key/durability/notification/UI checks and a safe
in-place update. Never uninstall, clear app data or replace signing credentials.
An isolated test package alone cannot prove Preview update preservation.

Preserve the unresolved visible-version/Android versionCode wording in
[AGENTS Rule 07](../../AGENTS.md) and [branch policy](../branch-policy.md).
Seek an owner decision only when an authorized build depends on that ambiguity.
Notebook activation remains disabled pending applicable review, physical evidence
and explicit owner approval. No build/install workflow is dispatched by this task.
