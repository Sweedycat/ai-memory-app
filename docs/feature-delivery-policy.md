# Permanent feature delivery and device acceptance policy

Founder version clarification (2026-11-21): development `0.0.x-dev`, next eligible
corrected B2 `0.0.4-dev`/code4; first public release planned `0.1.0`, maturity
`1.0.0` reserved. This supersedes earlier display cadence and the unbuilt0.3.0
proposal. Android integer versionCode must strictly increase; preserve package,
signing and data. No APK solely for a version-name change. B2 acceptance remains
pending; no Phase C advancement before founder acceptance.

Founder decisions, 2026-11-19 and Master Development V3, 2026-11-20. AGENTS.md Rules 08-10 and 17 govern this policy.
It supersedes earlier requirements to ask repeatedly for ordinary milestone APK
approval; all privacy, data-preservation, installation, production and financial
boundaries remain. V3 supersedes the requirement to wait for APK compilation in
an interactive engineering session. Source readiness, a hosted build, binary
verification, device acceptance and commercial readiness are separate evidence.

## Mandatory delivery cycle

V3.2 cumulative correction: preserve the registry's original45 entries and add
new defects/enhancements with starting SHA, criteria and next action before work.
Push recovery checkpoints throughout execution. Founder-reported 0.2.0 paths are
scoped observations; B2 is not accepted while confirmed input-loss/system-bar
defects and requested digital HH/MM entry remain. Repair these before later major
features. At >5% normal bounded work is allowed; <=5% starts no long work or
unnecessary agents; <=1% stops. Unknown official allowance permits one bounded unit.

V3.2 supersedes the older pre-build APK_READY wording below: source/CI readiness
is VERIFIED, an acknowledged unfinished run is BUILD_TRIGGERED/BUILD_RUNNING,
and actual completed artifact verification precedes APK_READY and targeted founder
acceptance. Never label an incomplete build APK_READY. Link one authorized free
hosted run immediately and let it finish independently. Build success, artifact
identity, installed identity and founder acceptance are separate evidence levels.

V3.1 makes [TASK-REGISTRY.json](omega/TASK-REGISTRY.json) the single task-status
authority. Register work and push a sanitized checkpoint before substantial
implementation; synchronize human-readable summaries after progress. Recover
actual interrupted work, specialist output, dependency and CI state before
continuing. Never repeat verified work or mark COMPLETED before all applicable
criteria (including required founder device acceptance) pass. Record independent
implementation, automated, APK and physical evidence with exact source references.
At or below 5% in either official usage window, start no new long-running task or
unnecessary specialist session; preserve checkpoints early. The mandatory stop at
or below 1%, zero spending and no automatic reset/resume remain unchanged.

For each completed user-facing feature or significant UI/UX milestone:

1. Complete the authorized implementation with observable acceptance criteria.
2. Check the application-wide design system against both existing and new screens.
3. Verify complete Turkish and English localization of the affected feature and
   its integrated flows, including loading, empty, error, confirmation and
   accessibility labels. No mixed-language interface labels in the selected locale.
4. Run applicable security checks and meaningful automated regression tests.
5. Obtain independent frozen-diff review; apply AGENTS.md Rule 11 qualifications.
6. Commit and push the validated checkpoint on the authorized development branch.
7. Verify successful GitHub CI for the exact source SHA.
8. Make the exact checkpoint APK_READY with the existing hosted GitHub Actions
   pipeline, verified zero-cost eligibility/capacity and a tested branch-scoped
   one-build-per-approved-checkpoint trigger. An automatic path after checks is
   preferred; a prepared founder trigger is acceptable. Never change main merely
   to expose manual dispatch or repeat its known default-branch absence failure.
9. Record exact source SHA, branch, expected version/code, workflow/trigger and
   artifact destination. If triggering a hosted build, immediately provide its
   run link and let it finish independently; no repeated Gradle polling. Verify
   actual APK package, versionName, versionCode, signing certificate and SHA-256
   against build/download evidence before calling the artifact APK_VERIFIED.
10. Deliver the verified artifact link or simple ready-to-run trigger instructions,
    plus a focused Turkish device checklist, known limits and unverified gates.
11. Await founder observations and acceptance on the Samsung Galaxy S26 Ultra.
12. Record feedback immediately, prioritize corrections and obtain the required
    device results before advancing to the next major user-facing feature.

Do not treat CI, unit tests, screenshots of source, or APK production as physical
acceptance. Corrections follow the same applicable validation and delivery gates.
Do not start automatic retry loops or additional speculative builds after failure;
checkpoint, record the cause and respect the current task's attempt limit.
Await founder feedback before the next major user-facing release increment;
safe independent research, documentation and non-conflicting preparation may
continue. Use risk-based targeted device checks rather than repeating every
historically successful manual scenario. Installation alone accepts no feature.

## Unified interface and localization

