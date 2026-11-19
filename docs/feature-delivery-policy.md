# Permanent feature delivery and device acceptance policy

Founder decision, 2026-11-19. AGENTS.md Rules 08-10 and 17 govern this policy.
It supersedes earlier requirements to ask repeatedly for ordinary milestone APK
approval; all privacy, data-preservation, installation, production and financial
boundaries remain. This is a delivery policy, not new workflow implementation.

## Mandatory delivery cycle

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
8. Automatically produce one free Android Preview APK using the existing validated
   GitHub Actions pipeline, after verifying free capacity and official quota.
9. Verify actual APK package, versionName, versionCode, signing certificate and
   integrity. Compare against the approved previous artifact; record APK SHA-256
   and check downloaded bytes against the build hash/artifact evidence.
10. Deliver the downloadable artifact link, build ID/source SHA and a focused
    physical acceptance checklist, with known limitations and unverified gates.
11. Await founder observations and acceptance on the Samsung Galaxy S26 Ultra.
12. Record feedback immediately, prioritize corrections and obtain the required
    device results before advancing to the next major user-facing feature.

Do not treat CI, unit tests, screenshots of source, or APK production as physical
acceptance. Corrections follow the same applicable validation and delivery gates.
Do not start automatic retry loops or additional speculative builds after failure;
checkpoint, record the cause and respect the current task's attempt limit.

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

Track each milestone as source validated, exact-SHA CI verified, APK verified,
awaiting device acceptance, correction required, or founder accepted. Do not skip
states or label a feature fully accepted while required device tests remain open.
Record source SHA, review identity/findings, test outcomes/omissions, CI/build and
artifact links, verified package/version/certificate/hash, known limits, checklist
and founder results. Attach only authorized redacted evidence; never put personal
records, credentials or unredacted screenshots into public repository documents.

The focused checklist covers the changed feature in Turkish and English, visual
consistency, Back/navigation and safe areas, accessibility and applicable themes,
plus retained records/settings, restart, App Lock, permissions and reminders where
affected. Separate observed device results from expected behavior. Prioritize
reported defects and keep the next major feature gated on required acceptance.

## Current policy-only checkpoint and next priority

This session only records this policy, validates and commits/pushes documentation,
checks exact-SHA CI and stops. No UI overhaul, workflow edit or new APK build.
An earlier authorized APK run44565432466 was already triggered at source
`5b679b35a535ab723739a7b31d71ceeaa2b75acf`; its result is not asserted here.
This policy-only checkpoint does not restart or duplicate that build.

Next priority, reported by the founder; not independently reproduced in this
session: mixed Turkish/English interface, inconsistent visual design, oversized
Back button and safe-area issues. Preserve records and functionality; scope the
correction against existing and new screens, then apply the full delivery cycle.
Do not begin that implementation under this documentation-only authorization.
