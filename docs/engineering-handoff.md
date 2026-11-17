# Omega engineering handoff

## Current continuation — Master Development V2, 2026-11-17

Current development branch: `development/omega-commercial-mvp`, created from
clean, remote-verified `4bd815625f1456e116aaa5f8358549b40318989a`. The owner now
authorizes continued safe application milestones and normal validated checkpoint
commits/pushes. No paid activation, force push, main/preview merge or production
release. APK/signing/install still require their existing separate authorization
and owner-participated physical acceptance. Historical scope below is retained
for Phase 14 provenance; it does not limit or authorize the current task.

Read [financial policy](financial-policy.md) and AGENTS Rule 15: bootstrap first,
actual settled revenue before paid-service proposals, all eight activation gates,
90-day reserve target, five-scale exposure worksheet, owner approval even after
settlement. No services, credentials, subscription billing or real app data used.

Delivered current app changes: full-base conditional Notebook saves/deletes;
serialized people writes, persistent save notice and explicit latest-state retry;
no automatic people write on open; failed person edits retained in process across
gate remounts; owner-profile read/validation failures block onboarding/private
content and allow explicit read-only retry. Shapes/storage keys, intentional empty
lists, legacy records, App Lock, notifications, package IDs/signing/versioning and
the MVP local-encryption exception are preserved. Unsaved changes cannot survive
process death; a reminder can exist even if its people write fails. Retry does
not reschedule native reminders.

See [current validation](omega-commercial-mvp-validation.md) for exact tests,
frozen review identity and remaining gates, and
[product inventory](commercial-mvp-status.md) for implemented/planned boundaries.
Organic launch preparation is source documentation only; nothing published.
Resolve the containing commit with `git log -1 --format=%H --
docs/omega-commercial-mvp-validation.md`; verify remote equality and exact-SHA CI
instead of assuming a static document is fresh.

Next narrow P0 milestone: Notebook uncertain-save reopen/reconciliation with
draft preservation and full-base conflict handling, then independently reviewed
durable ciphertext/key lifecycle and App Lock/native acceptance before mounting.
Actual Notebook, Drive backup/restore, paid AI/BYOK, voice, wearables and billing
remain disabled. Do not call this a complete Notebook or commercial MVP.
Residual audit: three moderate entries, zero high/critical; no forced downgrade.
Physical Android acceptance and exact installed package/certificate/versionCode
remain unverified. Remaining owner version-policy ambiguities are unchanged.

## Historical Phase 14 recovery handoff

Date: 2026-11-17. Current owner task authorizes application blocker repairs,
independent review, a separate integration candidate, and runtime-approved normal
pushes to dedicated repair/integration branches. No APK/prebuild, deployment,
main/preview merge, paid services, real-data access or activation of prototypes.
A handoff is evidence, not authorization for a subsequent task.

## Baselines and current work

- Preserved Omega: cead9b3fbd18c48a571b77e87e6fc97894478d6f.
- Preserved Notebook: f457812cead8bcc46467751c0baebaefe6ce8476.
- Validated repair: repair/omega-phase14-notebook,
  099084964819b1f57df81852675c17ce1b930df3; remote equality verified.
- Separate candidate: integration/omega-notebook-phase14. Its application plus
  unchanged Omega infrastructure first assembled at
  dbc636cfad701ddfd7eb37659d71bc38da16645a; later documentation checkpoint is the
  current branch tip. Resolve its exact SHA and verify remote equality on resume.
- Main remains 35f5238a90a901f410383594f9bbeffee5d3d7a0; preview remains
  a438003b308d545dcd94a7a6e5495e1c0633de69. No existing branch was reset/deleted.

The candidate starts at repaired Notebook and replays only five engineering
commits. All eight application overlaps were explicitly reconciled; latest
Notebook behavior is retained, with only the stale Settings label corrected.
Original Omega application commits were not replayed over newer app files.
See [current validation](phase14-recovery-validation.md) for exact replay mapping,
tree-equality checks, test evidence, review identity and current checkpoint status.

## Checks and remaining risks

Repair: fresh lockfile npm ci PASS; strict TypeScript PASS; full units 206/206,
Notebook 25/25, backup/restore/data preservation 139/139, Doctor 21/21, dependency
tree clean. These are host/synthetic checks. Repair CI 43956904182 on exact
0990849 also PASSED on Ubuntu/Node 22. Candidate-specific checks and CI must be
read from the current validation addendum, not inferred from repair alone.

SDK remains 57, now expo ~57.0.33; React Native 0.86.3 and app version 0.0.2 remain.
TS2532 and the CRLF privacy test are fixed without weaker strictness/assertions.
Dependencies are installed in the validated environments; use npm ci from the
committed lock in any other checkout. No ignored Doctor checks or forced majors.

Audit remains 3 moderate entries (expo/fingerprint/minimatch), one residual
minimatch advisory; no high/critical. Compatible fingerprint patch removed the
other glob advisory. Independent source review found no triggering route in the
inspected default matcher path; this is not a clean audit or release acceptance.
Track an upstream compatible fix; never apply npm's proposed breaking SDK
downgrade/forced override just to clear the count.

People-save error visibility/retry remains the recommended next narrow app task.
Notebook encrypted wrappers/editor are not production-wired. Durable backend,
key lifecycle, App Lock/background integration, snapshots/rollback, migration,
native crypto and Android failure/resource tests remain separate gates. Keep
real backup/restore/Notebook storage disabled; preserve original people/settings.

## APK evidence and acceptance

Latest identifiable checkpoint APK artifact: run 43643898173, artifact
14132499977, source 594004718471c4269bf3d75943e9a033fcf6f1c1. Workflow is isolated
com.sweedycat.aimemory.githubtest; it does not establish Preview's installed APK.
Exact last physically tested/installed source, certificate and versionCode remain
UNVERIFIED. Build metadata and device-tested branch names are not phone evidence.

Before a separately authorized APK/update: verify current installed package,
certificate/versionCode and original EAS project/account; bind the approved source
and artifact/profile/variant; resolve any applicable owner version-policy ambiguity;
verify recoverability; update in place, never uninstall/clear data; then confirm
retained records/settings, restart/reopen, App Lock, denial/revocation, reminders
and follow-ups. No physical-device evidence was produced in this recovery task.

## Resume, rollback and remote controls

Read current AGENTS and owner scope; inspect branch/full HEAD/status plus remote
refs. Resume from these documents, not the historical Phase 14 BLOCKED snapshot
inside [.codex/omega-final-validation.md](../.codex/omega-final-validation.md).
Phase 13's 11-role, 12-Skill, Hook/routing/continuity validation still stands; do
not repeat it unless affected. Recovery used software_engineer, devops_engineer
and independent_reviewer, at most two concurrent, no recursive delegation.

Preserve branches/commits and any dirty work. Use a new branch or reviewed revert
commit for rollback; never hard reset, force push, delete branches, clear storage
or replace signing credentials. A source rollback is not an APK/data rollback.
The original root-bound Hook launchers are preserved byte-for-byte; another
checkout is not independently certified as portable. No trust/sandbox relaxation.

GitHub ref/run/job/artifact-metadata reads and dedicated normal pushes are
available; repository remains PUBLIC. Dedicated branch CI runs tests only; main
pushes can still trigger EAS builds. No manual build workflow was invoked. No
account linking, new MCP service, visibility change, credentials or personal data.

Synthetic continuity record retained: OMEGA-CONTINUITY-20261116-PINE-47;
toy lantern stays blue. This is repository continuity, not platform memory.
Stop before APK production. Next application development needs a new owner task.
