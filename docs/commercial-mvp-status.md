# Commercial MVP implementation inventory

Source inspection: 2026-11-17, starting at
`4bd815625f1456e116aaa5f8358549b40318989a`, on dedicated
`development/omega-commercial-mvp`. This is a development checkpoint, not a
commercial release, physical-device result or percentage-complete estimate.
The owner's Master Development V2 supersedes older cloud-first roadmap language.

## Observed product boundaries

| Area | Implemented source | Still needed for the requested commercial MVP |
| --- | --- | --- |
| People | App.tsx: readable profile identity/role/company/phone/context, notes, interactions, one open follow-up and completed history, reminders, substring search, explicit contact actions/export | Tags/topics, duplicate/ambiguous matching, multiple structured commitments; photo consent/storage review before photos |
| Notebook | PersonalNoteEditor/PersonalNotebookPreview, strict model, encrypted vault/session, access gate, backup comparison and review-only restore helpers | Editor and storage are unmounted. Reviewed native durable ciphertext backend, notebook-specific key lifecycle, safe uncertain-save reopen/reconciliation, App Lock/background integration and Android recovery evidence |
| Persistence | people-v1 AsyncStorage; owner/privacy separate; current milestone adds serialized person saves, visible errors, explicit latest-state retry and no write merely from opening | Native interruption/low-storage acceptance; people and notification operations are still not one transaction |
| Life management | Person-linked follow-up/reminder, completion/history and edit-time rescheduling | Independent appointments, vehicle/insurance/documents/bills/events and recurring responsibility records with completion/rescheduling |
| Briefing | buildMemoryBriefing summarizes an individual from stored facts without network | Cross-record daily agenda, overdue/upcoming items and renewals; do not invent absent structured records |
| Local memory engine | Person substring search; Notebook title/body Unicode-normalized search in pure helper | Structured questions, locale-aware ranking/date handling, ambiguity clarification and grounded response sources |
| Privacy | PrivacyGate device authentication, permission catalogue, private new reminder content, local-first architecture; current batch blocks onboarding/private content after owner-profile load errors and adds read-only retry | Physical lock/permission acceptance and continued review of other persistence readers |
| Backup | Versioned encrypted envelopes, bound-identity helpers, injected Drive transport, generation/review helpers, synthetic Settings crypto diagnostic | OAuth/token/key UX, bounded native streaming, durable rollback, real recovery; actual backup/restore stays disabled |
| UX/global | Existing dark phone layout and onboarding/settings/bug-report paths; new save copy centralized separately | Full catalog extraction, reviewed Turkish/English catalogs and locale selection, light appearance, TalkBack/font/keyboard/layout measurement |
| Commercial | Mandatory founder financial policy and capacity worksheet | Approved pricing/entitlements, validated subscription fulfillment and store review; billing remains inactive |

Source inventory is not runtime or end-to-end verification. Existing AsyncStorage
people records are not separately encrypted by the app; preserve the owner's MVP
exception. Notebook's existing encrypted design and off-device AES-GCM requirements
are not weakened. No new key store or cipher was activated.

## Known P0 risks and ordered continuation

1. Preserve actual data and finish current persistence fixes with independent
   frozen-diff review and exact-SHA CI. Never clear data to exercise failures.
2. Complete Notebook uncertain-save recovery: authenticate a reopened session,
   compare the attempted note and original full base against stored state,
   distinguish already-saved/retry-safe/conflict, retain the draft, and require
   comparison for conflicts. Never blindly retry a blocked session.
3. Implement/review durable native ciphertext replacement and notebook-specific
   secure key lifecycle. Keep missing/corrupt key and ciphertext fail-closed;
   do not generate a substitute key over existing ciphertext. Prove rollback,
   interrupted/full-storage behavior and bounded retention before wiring.
4. Wire Notebook only after review, tests and owner/device activation gates;
   unmount private drafts on lock/background according to the approved policy.
   Assistant access must be separately explicit and off by default.
5. Then add structured life records and a fact-grounded daily briefing; introduce
   schema/legacy compatibility deliberately, without mandatory external AI.
6. Expand local retrieval and premium UI incrementally, extracting strings for
   reviewed Turkish/English. No paid translation or large model downloads.
7. Entitlements, safe feedback and organic-launch preparation follow verified
   product value. P3 AI/voice/wearables must not delay these milestones.

Owner-profile, privacy-setting and bug-report readers deserve continued failure
review. A caught read error must not become permission to overwrite original
bytes. This inventory does not certify all gates or all persistence paths.

## Remote inventory at task start

GitHub branch inventory and `git ls-remote` matched the starting integration SHA;
no newer remote integration work was overwritten. Main remains `35f5238`, preview
`a438003`; the existing repair worktree/branch was preserved. Integration
[CI 43958295912](https://github.com/Sweedycat/ai-memory-app/actions/runs/43958295912)
passed at the exact starting SHA. New checkpoint CI must be verified separately.

Open issues inspected: #2 optional report attachments, #5 advisories, #6 encrypted
backup, #7 monetization, #12 address book, #13 dossiers, #14 face-enrollment future,
#22 account architecture. Older AI allowance/account proposals are not activation
authority under the new financial policy. Open PRs #8/#11/#16/#19/#21/#23 were
inventoried, not merged or treated as delivered features. No issues/PRs changed.

## Acceptance boundaries

Exact results belong to the current validation record and handoff. Unit/mocked
checks do not establish native storage durability, physical migration, reminder
delivery, screenshots or premium visual quality. Android acceptance still needs
owner participation, installed package/certificate/versionCode verification,
safe in-place update with retained records, restart/reopen, App Lock, permission
denial/revocation and notifications. No APK, signing or install is authorized by
passing development checks; preserve unresolved version-policy wording.