Review typography, colors, icons, buttons, cards, navigation, spacing, safe-area
handling, accessibility and supported light/dark themes across existing and new
screens. Check visual hierarchy, Back control size, touch targets, font scaling,
TalkBack labels, keyboard behavior and status/navigation-bar overlap. Localize
all app-controlled interface labels in both Turkish and English and check each
selected language end to end. User-entered text is not an interface translation.
Do not claim unsupported themes or complete app-wide localization from one screen.
Record existing inconsistencies as defects rather than accepting them as a new
screen's design baseline. This document does not assert a finished design system.

## Standing build authority and retained-data boundaries

Ordinary qualifying milestone APK builds need no repetitive founder approval.
Use the approved development package and consistent signing identity through the
existing GitHub Actions pipeline; a Preview artifact is not the branch `preview`
or permission to switch to EAS Preview's different package. Do not change signing
credentials or substitute a package to make an update install. Use a strictly
higher versionCode than the highest previously delivered verified artifact for
that package, and a visible version under the owner's existing cadence. Keep
manifests consistent; unresolved third-position policy remains unresolved.
Read actual latest produced metadata before incrementing. The founder reports
the last installed candidate as `0.1.0` / code `2`; do not treat that report as
independently inspected installed package/certificate evidence.

Build authority is separate from installation authority. Actual installed-device
identity and compatibility remain unverified until confirmed before a separately
authorized installation. Never uninstall, clear storage or risk existing records,
keys, settings, biometrics or reminders. No production release, main/preview merge,
Play publication, paid service or sensitive-feature activation is authorized here.

Internal documentation and invisible refactoring do not independently require
an APK. Explicit current-task prohibitions override the standing build authority.
If free capacity or official quota is insufficient, save a safe checkpoint and
report the blocker. Preserve zero spending, no automatic top-ups/resets and the
mandatory stop at or below 1% in either official quota window. No automatic resume.

## Evidence, feedback and acceptance states

Track implementation status, automated checks, binary verification, device
acceptance and commercial readiness separately. Delivery states are:

| State | Required evidence |
| --- | --- |
| APK_READY | Reviewed checkpoint, exact-SHA CI, prepared validated build path, expected identity/version/code and checklist; no produced APK implied |
| BUILD_TRIGGERED | A single hosted run acknowledged with run URL and exact source SHA |
| BUILD_RUNNING | Hosted run actually observed in progress; no polling obligation |
| APK_VERIFIED | Actual package/version/code/certificate/integrity verified and downloadable artifact associated with source SHA |
| FOUNDER_ACCEPTANCE_PENDING | Founder checklist/results outstanding, whether delivered as verified artifact or prepared build |
| ACCEPTED | Required risk-based physical tests passed and founder explicitly accepted the increment |

Record correction-required observations without promoting any evidence state.
Do not skip states or label fully accepted while required device tests remain open.
Record source SHA, review identity/findings, test outcomes/omissions, CI/build and
artifact links, verified package/version/certificate/hash, known limits, checklist
and founder results. Attach only authorized redacted evidence; never put personal
records, credentials or unredacted screenshots into public repository documents.

The focused checklist covers the changed feature in Turkish and English, visual
consistency, Back/navigation and safe areas, accessibility and applicable themes,
plus retained records/settings, restart, App Lock, permissions and reminders where
affected. Separate observed device results from expected behavior. Prioritize
reported defects and keep the next major feature gated on required acceptance.

## V3 product and security priorities

V3 authorizes controlled product milestones, not an unreviewable full rewrite.
Milestone A reconciles policy, current inventory, narrow automation and native
roles. Milestone B centralizes TR/EN and settings, prepares coherent visual
alternatives and addresses founder defects after appropriate design approval.
Encryption architecture/threat modeling may proceed independently; application-
wide authenticated local encryption is now a critical commercial release gate,
superseding the former MVP exception. No real migration is activated without
independent review, synthetic recovery tests and required physical acceptance.

Next priority, reported by the founder; not independently reproduced in this
session: mixed Turkish/English interface, inconsistent visual design, oversized
Back button and safe-area issues. Preserve records and functionality; scope the
correction against existing and new screens, then apply the full delivery cycle.
No substantial visual redesign before the founder approves the visual direction.
On 2026-11-20 the founder approved all three [directions](design/DIRECTIONS.md):
A default classic black/mint, B modern navy/periwinkle, C coordinated light/dark,
plus System following device appearance. All remain free for every membership;
no entitlement gate or duplicated screens. Settings appearance selection must use
shared tokens/components, previews, immediate application and safe persistence;
all future user-facing features support all available themes. Approval is not
implementation/physical acceptance, and other substantial directions need approval.
Subsequent backup/Notebook activation, notification reconciliation and commercial
milestones follow dependencies in [the completion roadmap](../PRODUCT-COMPLETION-ROADMAP.md).
