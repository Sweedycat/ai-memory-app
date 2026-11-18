# Android Notebook acceptance plan — not performed

Prepared 2026-11-18. No device, APK build, signing, installation or real data was
accessed. This plan does not authorize those actions or enable Notebook. Current
production flag must remain false until the applicable owner/review/device gates
pass. Host SQLite, mocked native events and CI are separate evidence classes.

## Entry prerequisites

1. Obtain separate owner authorization for the exact test source, variant, build
   and any installation/device interaction. Preserve `main`/`preview` and the
   installed owner app. No paid credits, new Expo project or signing credentials.
2. Record exact source SHA, successful matching CI, frozen independent review,
   dependency inventory and outstanding advisories. Inspect current workflows;
   no indirect build/deployment through an unrelated push.
3. Verify the actual installed package ID, versionCode, certificate and original
   EAS account/project linkage. Source defaults are not installed-device evidence.
   Resolve applicable owner version/versionCode ambiguity before proposing a build.
4. Verify a recoverable safeguard for affected existing records. Never uninstall,
   clear storage, regenerate signing keys or copy personal records into test logs.
5. Notebook currently stays disabled. Exercising its real native UI needs a
   separately reviewed/approved isolated test harness or test-only activation;
   do not silently flip the production flag. An isolated test package cannot prove
   in-place Preview preservation. Building/installing either remains separate.

## Test data and isolation

Use fabricated titles, Unicode text, dates, numbers and people. Recovery/key-loss,
corruption and full-storage failure injection must target only a clearly isolated
synthetic database/key namespace. Never delete/change the owner's real SecureStore
key or corrupt their records. Do not fill the owner's phone disk to trigger a
failure. No plaintext recovery cache, actual archive upload, contact export or
automatic screenshots/log attachments. A synthetic device harness is not built by
this document and must itself receive review before use.

## Required observed scenarios

| Boundary | Scenario and expected observation |
| --- | --- |
| First open | Foreground authenticated opening creates only the isolated Notebook database/key; people/owner/privacy bytes and records remain intact. No permission for Contacts/files/camera/microphone requested. |
| Secure key | SecureStore write/readback and database key binding succeed on the actual binary; reboot access works after device unlock. Missing/wrong/malformed synthetic keys stop safely, never create a replacement over ciphertext. |
| SQLite | Verify FULL durability on every real transaction connection; commit/rollback and acknowledged reread work. A failed durability precondition blocks opening rather than silently downgrading. |
| CRUD | Create/edit/search/read full note body and creation/modification dates; explicit deletion affects only the selected original revision. Intentionally empty Notebook stays empty across reopen/reboot. |
| Saved draft | Explicit Keep encrypted draft preserves active note, acknowledges only after encrypted stage/readback, survives force-stop/reboot, and reopens for explicit comparison/save/discard. |
| Unprotected text | Text without acknowledged checkpoint is described as unprotected. Dirty Close/Android Back asks; second Back cancels the confirmation. No promise of survival after OS termination. |
| Save ambiguity | Interrupt before stage, after stage and around activation acknowledgement. Reopen distinguishes already-saved/retry-safe/conflict; no duplicate writes, silent deletion or resurrection. |
| Stale decisions | Change the synthetic target while a confirmation/recovery is open. CAS refuses the old decision; new content survives and must be reviewed again. |
| Pending recovery | New edits/deletes remain blocked. Compare current/candidate, including interrupted deletion. Conflicting/multiple-note changes cannot be blindly applied; discard needs confirmation. |
| Read/crypto failure | Wrong key, tampered active/previous/journal, unsupported schema, low storage and interrupted transactions preserve evidence; no reset, fallback plaintext or automatic previous-snapshot restore. |
| App Lock | Immediate/delayed App Lock, authentication cancellation, background/foreground and initial inactive opening reveal no stale Notebook fields. Foreground requires explicit safe reopen; late I/O cannot publish private data. |
| Lifecycle | Leaving an editor does not deliver a late success callback. Background during open/ID creation/save clears UI and drains previous work before another session opens. |
| Navigation | Device Back traverses detail/list safely, defers editor dirty confirmation and cancels confirmation rather than accepting it. Back cannot silently discard memory-only recovery. |
| Accessibility | TalkBack reads title/body/due-state/action hints and recovery comparison; full-size fonts, keyboard, orientation/layout bounds, 48dp controls and no clipped confirmation actions. No visual acceptance asserted from source tests. |
| Regression | Existing person creation/edit/search/contact fields, interaction history, follow-ups, notification privacy/delivery, settings and App Lock remain functional with fabricated additions. No existing records are removed. |
| Upgrade | Only after identity/signing/version/recovery authorization, update in place and verify retained records/settings/reminders after restart. Stop on conflict; no uninstall/data clearing. |

Local-only Notebook key handling is not portable backup recovery. Off-device
backup/restore, cloud tokens and paid services remain disabled. OS backup exclusion
and reinstallation/key persistence must be observed on the approved platform;
do not infer recoverability from a same-device warm reopen.

## Acceptance record

Record approved source/build SHA, profile/variant, artifact digest, package,
certificate fingerprint, installed/new versionCodes, device/OS, synthetic harness
identity, scenario IDs, exact observed result and failure-recovery evidence.
Exclude keys, raw database contents and personal information. Record review and
owner decisions separately. Mark unexecuted scenarios NOT TESTED, not passed.

Current disposition: **NOT TESTED / NOT AN APK CANDIDATE**. Installed-device
identity, signing compatibility, native durability/key behavior, physical UI,
retained-data update and activation approval remain unresolved gates. Continue
source development independently without relaxing them.
