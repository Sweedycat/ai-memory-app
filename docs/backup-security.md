# AI Memory private backup: security and rollout gate

Status: **experimental** (only `preview`). Not connected to the UI or any
Google account. Do **not** upload or export actual memory data yet.

## Product constraint

Users retain ownership of backups. The startup **does not purchase or operate
storage for user backup archives**. A later Google Drive `appDataFolder`
connection should use the user's own Google storage quota and the minimum
app-data-only OAuth scope. Google Drive login alone is NOT a decryption key.

## Cryptographic design

- Generate a cryptographically random 256-bit recovery key using Expo SDK 57
  `AESEncryptionKey.generate(256)`. We do not derive a key directly from a
  human password, nor use plain SHA-256 as a password KDF.
- Encrypt UTF-8 plaintext using authenticated **AES-256-GCM**. Generate a
  fresh, random 12-byte nonce for every encryption under a given key; use
  the full 16-byte authentication tag.
- The exported envelope contains version, algorithm and base64-encoded sealed
  bytes only. It must never contain names, notes, user profile, or the key.
- The 64-hex-character recovery key is **required** for cross-device restore,
  must be stored outside the backup, and must be shown with explicit
  instructions. If lost, a new device cannot decrypt the old archive.
- A future secure UX can store a local convenience copy in platform secure
  storage, but **that copy must not be the only recovery method**: Android
  secure storage may be lost when an app is uninstalled or phone is replaced.
- No logging, analytics, unapproved sharing or automatic data upload.

## Current code boundaries

- `backupSnapshot.ts`: strict in-memory snapshot normalization, version
  checks, duplicate ID rejection and stripping of old device-specific
  notification IDs.
- `encryptedBackupEnvelope.ts`: only in-memory encrypted archive shape
  and authenticated decrypt-then-validate-then-review. No storage or restore.
- `expoBackupCipher.ts`: an **unused** native Expo Crypto AES-GCM adapter.
  It is NOT called by the current application and has NOT been Android-tested.
- Automated tests use synthetic data, Node AES-GCM and a mocked native API
  contract; they do NOT prove mobile binary compatibility.

## Restore safety before enabling

1. Explicit user consent and correct Google account / archive selection.
2. Authenticate and decrypt the archive with the recovery key.
3. Validate version, JSON, field types, record IDs, duplicates and size.
4. Show backup time, source, count of people, matching IDs and a safe
   comparison; require an explicit user choice to restore.
5. Make an independently recoverable local snapshot of all existing records
   before changing ANY production data.
6. Implement and test atomic or rollback-capable restore; refuse restore on
   low storage, failed writes, mismatch or corruption without modifying
   existing people/profile.
7. Never restore old Expo notification IDs. Recreate future reminders using
   permissions approved on the current device, with explicit user review.
8. Prove manual export/import, device migration, backup retention and
   recovery-key loss behavior before enabling background/automatic backups.

## Release blockers

- No in-app backup or restore UI.
- No Drive OAuth, file transfer, upload retry or user quota handling.
- No safe portable key-recovery UX or loss/revocation policy.
- No durable rollback / transaction; no real restore activation.
- No physical Android encryption round-trip or key-loss recovery testing.
- Remaining `npm audit` advisories tracked in Issue #5.
- **Do not merge** these modules into `main` or advertise functioning
  backup until the above reviews and tests are completed.
