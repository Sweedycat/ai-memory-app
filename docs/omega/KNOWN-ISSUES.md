# Current defects and blockers

New source finding BUG-B2-006: staged date/raw digital time is outside main form dirty state; DST date prepopulation can normalize clock before validation. Registered before implementation; App writer must close/test this boundary before review/APK. Registry now55 tasks; original45 retained.

[TASK-REGISTRY.json](TASK-REGISTRY.json) is the sole current task/evidence authority. V3.2 is cumulative; original45 IDs retained,54 total tasks. B2 is NOT ACCEPTED. No completion percentages, production activation or installed-identity claims.

| ID | Status | Scope | Exact next action |
| --- | --- | --- | --- |
| V3-B2-05 | BLOCKED | Review, tests, APK_READY and founder acceptance | Repair registered B2 defects first; do not mark accepted. |
| V3-C | BLOCKED | App-wide encryption and safe migration | Prepare architecture and synthetic recovery. |
| V3-C-03 | BLOCKED | Independent review and native recovery gate | Obtain review and authorized native evidence before activation. |
| V3-D | BLOCKED | Encrypted backups, Drive, recovery and Notebook | Finish full-domain manual recovery before live transport. |
| V3-D1-04 | BLOCKED | Manual recovery, retention and safe device migration acceptance | Prepare synthetic native recovery checklist; keep real restore/export disabled. |
| V3-D2-02 | BLOCKED | Verified archives, retention and opt-in automation | Close manual gates before enabling background backup. |
| V3-D3-01 | BLOCKED | Disabled Notebook and native acceptance | Preserve false gate; execute only authorized native synthetic plan. |
| V3-F | BLOCKED | Commercial and broader product readiness | Close encryption/recovery/localization/design/device blockers. |
| V3-F-06 | BLOCKED | Play/StoreKit/Patreon/website payment readiness | Keep providers disabled pending founder/financial/security gates. |
| V3-F-07 | BLOCKED | Bootstrap-first financial/store/legal readiness | Prepare evidence and founder decisions without purchases or promises. |
| BUG-B2-001 | IN_PROGRESS | Application-wide unsaved-change protection | Complete App and other editable-flow guard children; review/integrate/retest |
| BUG-B2-001-A | VERIFICATION_PENDING | People creation/edit/notes/interactions/follow-up/reminder navigation guards | Inspect existing local implementation, finish missing verification; do not restart completed source work. |
| BUG-B2-001-B | VERIFICATION_PENDING | Profile, report, Life, gated Notebook and future form protection | Inspect existing local implementation, finish missing verification; do not restart completed source work. |
| BUG-B2-004 | VERIFICATION_PENDING | Global status-bar scrolling viewport repair | Inspect existing local implementation, finish missing verification; do not restart completed source work. |
| BUG-B2-005 | VERIFICATION_PENDING | Global navigation-bar and bottom action safe area repair | Inspect existing local implementation, finish missing verification; do not restart completed source work. |
| UX-B2-001 | VERIFICATION_PENDING | Shared digital 24-hour reminder HH/MM entry | Inspect existing local implementation, finish missing verification; do not restart completed source work. |
| UX-B2-002 | VERIFICATION_PENDING | Accessible boolean switches and wording polish | Inspect existing local implementation, finish missing verification; do not restart completed source work. |

Confirmed founder failures are input loss on Back and scrolling beneath both system bars. Existing PrivacyGate read-default and nonarray bug-report-history handling remain separately tracked V3-F-01/02 risks; no claim of demonstrated exploit or People data loss. Blocker details/resolution/role/reopening conditions are in the registry.
