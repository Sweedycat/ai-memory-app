# Transactional restore gate (design; no production restore enabled)

Base: feature/drive-backup-transport-preview. This document does not authorize merge to main.

## Invariants
1. Never overwrite the active local dataset during archive parsing, authentication, migration, or review.
2. Bind a backup to an explicitly selected local identity/workspace. Account login alone must not authorize importing into another workspace.
3. The recovery key stays separate from Google Drive and app authentication.
4. On a crash, startup must select either the fully committed old dataset or fully committed new dataset, never a partial mixture.
5. Device-specific notification IDs must not be restored. Scheduling is a separate, idempotent post-commit reconciliation.
6. If available space, checksum, schema, or identity checks fail, refuse activation and preserve the old dataset.
7. Never include real person data, plaintext, keys, access tokens, or provider session URLs in diagnostics.

## Proposed implementation boundary
- Read and decrypt the encrypted archive into bounded, validated staging data; for larger archives require streaming authenticated encryption and disk quota checks first.
- Show counts, backup time, owner/workspace, conflicts and an explicit restore mode. No writes before confirmation.
- Before activation, persist a durable encrypted rollback checkpoint of all affected local records and verify its readability.
- Write a complete candidate dataset under a new generation identifier; validate by re-reading.
- Switch a single durable active-generation pointer only after candidate verification. Keep the previous generation until successful startup and post-commit validation.
- At startup, recover from interrupted staging/commit by inspecting generation manifests and checksums. If uncertain, select the verified previous generation and fail closed.
- Reschedule future reminders after activation; record idempotent scheduling progress and report failures without silently dropping reminders.
- Clean up old generations only after verified completion and an explicit retention policy.

## Required automated tests before UI enablement
- Wrong key, modified ciphertext/tag, truncated JSON, unsupported version, duplicate IDs and wrong owner/workspace: old generation unchanged.
- Simulated crash at every staging, checkpoint, candidate-write, pointer-swap and notification-reconciliation step.
- Low storage, failed writes, process termination and restart recovery.
- Same-device and cross-device restore with synthetic people, Turkish Unicode, reminders and timezone boundaries.
- Account sign-in/sign-out must not silently upload, reassign, or delete local Free data.

## Release blockers
The current AsyncStorage local schema is not proven to support atomic multi-record replacement. Do not implement a naive sequence of setItem calls as a transaction. Choose and validate a durable generation-based storage adapter or a transactional local database before enabling restore. Native Android synthetic crypto testing and recovery-key onboarding are still pending. No actual user records are to be used for destructive tests.
