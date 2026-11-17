# Notebook production foundation — implementation evidence

Date: 2026-11-17. Task baseline `cf751eabd7730cad54564370f84ebde603e135bc`, clean
`development/omega-commercial-mvp`. GitHub ref and successful exact-SHA CI
[44079288134](https://github.com/Sweedycat/ai-memory-app/actions/runs/44079288134)
were verified before editing. This extends the validated 226-test checkpoint;
Omega infrastructure was not restarted or revalidated.

## Scope delivered

Founder Payment Strategy Addendum is preserved in AGENTS Rule 15,
[financial policy](financial-policy.md) and [payment strategy](payment-strategy.md).
Multi-platform channels, versioned region/currency fee/pricing requirements,
settlement/margin accounting, entitlement security, regional default-denial,
provider evaluation and financial/customer protections are documented. Supplied
rates/prices are explicitly provisional owner inputs; current provider terms
were not verified and no live implementation uses them. No payment SDK, backend,
provider selection, hosted checkout, billing or external promotion was activated.

Notebook implementation:

- `sqliteNotebookDatabase.ts`: isolated `ai-memory-notebook-v1.db`, exact versioned
  schema and bounded singleton state. FULL synchronous mode is required on every
  inspected transaction connection. Exclusive transactions compare all expected
  fields/revision, retain the prior encrypted active payload, verify before
  commit and reread after acknowledgement. Unknown schema, corrupt data, unsafe
  revision and stale updates fail without reset/migration. No old snapshot is
  automatically restored. Only ciphertext and a random public key marker persist.
- `notebookKeys.ts`: bounded versioned device-local key record, secure write/readback
  before database binding, interrupted-bootstrap orphan reuse, no regeneration
  over initialized ciphertext and no automatic deletion/rotation. Concurrent
  initialization is refused in the JS process. This is not cross-process locking
  or portable key recovery; no application-managed secret goes into AsyncStorage.
- `persistentNotebook.ts`: existing conditional sessions/encrypted vault compose
  with an AES-GCM-sealed recovery intent containing canonical candidate, base
  revision/digest and key marker. SHA-256 is an integrity comparison, not a KDF.
  Stage commits before active replacement; activation and journal clearing share
  one transaction. Wrong key/domain, malformed/oversized recovery, stale decisions
  and corrupt previous snapshots block writes. Reopen waits for writes and
  authenticates before distinguishing already-saved/retry-safe/conflict. Retry
  or discard requires explicit caller selection; conflicts never auto-merge.
- `expoNotebookRuntime.ts`: supported Expo SQLite, SecureStore and existing
  Expo AES-GCM composition; separate local Notebook key, lazy native opening,
  device-unlocked/non-migrating iOS accessibility, no second per-operation biometric
  prompt, no plaintext logs. Existing App Lock owns UI authentication. SecureStore
  encryption is separate from that UI gate. Handle disposal waits for writes.
- `notebookLifecycle.ts` / `NotebookBoundary.tsx`: immediate background revocation,
  stale-open rejection and write draining; mounted under existing PrivacyGate and
  OwnerProfileGate. **NOTEBOOK_PRODUCTION_ENABLED remains false.** Disabled boundary
  opens no native database or key store; no production Notebook screen is mounted.

Supported SDK 57 package additions: expo-sqlite 57.0.5, expo-secure-store 57.0.4
and transitive await-lock 2.2.2. Package/lock diffs contain only these additions.
Their package metadata declares MIT licenses; these are offline native libraries,
not a free-tier service or paid infrastructure. Version remains 0.0.2. Application
IDs/signing/versionCode and all existing record keys/formats remain unchanged.

`expo install` installed the compatible dependencies but exited 1 because dynamic
app.config.js prevented automatic plugin insertion. Principal added both plugins
to the existing app.json plugin list; SecureStore Android backup configuration
is enabled. Doctor subsequently passed. No prebuild/build/install was performed;
native backup-rule and binary behavior still require inspection in an approved
future artifact. SecureStore backup exclusion is not a working user backup.

## Process-termination investigation

There is no plaintext draft cache. Submitted saves have an encrypted intent once
its staging transaction commits. Tests terminate a separate host Node process
after that commit, then open the same disk database and authenticate/review/retry
the intent. Files are checked for fabricated note text and synthetic key material.
This proves a bounded host SQLite path, not Android power-loss durability.

Text typed but not submitted/checkpointed remains in memory and can be lost.
Future encrypted autosave needs explicit editor checkpoint semantics, bounded
coalescing, stale-draft comparison/discard and key/lock-safe UX. It must not claim
saved status before durable acknowledgement or retain plaintext across lock.
Local SecureStore key loss makes the ciphertext unavailable; no fallback key or
cross-device recovery is promised. Real encrypted external backups and their
portable owner recovery-key UX remain separately disabled.

## Validation results

Environment: Windows Node 24.19.0 / npm 11.17.0; CI separately uses Ubuntu/Node 22.
Only fabricated records and temporary synthetic databases were used.

| Check | Result / evidence class |
| --- | --- |
| Strict TypeScript | PASS; strict/noUncheckedIndexedAccess unchanged |
| Full app test suite | PASS 267/267 after independent-review repair; no skipped tests |
| New SQLite adapter tests | PASS 17/17, actual host disk SQLite plus fault injection |
| New persistence/reconciliation | PASS 13/13, host SQLite + Node AES-GCM, including terminated child process and failed-reopen review revocation |
| New key lifecycle | PASS 5/5, secure-store/database mocks |
| New lifecycle/default-off gate | PASS 3/3, synthetic lifecycle and source admission assertions |
| New native composition | PASS 3/3, actual host SQLite with mocked platform/SecureStore/crypto bridge |
| Existing Notebook/backup/restore/people/notification paths | Included in full suite and passed; no actual app record or reminder touched |
| Expo Doctor | PASS 21/21 with added dependencies/plugins |
| npm audit | exit 1, 3 moderate package entries; 0 high/critical, no forced fix |
| Physical Android/iOS crypto, SecureStore, lifecycle, durable recovery, in-place upgrade | NOT RUN; required before activation/candidacy |

The 41 new tests extend 226 to 267. Full checks were run after composition and
independent-review regression tests were added. On-disk host SQLite/Node AES tests are more than in-memory mocks, but
do not establish Android SQLite transaction connection configuration, flash/power
durability, Keystore/Keychain behavior, OS backup restoration or binary compatibility.
FULL-mode rejection remains fail-closed if an actual native transaction connection
does not meet the checked setting. Physical acceptance is still necessary.

## Advisory assessment

Current audit still traces expo/@expo/fingerprint/minimatch to
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), with
patched minimatch 11.0.1 outside the current 10.x range. Installed fingerprint's
default matcher passes `{dot:true}`, leaving optimizationLevel at its default;
the advisory describes amplification with optimizationLevel >= 2. This is bounded
source-path analysis, not a clean audit or assurance of all call sites. No forced
override, unsafe SDK downgrade, check suppression or blanket advisory exemption.

