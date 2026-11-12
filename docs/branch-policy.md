# Git branch policy

- `main`: Android MVP baseline verified by manual device tests and CI. Not a Play Store release.
- `preview`: unfinished features, including backup validation; separate draft PR to `main`.
- Expo's `preview` **build profile** is not the same as the GitHub branch.
- Changes are promoted only after CI, Android testing, privacy/security review, and owner approval.
- Never clear or uninstall the existing Preview app. Do not export or upload unencrypted personal memories.
- No developer-hosted backup storage or new paid services without approval.
- The backup snapshot module is only in-memory schema validation. Encryption, Drive, and restore are not implemented.

## Owner-defined version numbering

- Format: `FIRST.SECOND.THIRD` (for example `0.0.2`). This is an intentional project-specific release policy.
- **Second number:** even a light user-facing feature/update increments the middle number and resets the third to zero. Example: `0.0.2 → 0.1.0`, then `0.2.0`.
- **First number:** a very large, leap-style update increments the first number and resets the others. Example: `0.2.0 → 1.0.0`.
- **Third number:** reserve for tiny technical corrections/hotfixes within the same feature version; do not use it for regular feature updates. Example: `0.1.0 → 0.1.1`.
- Do not rename an existing installed app or bump versions simply for code commits. Set version when an update is actually being prepared and tested.
- Android `versionCode` is **separate** from these visible version strings and must monotonically increase for an in-place APK update, with the same application ID/signing identity; verify current installed versionCode and signing before any deployment.
- Do not release a build as a safe in-place upgrade without prior-device-data preservation checks. Never uninstall or clear data to make the version update work.
