# Current verified progress

Active source work is local/uncommitted against `83214faab9125a237b256b6fb03005bc2078447a`: App/People ACK+guards,root viewport,digital entry,Profile/Bug/Settings and gated Life/Notebook guards implemented. Focused34/App54/parent21/Notebook-Life62 checks passed at their scopes (overlap; do not sum). New failure tests, qualified review and integrated release checks remain. Inspect surviving diff/ownership in registry workUnit; no source reset/restart or corrected APK claim.

[TASK-REGISTRY.json](TASK-REGISTRY.json) is the sole current task/evidence authority. V3.2 is cumulative; original45 IDs retained,54 total tasks. B2 is NOT ACCEPTED. No completion percentages, production activation or installed-identity claims.

| ID | Status | Scope | Exact next action |
| --- | --- | --- | --- |
| V32-TRACKING | VERIFIED | V3.2 recovery, founder evidence, policy and durable registry | Validate and push sanitized V3.2 starting checkpoint |
| BUG-B2-001 | IN_PROGRESS | Application-wide unsaved-change protection | Complete App and other editable-flow guard children; review/integrate/retest |
| BUG-B2-001-A | VERIFICATION_PENDING | People creation/edit/notes/interactions/follow-up/reminder navigation guards | Inspect existing local implementation, finish missing verification; do not restart completed source work. |
| BUG-B2-001-B | VERIFICATION_PENDING | Profile, report, Life, gated Notebook and future form protection | Inspect existing local implementation, finish missing verification; do not restart completed source work. |
| BUG-B2-004 | VERIFICATION_PENDING | Global status-bar scrolling viewport repair | Inspect existing local implementation, finish missing verification; do not restart completed source work. |
| BUG-B2-005 | VERIFICATION_PENDING | Global navigation-bar and bottom action safe area repair | Inspect existing local implementation, finish missing verification; do not restart completed source work. |
| UX-B2-001 | VERIFICATION_PENDING | Shared digital 24-hour reminder HH/MM entry | Inspect existing local implementation, finish missing verification; do not restart completed source work. |
| UX-B2-002 | VERIFICATION_PENDING | Accessible boolean switches and wording polish | Inspect existing local implementation, finish missing verification; do not restart completed source work. |

Local/remote starting checkpoint `69d8fd899d81bdae65ffd80442d4af80579c6e82` matched, clean tree. Its exact-SHA CI44670525880/full and44670525876/portability succeeded. Previous app sourceaa7565c and hosted sourcec41410e remain historical. Do not rerun the prior B2 regression without changed source or a new concern.

## Founder-reported0.2.0 observations (2026-11-20)

Samsung Galaxy S26 Ultra; tested paths only, installed binary provenance not independently established. B2 NOT ACCEPTED.

### PASSED

- Existing People records accessible after update
- Existing memory notes accessible
- Historical follow-ups accessible
- All five appearance choices functioned
- Language changes functioned
- Theme/language preferences survived close/reopen
- System appearance followed device light/dark
- Immediate App Lock on background/return
- Device authentication required before protected content
- Reminder notifications received
- Private content hidden in collapsed and expanded notifications
- Notification routing opened correct person after authentication
- English reminder displayed correctly
- Turkish reminder displayed correctly
- Person-detail interface correct in Turkish and English
- Personal records not translated by language changes
- Keyboard/back worked in tested person-creation path
- Completed reminder history showed dates/times
- Increased system font size reflected on person details
- Visible buttons/cards resized appropriately
- Long visible labels wrapped

### FAILED

- Unsaved person-creation input discarded on Back without warning
- Scrolling content overlapped status bar
- Scrolling content overlapped navigation bar

### UNVERIFIED

- Installed binary identity and complete artifact provenance
- Large text throughout all Settings screens
- TalkBack
- Every screen in both languages and all appearances
- All App Lock timeout options
- Language updates for previously scheduled notifications
- Exact timing under every native scheduling condition
