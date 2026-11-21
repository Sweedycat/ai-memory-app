# Git branch policy

The [permanent feature delivery policy](feature-delivery-policy.md) grants standing
authorization for zero-cost hosted Preview delivery after each completed
user-facing milestone, independent review and successful exact-SHA CI. V3 permits
APK_READY with a tested automatic/founder-triggered path; a triggered run is linked
immediately and finishes without interactive Gradle polling. Preserve
package/signing and strictly increase versionCode over prior delivered artifacts;
provide the verified artifact or precise trigger/checklist and await founder feedback/acceptance
before the next major feature. No repetitive ordinary build approval; installation,
production, paid operations and merges remain separately gated. Documentation-only
work and invisible refactoring do not independently require an APK; current-task
no-build instructions prevail. Existing version-policy ambiguities below do not
authorize equal/lower milestone update codes or third-position reinterpretation.

- `main`: Android MVP baseline verified by manual device tests and CI. Not a Play Store release.
- `preview`: unfinished features, including backup validation; separate draft PR to `main`.
- Expo's `preview` **build profile** is not the same as the GitHub branch.
- Changes are promoted only after CI, Android testing, privacy/security review, and owner approval.
- Never clear or uninstall the existing Preview app. Do not export or upload unencrypted personal memories.
- Founder clarification: an explicitly authorized test APK may be produced from a verified historical package/signing identity without installed-device metadata. Actual installed package/certificate/versionCode and retained-data checks are required before separately authorized installation; artifact production does not approve installation or promotion.
- No developer-hosted backup storage or new paid services without approval.
- Master Development V3 makes authenticated encryption of all sensitive local
  data a commercial release blocker; the former MVP encryption exception is
  historical. Do not activate real migration without review/recoverability/device gates.
- The backup snapshot module is only in-memory schema validation. Encryption, Drive, and restore are not implemented.

## Current founder version policy (2026-11-21)

- Development builds use `0.0.x-dev`. The next eligible corrected B2 candidate is `0.0.4-dev` / Android versionCode `4`.
- The first public release is planned as `0.1.0`; reserve `1.0.0` for a future product-maturity milestone. Neither is authorization to publish.
- This explicit founder decision supersedes the older display-version cadence below, including the unbuilt `0.3.0` proposal. Keep those statements only as historical decisions.
- Android updates use the independent, strictly increasing integer versionCode, unchanged package and signing identity. Latest verified GitHub Test artifact is `0.2.0`/code3 (run44670257253); the proposed code4 exceeds it. Installed identity remains unverified and separately gated before installation.
- Keep all manifests consistent. No APK solely for renaming a version; the corrected B2 feature increment still requires tests, independent review, exact-SHA CI and founder device acceptance.

## Historical owner-defined version numbering (superseded)

- Format: `FIRST.SECOND.THIRD` (for example `0.0.2`). This is an intentional project-specific release policy.
- **Second number:** even a light user-facing feature/update increments the middle number and resets the third to zero. Example: `0.0.2 → 0.1.0`, then `0.2.0`.
- **First number:** a very large, leap-style update increments the first number and resets the others. Example: `0.2.0 → 1.0.0`.
- **Third number:** reserve for tiny technical corrections/hotfixes within the same feature version; do not use it for regular feature updates. Example: `0.1.0 → 0.1.1`.
- Do not rename an existing installed app or bump versions simply for code commits. Set version when an update is actually being prepared and tested.
- Android `versionCode` is **separate** from these visible version strings and must monotonically increase for an in-place APK update, with the same application ID/signing identity; verify current installed versionCode and signing before any deployment.
- Do not release a build as a safe in-place upgrade without prior-device-data preservation checks. Never uninstall or clear data to make the version update work.

## Historical version numbering policy (superseded)

- Display version has three numeric positions, read **left-to-right**: `MAJOR.MINOR.PATCH`.
- Owner-selected cadence: **very light feature/update** increments the **second position** (e.g. `0.0.2 → 0.1.0`); a **major leap / large-scale release** increments the **first position** (e.g. `0.1.0 → 1.0.0`). Reset less significant positions to zero when a higher position increases.
- Proposed for the remaining **third position**: internal fixes / hotfix-level maintenance (e.g. `0.1.0 → 0.1.1`); use this only as a convention until owner confirms its role.
- **Latest CI-verified GitHub Test artifact is `0.2.0`/code3 (run44670257253); V3.2's corrected B2/digital-entry candidate is `0.3.0`/code4 under the second-position cadence.** This is not installed identity or full founder acceptance. Do not bump a visible version for documentation or each source commit; assign versions to authorized updates.
- Android `versionCode` is separate from versionName and must increase for signed APK updates. Corrected B2 code `4` is strictly above latest verified code `3`; separate EAS Preview code stays `2`. Verify actual installed package/certificate/code before installation. Never uninstall/clear data. Equality and third-position ambiguities remain unresolved and unused.
- Keep `app.json`, `package.json` and `package-lock.json` consistent when assigning a new visible version; `main` stays unchanged until approved.
