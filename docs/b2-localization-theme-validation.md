# B2 localization, appearance and Settings validation

Registered scope: V3-B1-02, V3-B2-01 through V3-B2-05. Development branch only.
Recovery baseline: `93bd8029f50b0386636ea447ee2fd92406a80c13`, after the verified
B1 checkpoint `48cd226ebc03e3cd14383a4d57636ce08a599166`. The registry checkpoint
passed full CI44665731118 and portability44665731127; its APK was intentionally
skipped. Those runs do not validate the later B2 application diff.

## Implemented scope

- Central catalog/provider integration across App, gates, Settings, People/history,
  Life, grounded queries, reports, permissions, synthetic backup and gated Notebook
  screens. TR/EN selection is explicit or system-default; formatting follows the
  selected locale. Personal records and stored source/category enums are unchanged.
- Shared free Classic (default), Modern, Light, Dark and System tokens, reusable
  compact AppHeader/Screen, consistent text/control sizing and theme-aware inputs.
  Settings > Appearance > Theme provides previews and confirmed immediate selection.
  No membership/entitlement dependency or theme-specific screens.
- Versioned language/appearance preferences reuse one safe enum-store protocol:
  no construction writes, strict documents, read-before-write, revision/byte checks,
  serialized writes and confirmed readback. Failed/corrupt/ambiguous operations
  retain confirmed state/original bytes and require explicit reload. Invalidation
  fences publication; it cannot undo an issued write. This is not cross-process
  CAS or proof of native crash atomicity.
- Functional Settings sections for profile, language, appearance/theme, security,
  privacy/permissions, notifications, experimental backup, support and About.
  Unimplemented commercial/assistant services are not presented as active controls.
- Root safe-area provider, native safe-area screen boundaries, App page measured
  insets, dynamic system appearance/status bars and Expo57 SystemUI integration.
  The existing owner/privacy/Notebook gate order is preserved without theme keys.
- Newly scheduled reminders use the selected language with generic private content,
  unchanged channel/routing identity and fixed diagnostic codes. Changing language
  does not silently reschedule existing alerts; their original language can remain.
- Candidate version `0.2.0`, GitHub Test code `3`; latest verified delivered artifact
  was `0.1.0`/code `2`. EAS Preview's separate package/code `2` and signing remain
  unchanged. Source metadata is not a produced APK or installed-device inspection.

## Verification and independent review

Local environment: Windows, Node24.19.0; hosted CI uses Node22. Focused synthetic
App, feature, preference/provider, Settings, gate, date, briefing and notification
tests passed at their recorded scopes; overlapping counts must not be added.
Strict TypeScript passed. Expo Doctor passed21/21 after the two SDK57-compatible
safe-area/SystemUI dependencies were installed. No SDK upgrade or local APK build.

Initial integrated regression:512 tests,508 passed,2 failed,2 platform skips.
Independent review identified the same two accidental valid negative inputs in
previewBuildVersion.test.cjs. They were restored to mismatched `0.1.0` inputs
against expected `0.2.0`; assertions and workflow security gates were preserved.
Focused APK metadata/signature/trigger tests then passed8/8. Final full regression
passed512 tests:510 passed,2 existing Windows platform skips,0 failed/cancelled.
No assertion or timeout was weakened. The final typecheck also passed; exact-SHA
hosted CI and artifact/physical verification remain separate publication gates.

Independent Reviewer authored none of the implementation and reviewed69 frozen
non-documentation files (including AGENTS). Original digest
`3555e8cf488b71669888fe55e8c3f3528e60a2e9586016940121bb59f10fbb1b`;
after only the two negative-test corrections, final reviewed digest
`42bfd3e3405fc03e2283e35c131ef2df3ee6b66d777fa5ac8d6ec2dca3b9cf93`.
Algorithm: sorted unique modified/untracked non-doc paths, then filename/NUL/raw
bytes/NUL into SHA-256. Reviewer verified the delta reproduced the original hash
in memory and closed P1; no remaining blocking source finding. Whitespace passed.
This is source review and synthetic evidence, not physical or production approval.

The two retained Windows skips are `manifest file symlinks are rejected before
network` (host denies synthetic file-symlink creation) and `a special FIFO manifest
is rejected without opening it` (Windows has no POSIX FIFO). No security assertion,
permission or skip was weakened. Ubuntu CI executes the applicable POSIX coverage;
verify each exact-SHA run rather than borrowing old results.

## Release and physical gates

Repository visibility was rechecked public. The unchanged hosted workflow uses
standard `ubuntu-latest`; [GitHub's current runner documentation](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
states standard runners are free/unlimited for public repositories. No EAS credits,
larger runner, paid service, account configuration or billing activation is used.

After reviewed source is pushed and exact-SHA CI passes, use the existing guarded
development-branch request `build: preview APK [APK_READY]` (exact empty-commit
subject, no body), at most one hosted attempt for this approved checkpoint.
Publish its run URL immediately; do not wait/poll Gradle. Artifact destination:
`ai-memory-isolated-standalone-apk`, containing app-release.apk. Actual package,
version/code, certificate and SHA-256 must pass the unchanged workflow gates before
APK_VERIFIED. Record the exact source/run in the registry/APK-STATUS.

Expected package: `com.sweedycat.aimemory.githubtest`; versionName0.2.0/code3;
historical certificate SHA-256
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
This is a reproducible development identity, not an exclusive production signing
identity. Installed-device compatibility remains unverified. Installation is
separately authorized and must never require uninstall/data clearing.

Focused Galaxy S26 Ultra acceptance: verify retained records/settings and actual
installed identity before an authorized in-place update; system/TR/EN choice and
reopen persistence; all five theme previews, selection, reopening and device-mode
changes; affected loading/empty/error/confirmation labels; compact Back, keyboard,
status/navigation bars under gesture/three-button navigation; large font/TalkBack;
App Lock denial/background/resume; new private reminder delivery/tap routing.
Use synthetic new records and no public personal screenshots. Android native date
picker/OS permission dialog language follows Android; no claim that app language
overrides those OS-controlled labels. Life date-only fields remain explicit ISO
calendar dates without timezone conversion. Existing scheduled reminders retain
their creation-time language.

Notebook production remains false and real backup/restore disabled. Existing
sensitive plaintext storage is a critical commercial blocker. Existing PrivacyGate
read-default behavior and bug-report non-array-history fallback remain separately
registered risks, unchanged by localization. No next major user-facing milestone
until required founder observations/acceptance; no commercial readiness claim.
