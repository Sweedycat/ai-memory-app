# Phase C local encryption audit and staged design

Status: audit/design candidate, 2026-11-21. Tasks V3-C-01/02/03 in
[the canonical registry](omega/TASK-REGISTRY.json). Source baseline
`1a579b54665396caea6758178287cf988f4eb2d7`. This document grants no activation.
No real records, keys, storage, native configuration or production flags were changed.

## Evidence and scope

The founder accepted the corrected B2 release with ten reported S26 Ultra checks.
That permits Phase C; it does not establish encryption, complete accessibility,
installed binary provenance or native recovery. The completed B2 artifact is
0.0.4-dev/code4, source f29cec0b3a5c032bbc0f68f7084fb0360bb1ab08,
[run44874930574](https://github.com/Sweedycat/ai-memory-app/actions/runs/44874930574).
Preserve its working behavior and the development version policy 0.0.x-dev.

The Data Engineer and Security Engineer inspected source without accessing data
or executing tests. Statements about native APIs below are source/documentation
evidence; Android hardware behavior remains an acceptance gate.

## Current data and write coverage

| Domain | Source and storage | Observed protection / migration requirement |
| --- | --- | --- |
| People, phones, notes, interactions, commitments, follow-ups/history | `src/hooks/usePersistentPeople.ts:8`, `src/utils/normalizeStoredPeople.ts` / @ai-memory/people-v1 | Plaintext JSON; shared single writer and failure retry. Preserve exact raw bytes independently of normalization. No aggregate transaction or cross-process CAS. |
| Life records and previous revision/history | `src/utils/lifeRecordStore.ts:3` / @ai-memory/life-records-v1 | Plaintext versioned document; validation, queue, comparison and readback. Advisory comparison is not native CAS. |
| Owner profile | `src/components/OwnerProfileGate.tsx:49` / @ai-memory/owner-profile/v1 | Plaintext; failed reads block content, baseline/readback protect saves. |
| Privacy/App Lock policy | `src/components/PrivacyGate.tsx:45,64,137` / @ai-memory/privacy-settings/v1 | Plaintext. Read errors select lock-enabled defaults, not an established authentication bypass. Partially invalid objects can retain lock-disabled=false policy semantics; permissive normalization and concealed read failure require repair before migration. |
| Language and appearance | `src/i18n/languageStore.ts:5`, `src/theme/appearanceStore.ts:5`, `src/preferences/enumPreferenceStore.ts` | Plaintext; validated serialized preference writes/readback. Preserve explicit system/default selection. These non-content preferences may remain outside the encrypted content vault so locked screens can use the selected language/theme; include them in recovery coverage. |
| Bug reports | `src/components/BugReportPanel.tsx:45,128` / @ai-memory/bug-reports/v1 | Plaintext free text/reporter; bounded history and retry identity. Treat as sensitive; explicit Share remains a separate external-disclosure consent boundary, never an automatic diagnostic attachment. |
| Backup preferences | `src/components/BackupSafetyDiagnostics.tsx:29,45` / ai-memory.backup.preferences.v1 | Plaintext; empty raw string treated as absent, mount canonicalizes/writes. Must not become a migration read/repair path. Actual automatic backup is not implemented. |
| Permission setup marker | `src/components/ReminderPermissionGate.tsx:21,40,56` / @ai-memory/permission-transparency-setup/v2 | Plaintext seen marker; unknown saved values can be overwritten by explicit Continue. Preserve original state during snapshot, not a synthesized default. |
| Notebook content, encrypted drafts and prior state | `src/utils/expoNotebookRuntime.ts:10,31`, `sqliteNotebookDatabase.ts:4,26`, `persistentNotebook.ts` | Separate SQLite active/previous/draft ciphertext plus key ID/revision; SecureStore key record. Production gate false. Keep existing vault and key namespace separate until reviewed conversion/recovery exists. |
| Native scheduled notifications | `src/utils/followUpNotifications.ts:70`, `reminderNotificationPrivacy.ts` | Private visible copy; OS persists routing IDs/times. Internal recovery may preserve original bytes for same-device rollback; portable restore must remove old native IDs and require reviewed reconciliation. |
| Attachments/photos/media and future assistant records | No current filesystem/media persistence adapter found | Future scope, not completed coverage. Reject unsupported domains; version the schema before adding them. |

## Verified limits and reusable architecture

- App Lock is UI authentication. People/Life/profile/report plaintext remains a
  commercial release blocker. Disk/OS encryption is not app-level encryption.
- `expoBackupCipher.ts:71-119` uses established Expo AES-256-GCM, random 12-byte
  nonce, 16-byte tag and strict UTF-8. Reuse that primitive and its negative tests;
  do not change portable backup formats merely to add local storage.
- Pinned expo-crypto57 exposes `additionalData` in AES types and Android
  `updateAAD` calls. A new local envelope must bind kind/version, domain, schema,
  vault ID, key ID, epoch and generation as canonical AAD, and check expected
  context supplied by a trusted reader. Authentication alone does not prevent
  replay of a complete previously valid generation.
- `BackupSnapshotV1` covers owner/People, projects fields and removes native IDs.
  It is not lossless rollback. `normalizeStoredPeople.ts:66-95` can generate
  time/random-derived legacy values. Snapshot source bytes first; normalize once
  into a separately versioned target, never into the sole recovery copy.
- `generationStore.ts:122` explicitly lacks cross-instance CAS; it cannot serve
  as an all-domain commit coordinator. Reuse tests/invariants, not its claimed
  atomicity as proof.
- `sqliteNotebookDatabase.ts:105,149,174` and `persistentNotebook.ts` provide
  exclusive transactions, FULL synchronous mode, exact-state comparison,
  ciphertext bounds, previous generation and authenticated recovery patterns.
  Design a separate database/schema; never repurpose the live Notebook table.
- Host SQLite termination/rollback tests and injected low-storage cases are
  useful evidence, not Android power-loss or physical recovery acceptance.

## Threat and key lifecycle decisions

Protect copied app files/backups against disclosure and modification, accidental
corruption, interrupted writes and stale writers. Do not claim protection against
a compromised/rooted OS, an already authorized hostile app process, screenshots
or guaranteed JS memory erasure. Minimize plaintext lifetime and drop references
on lock; session revocation must reject late reads/writes without exposing data.

Use a CSPRNG 256-bit vault data key, unique vault/key IDs, versioned key record and
separate existing Notebook key. No fallback/substitute key when any ciphertext,
key binding or migration marker exists. States distinguish not-created,
available, temporarily inaccessible, invalidated/lost and corrupted; an exception
is never treated as an empty/new vault. Confirm a new key readback before binding
an empty vault. Orphan key reuse requires a proven empty, unbound database.

SecureStore protects stored key material through an Android Keystore wrapping
key; the exported data key is present in JS/native memory during use. Current
Notebook `requireAuthentication:false` is not biometrically authorized key use;
`WHEN_UNLOCKED_THIS_DEVICE_ONLY` is an iOS accessibility option. Do not silently
toggle an existing service to authenticated mode. A native-authenticated key mode
needs a distinct alias, supported authentication/fallback policy, enrollment and
passcode invalidation recovery, and independent native acceptance. The first
prototype must not weaken App Lock or claim hardware-backed/StrongBox assurance.

Android key loss/uninstall can make preserved ciphertext inaccessible. Pinned
SecureStore reads can delete an undecryptable preference internally; preservation
of that preference is not promised. The app must preserve database/recovery bytes,
block writes and direct the owner to recovery, rather than issue repair writes.

Recovery uses a separately held CSPRNG 256-bit recovery key and authenticated,
versioned all-affected-domain recovery archive. The key never belongs in an
archive, log or ordinary storage. Google authentication cannot decrypt it.
Before real migration, independently open/decrypt/validate the recovery artifact
in a separate recovery context without installation-local keys, compare every
affected source value and obtain explicit owner key confirmation. A boolean such
as restoreAdmission.durableRollbackReady is not this evidence. Key-loss UX must
explain that an archive without its recovery key cannot restore data.

## Android backup and transfer boundary

Pinned SecureStore plugin XML includes shared preferences and excludes SecureStore
for cloud and device transfer. It does not establish full app backup coverage;
installation depends on merged manifest attributes. Audit generated manifest and
packaged XML before native activation. Define explicit rules for both Android
pre-12 backup and Android12+ cloud/device transfer: exclude plaintext legacy
stores, local keys and sensitive staging; allow only reviewed independently
recoverable encrypted data, if allowed at all. Check OEM device-transfer behavior.
Do not change backup configuration or delete existing copies in this checkpoint.

## Non-destructive migration state machine

1. **BLOCKED/PREFLIGHT:** explicit owner session/consent; supported schemas;
   source sizes; adequate storage; readable existing keys; no pending Notebook
   recovery; writer authority for every affected domain. Failure changes nothing.
2. **FENCED:** fence and drain People/Life/profile/settings/report writers and
   prevent native reminder mutations during capture. AsyncStorage comparisons
   alone cannot fence another process. A durable native authority/transaction
   protocol must be reviewed before real writes; otherwise stop.
3. **CAPTURED:** snapshot allowlisted original raw values, including absent versus
   empty, whitespace, unknown/legacy content and all affected policy/preferences.
   Preserve Notebook database/ciphertext separately with its existing key binding;
   do not insert keys into portable data. Read failure aborts capture.
4. **RECOVERY_VERIFIED:** encrypt and durably stage the lossless recovery artifact;
   verify independent recovery and owner key confirmation as above. Never write
   a plaintext rollback file. No source deletion or rewrite.
5. **TARGET_STAGED:** normalize a separate target once; encrypt authenticated
   domain/generation records; transactionally stage with schema/version/key and
   expected-source binding. Bound memory/disk and retain previous generations.
6. **TARGET_VERIFIED:** reopen through native adapter, decrypt/authenticate and
   compare full source-to-target preservation; all required domains must pass.
   Recheck source authority/revisions. Any mismatch aborts without activation.
7. **COMMITTED:** one durable native transaction switches the global active vault
   generation and migration journal. A lost acknowledgment is an uncertain state:
   reopen/read journal; never blindly retry, overwrite or regenerate a key.
8. **ACCEPTANCE_PENDING:** verify restart, process kill, lock, native failures and
   retained records on the founder device. Original valid stores remain intact.
9. **LEGACY_RETIREMENT_GATED:** a separate reviewed, owner-authorized recoverable
   step may eventually retire plaintext. Until then the product remains only
   partially encrypted. This work does not authorize deletion or claim complete
   encryption while plaintext originals exist.

Rollback before commit retains the original stores. After commit, rollback must
not overwrite newer encrypted edits with stale legacy data; enter authenticated
comparison/recovery. Never replay native notification IDs on another device.

## Bounded implementation checkpoints and acceptance

| Checkpoint | Scope | Required evidence before progression |
| --- | --- | --- |
| C-audit | This inventory/threat/key/migration design | Qualified frozen-design review; retain findings and blockers |
| C-preservation | Pure in-memory versioned legacy AsyncStorage manifest, no IO/native imports | All nine current keys explicit; absent/empty exactness; no normalization; unknown/duplicate/missing rejection; aggregate UTF-8 bounds; malformed/legacy/non-ASCII fixtures; no key or OS-notification payload domains |
| C-local-envelope | Separate local AEAD/AAD adapter and schema | Real standard AES host tests: wrong key, every context swap, tamper/truncation, Unicode, bounds, fresh nonce; native bridge contracts and independent review; no runtime wiring |
| C-key-and-storage | New key lifecycle and SQLite generation backend | No fallback on any existing marker; corruption/inaccessible keys; storage full/transaction/lost ACK; concurrency; independent review and native diagnostics |
| C-migration | Complete all-domain capture/recovery/coordinator | Fenced writes, independently decryptable recovery, interruption at every write, ambiguous commit, rollback with newer edits, source retention and resource limits; no boolean-only recovery proof |
| C-activation | Explicit migration UX and guarded native candidate | TR/EN/all themes, owner authentication/consent, exact-SHA CI, one verified hosted APK, targeted founder acceptance before real activation/retirement |

C-preservation covers only the nine AsyncStorage sources. It is not a complete
all-domain recovery archive or cryptographic implementation. Notebook, filesystem,
native journal and portable-notification conversion are explicit later contracts.
Do not feed its plaintext in-memory value into disk, logs, exports or backup until
the independently reviewed encrypted recovery path exists.

## Audit findings retained in the registry

- Privacy settings accept partially invalid policy objects and conceal read
  failures behind lock-enabled defaults. Strict-load/retry/preservation repair is
  a prerequisite to real migration; do not misreport failed reads as a demonstrated
  authentication bypass.
- Backup/permission preferences have weaker preservation semantics; all migration
  capture rejects unreadable/unsupported source state instead of repairing it.
- Existing backup coverage, cross-process fencing, durable recovery and native
  key/backup evidence are incomplete. Encryption remains commercially blocked.

## Primary references (checked 2026-11-21)

- [Expo SDK57 SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore.md),
  also inspect installed package57.0.4/native/plugin sources. Latest docs are SDK58.
- [Expo SDK57 Crypto](https://docs.expo.dev/versions/v57.0.0/sdk/crypto/),
  pinned expo-crypto57.0.4 AES types and Android updateAAD calls.
- [Android Keystore](https://developer.android.com/privacy-and-security/keystore):
  hardware protection is conditional and needs actual KeyInfo evidence.
- [Android Auto Backup](https://developer.android.com/identity/data/autobackup):
  verify explicit generated cloud/device-transfer rules rather than defaults.
