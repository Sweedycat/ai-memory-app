# APK and device acceptance

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
