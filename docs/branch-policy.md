# Git branch policy

- `main`: Android MVP baseline verified by manual device tests and CI. Not a Play Store release.
- `preview`: unfinished features, including backup validation; separate draft PR to `main`.
- Expo's `preview` **build profile** is not the same as the GitHub branch.
- Changes are promoted only after CI, Android testing, privacy/security review, and owner approval.
- Never clear or uninstall the existing Preview app. Do not export or upload unencrypted personal memories.
- No developer-hosted backup storage or new paid services without approval.
- The backup snapshot module is only in-memory schema validation. Encryption, Drive, and restore are not implemented.
