---
name: release-management
description: "Prepare AI Memory release or branch-promotion decisions, version policy and readiness evidence. Does not itself authorize commits, PRs, builds or publication."
---

# Release management

Apply the [working contract](../omega-orchestrator/references/working-contract.md).

## Workflow and responsibilities

1. Principal Architect reads branch policy, Android upgrade safety, applicable backup gates and current workflows. Identify candidate full commit, target branch, desired outcome and separately authorized operations. `devops_engineer` owns CI/artifact evidence, `android_engineer` device/upgrade evidence; qualified independent reviewers supply Rule 11 review.
2. Preserve the owner's FIRST.SECOND.THIRD cadence. Light features increment the second position; major leaps increment the first. Third-position fix policy remains contradictory, as does versionCode equality wording. Do not resolve either by generic semver or document ordering; ask only if an actual version/build decision depends on it.
3. Assign versions only for an authorized prepared/tested update, consistently across `app.json`, `package.json` and lockfile. Documentation/source commits do not require a bump. Keep `main` unchanged until approval and experimental work unpromoted.
4. Assemble a candidate-specific gate record: current CI, independent review, Android retained-data/lock/reminder/upgrade evidence, identity/signing verification and owner decision. Inspect indirect workflow triggers before remote steps; no gate grants an unrequested operation.
5. Apply [V3 delivery](../../../docs/feature-delivery-policy.md): design/TR-EN/security/regression/review, authorized checkpoint/push, exact-SHA CI, then APK_READY with the existing hosted build path or verified artifact and a focused Turkish checklist. Provide trigger instructions/source/expected version/code/destination; if triggered, link the run immediately and let it finish without interactive polling. Keep APK_READY, BUILD_TRIGGERED, BUILD_RUNNING, APK_VERIFIED, FOUNDER_ACCEPTANCE_PENDING and ACCEPTED distinct. Await founder feedback before the next major release increment; targeted tests replace blanket manual repetition. No repetitive ordinary build authorization, paid capacity, installation/production approval by inference or APK for documentation. Application-wide sensitive-data encryption is a commercial blocker; no unreviewed migration.

## Verification and completion

Verify immutable candidate and artifact identities against evidence. Report each gate as verified, failed or unverified, with source and limitations. Preparation completes with a concrete reviewable recommendation and blockers. Execution completes only for explicitly authorized operations with observed results; do not claim Play Store release, merge or installation from configuration or historical documentation.
