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
| Notebook | Unmounted editor/preview, strict model and conditional session; new disabled foundation: encrypted SQLite active/previous/draft, SecureStore key lifecycle, explicit save reconciliation and App Lock/background boundary | Production editor/recovery UX still unmounted. Physical Android native/key/durability acceptance and owner activation approval required; unsubmitted typing has no durable autosave |
| Persistence | people-v1 AsyncStorage; owner/privacy separate; current milestone adds serialized person saves, visible errors, explicit latest-state retry and no write merely from opening | Native interruption/low-storage acceptance; people and notification operations are still not one transaction |
| Life management | Person-linked follow-up/reminder, completion/history and edit-time rescheduling | Independent appointments, vehicle/insurance/documents/bills/events and recurring responsibility records with completion/rescheduling |
| Briefing | Individual memory briefing plus home daily overview of current local follow-ups: overdue, remaining today, next seven local days, undated and invalid-date review | Independent appointments, renewals and life records are not implemented; no invented dates or claim that follow-ups are all life responsibilities |
| Local memory engine | Person substring search; Notebook title/body Unicode-normalized search in pure helper | Structured questions, locale-aware ranking/date handling, ambiguity clarification and grounded response sources |
| Privacy | PrivacyGate device authentication, permission catalogue, private new reminder content, local-first architecture; current batch blocks onboarding/private content after owner-profile load errors and adds read-only retry | Physical lock/permission acceptance and continued review of other persistence readers |
| Backup | Versioned encrypted envelopes, bound-identity helpers, injected Drive transport, generation/review helpers, synthetic Settings crypto diagnostic | OAuth/token/key UX, bounded native streaming, durable rollback, real recovery; actual backup/restore stays disabled |
| UX/global | Existing dark phone layout and onboarding/settings/bug-report paths; new save copy centralized separately | Full catalog extraction, reviewed Turkish/English catalogs and locale selection, light appearance, TalkBack/font/keyboard/layout measurement |
| Commercial | Founder financial policy/capacity worksheet and approved multi-platform payment strategy documentation | Current provider/region eligibility and fee verification, approved pricing/entitlements, subscription fulfillment and store review; all billing remains inactive |

Source inventory is not runtime or end-to-end verification. Existing AsyncStorage
people records are not separately encrypted by the app; preserve the owner's MVP
exception. Notebook's existing encrypted design and off-device AES-GCM requirements
are not weakened. No production key store or cipher was activated. Native
factories stay behind the disabled Notebook boundary; host SQLite/crypto tests
are not Android proof.

## Known P0 risks and ordered continuation

1. Preserve actual data and finish current persistence fixes with independent
   frozen-diff review and exact-SHA CI. Never clear data to exercise failures.
2. Integrate the implemented already-saved/retry-safe/conflict API into a reviewed
   Notebook recovery/editor UX. Submitted intents can be encrypted and durably
   staged before activation; ordinary unsubmitted typing is not checkpointed.
3. Validate the implemented SQLite/SecureStore/native factory on Android. Keep
   missing/corrupt keys and ciphertext fail-closed; no substitute keys. Prove
   physical rollback, interruption, full-storage and bounded retention before
   activation. Host SQLite rollback and terminated-process tests are now available.
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