## Independent review identity

Initial frozen ordered 19-file SHA-256 manifest:
`2adcbca4504b20a52d118cc3903399a1c851d8740531de21ae33b4fa5077dc2d`.
Digest is SHA-256 of JSON.stringify of ordered `{file,sha256}` objects using raw
file bytes. Paths in order:

AGENTS.md; app.json; docs/financial-policy.md; docs/payment-strategy.md; index.tsx;
package.json; package-lock.json; src/components/NotebookBoundary.tsx;
src/utils/expoNotebookRuntime.ts; src/utils/notebookKeys.ts;
src/utils/notebookLifecycle.ts; src/utils/persistentNotebook.ts;
src/utils/sqliteNotebookDatabase.ts; tests/expoNotebookRuntime.test.cjs;
tests/helpers/notebookRuntime.cjs; tests/notebookKeys.test.cjs;
tests/notebookLifecycle.test.cjs; tests/persistentNotebook.test.cjs;
tests/sqliteNotebookDatabase.test.cjs.

Initial Independent Reviewer found one P1: a failed authenticated reopen could
retain a previous retry-safe recovery decision while publishing partially read
state. It reproduced activation of a stale candidate and deletion of invalid
journal evidence. Principal repaired publication to occur only after complete
authentication and revoked review authority at the start of each reopen/recovery
operation, restoring it only after the full session opens successfully. Failed
recovery writes also require another authenticated reopen. New disk tests cover
invalid active/previous/draft after a prior review, no retry/discard writes, and
recovery after separately simulated repair.

Replacement frozen 19-file digest (same ordered paths):
`069032682c9781759755f8c39a722eb9bda3265a82d251690f2c5a5c1f513cf0`.
Focused persistence 13/13, complete 267/267 and strict TypeScript passed after
the repair. Final independent re-review: **P1 resolved, no new findings** in the
repaired frozen diff; replacement digest verified before/after. The reviewer
independently ran TypeScript --noEmit, whitespace checks and an artifact-free
reproduction covering invalid active/previous/draft and failed recovery writes.
On-disk test execution remains Principal/Data Engineer evidence because the
read-only reviewer did not generate artifacts. Production/native gates remain.
Data Engineer wrote the SQLite adapter/test only; Principal wrote composition,
keys, recovery, lifecycle, dependencies and policy. Independent Reviewer authored
none and reviews the frozen implementation read-only. This report, current
handoff and product inventory are outside the implementation hash and receive
Principal consistency review. No owner release/activation approval is implied.

## Remaining gates and next safe milestone

Keep Notebook, real backup/restore, external AI/cloud, billing and promotions
disabled. Complete reviewed recovery/editor UX, then owner-participated Android
SecureStore/key-loss, authentication/background, denied permissions, low storage,
interrupted writes, reboot/force-stop and retained-data update checks. Verify
installed identity/certificate/versionCode and applicable owner policy before any
separately authorized APK/install. No APK, signing, device or real-data operation
was performed. P1 activation does not bypass these critical gates.

No new external service or financial obligation was introduced. Existing tooling
costs were not audited; this work purchased/activated none. Main/preview and the
prior validated checkpoints are preserved. Normal commit/push may target only
the dedicated development branch. Inspected workflow triggers match tests only;
no EAS/Android build runs from this branch. Final remote SHA/equality and exact-SHA
CI belong to the completion report or a subsequent evidence-only addendum.

Primary platform references consulted:
[Expo SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/),
[Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) and the
installed SDK 57 package declarations/source. No provider billing terms were used
as verified implementation inputs.

## Validated Notebook checkpoint and next safe product increment

Notebook/payment commit `3d9a11622e565c1ca922f68c1f61d0b31ed4d8ae` was normally
pushed to the existing development branch. Exact-SHA
[CI 44084195783](https://github.com/Sweedycat/ai-memory-app/actions/runs/44084195783)
completed SUCCESS (fresh npm ci, Doctor, strict TypeScript and complete units).
No APK/manual build or main/preview promotion was triggered.

After critical source/test/review validation, an independent small P1 increment
adds `dailyBriefing.ts`, `DailyBriefingCard.tsx`, centralized English copy and seven
pure tests, mounted on the existing home screen. It groups actual current local
follow-ups into overdue, still due today, next seven local calendar days, later,
undated and invalid-date review. Completed/history records are excluded; source
IDs/text are preserved and no appointments or dates are invented. It changes no
schema, storage, notification, authentication or Notebook gate. Pending person
edits still use the existing save-status notice; the card does not claim every
displayed in-memory change has reached disk.

Tests cover exact boundaries, invalid/relative/rollover timestamps, same-name
distinct IDs, no source mutation, empty/completed records, Türkiye midnight and
both daylight-saving transitions in America/New_York. UI refresh runs each minute
only in foreground and on resume, with cleanup on unmount/background. Four
priority rows link to the actual person profile; the visible/total count discloses
truncation. Dates/times use the device locale; this does not activate an unreviewed
Turkish UI catalog. No AI, paid/cloud service or new permission is introduced.

Frozen five-file ordered manifest for the incremental review:
`2e62a5ff7b0e5b3ba112ec740984dc8a4f2a818849f491b2d4e2a66842ccaba4`.
Order: App.tsx; src/components/DailyBriefingCard.tsx;
src/strings/dailyBriefing.en.ts; src/utils/dailyBriefing.ts;
tests/dailyBriefing.test.cjs. Notebook's reviewed implementation is unchanged.
Initial incremental review found one P2: an explicit action-only accessibility
label hid commitment/date child text from screen-reader row grouping. Principal
replaced it with an action hint so the native grouped child label retains the
actual name, commitment and due/missing/review text. Updated five-file digest:
`aa204f6979248e69039c6a4501feeaf16959deb9fcd9e269fce9ddaa88eb5033`.
Complete application suite passed **274/274**, strict TypeScript passed; seven
new pure daily-overview tests passed. Reviewer independently ran seven pure tests,
strict TypeScript and whitespace before the one-prop accessibility correction.
Independent correction re-review: P2 resolved at source, no new findings; digest
verified and TypeScript/whitespace independently passed. A final App placement
adjustment preserves search's original position and hides the overview while a
nonempty query is active, so results follow search directly. Same five-file order,
final digest `4a733081f6a39065829b0e7ddd61b56559e48a5e058aca55e5ce7923818a8715`.
Final placement re-review verified that digest before/after, confirmed the search
condition and retained accessibility correction, and reported no new findings.
No physical layout, TalkBack or Android foreground/resume observation is claimed.
