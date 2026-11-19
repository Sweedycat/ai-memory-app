# Authorized GitHub Test APK 0.1.0 (2)

Founder clarification, 2026-11-19: APK production is authorized separately from
installation. Installed-device metadata is a pre-installation gate and does not
block producing this one test artifact. No installation, uninstall, data reset,
key replacement, cost obligation, main/preview merge or sensitive flag activation.

## Candidate and historical comparison

Starting clean source: `6e3c6ab436659aeeb52aa27838af9a67e4a1c0ed`,
`development/omega-commercial-mvp`; its full CI44550288881 and portability
CI44550288830 passed at that SHA. The containing preparation commit is the exact
new candidate source. Its app changes are limited to the authorized build version
and code, plus the consistent Settings display label; no dependencies change.

| Field | Verified historical artifact 14132499977 | Candidate target |
| --- | --- | --- |
| Package | `com.sweedycat.aimemory.githubtest` | same |
| versionName | `0.0.2` | `0.1.0` |
| versionCode | `1` | `2` |
| Certificate SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` | same, must be directly verified |

The visible version follows the owner's feature-update middle-position rule.
Code 2 is strictly higher than historical 1; unresolved equality/hotfix policy
wording is not used. This does not establish the currently installed version.
EAS Preview's separate package/code and production package/code remain intact.
Notebook remains false; no stored records, keys, biometrics or reminders are touched.

## Existing pipeline and single request

Use `.github/workflows/android-preview-apk.yml`, existing standard
`ubuntu-latest` GitHub-hosted runner, `APP_VARIANT=github-test`, clean Expo
prebuild and Gradle `assembleRelease`. No EAS build/account/credits or new
signing material. This repository's standard public GitHub-hosted runner usage
is free under [GitHub's billing documentation](https://docs.github.com/en/actions/concepts/billing-and-usage).
No larger runner, purchase, billing setting or storage-retention increase is introduced.

The connector has no workflow-dispatch tool and native browser control failed
with an expired continuation. A narrow trigger on the same existing pipeline
accepts only this exact development-branch push message, and only run attempt 1:

`build: prepare Android Preview APK 0.1.0 (2) [APK-20261119-REMOTE-ONE]`

Other development commits skip the build jobs. Existing experimental branch
triggers and explicit manual dispatch behavior remain. No automatic retry or
polling worker is created. Do not dispatch another build if this request starts.
The request/attempt guard is present on both verification and Android jobs, so a
specific-job rerun cannot reuse successful verification to bypass the limit.

The `verify` job runs npm ci, Expo Doctor, strict TypeScript and all unit tests
at the pushed source SHA before the dependent Android build may start. Checkout
uses GitHub's event commit, not a subsequently moving branch tip. After building,
SDK `apksigner verify` must pass, exactly one signer must match the historical
certificate, and SDK `aapt` must show the target package, code 2 and version 0.1.0.
SHA-256 is recorded before the unchanged seven-day APK artifact upload. No AAB.

An independent reviewer must inspect the frozen source/trigger/policy diff before
the uniquely marked commit is pushed. Local checks and review identity are added
to completion evidence after they actually finish. No build success is claimed
by this preparation record. Downloaded bytes must be rechecked against the
pipeline hash, manifest and historical certificate before delivery.

## Installed compatibility and acceptance

Installed-device compatibility is UNVERIFIED. Artifact integrity and matching the
historical development certificate do not prove the phone has that package or
code, nor establish safe installation or exclusive publisher authenticity.
Before a separately authorized installation, confirm actual installed identity,
recoverability and applicable version policy. Never uninstall or clear data on
conflict. Physical tests remain: retained people/life data/settings, keys and
App Lock, restart/reopen, follow-up edits/completion, reminder delivery and
permission denial/revocation. Use fabricated new test records. No physical
acceptance, Play publication, billing or production Notebook is authorized here.

## Recorded preparation evidence

Candidate source: `f6d01cceb746a56439a2bbdea8938d0343c62d7e` on the authorized
development branch. Local TypeScript passed; full unit regression had 446 tests,
444 passes, two existing Windows skips and zero failures. After the review fix,
all five focused version/trigger tests passed again. Expo Doctor passed 21/21
after an initial sandbox-network EACCES was retried with authorized access;
12 skill definitions and workflow YAML parsing passed. Whitespace checks passed.

Independent Reviewer `quota_review` authored none of the changes and reviewed
the frozen 14-file candidate against baseline `6e3c6ab436659aeeb52aa27838af9a67e4a1c0ed`.
Its raw-file manifest digest was
`4df8ff130705ce789dfb6c146e67dbc68378e74849675ce2881f9900f5dfe34e`.
The initial P2 specific-job-rerun gap was fixed by guarding both jobs and testing
both expressions; final independent focused tests were 5/5 with no remaining
actionable findings. Review does not approve installation or physical acceptance.

Single APK run [44555535088](https://github.com/Sweedycat/ai-memory-app/actions/runs/44555535088)
was requested by the candidate push. Exact-source full regression run44555535125
and portability run44555535148 were also observed queued. At this preparation
entry their completion and the resulting APK remained pending; results follow.

## Single-run outcome and safe stop

Full regression run44555535125 and portability run44555535148 both succeeded at
candidate SHA `f6d01cceb746a56439a2bbdea8938d0343c62d7e`. APK run44555535088
verification passed Doctor 21/21, strict TypeScript and 446 Linux tests:
445 passed, zero failed, one Windows-only DOS-short-alias test skipped.

Android job135671055328 completed Gradle `assembleRelease` successfully in 7m27s.
SDK apksigner verified APK v2 signing and exactly one signer whose certificate
SHA-256 matched the historical certificate. However this SDK prints
`V2 Signer: certificate SHA-256 digest:`; the added shell assertion expected
the older `Signer #1 certificate SHA-256 digest:` label. This format assumption
caused exit1 after successful cryptographic verification, before aapt/hash/upload.
The run failed and GitHub confirms zero artifacts. New binary manifest, downloaded
integrity and installability remain UNVERIFIED. There is no new APK download link.

The narrow correction accepts either exact known label, requires exactly one
matching complete fingerprint line and retains apksigner verification plus the
one-signer assertion. Synthetic checks cover both labels, wrong digest, duplicate
matches, prefixed diagnostics and trailing data. No certificate, signing key,
assertion strength or feature flag is changed. An ordinary correction push does
not satisfy the unique build request; neither job can auto-rebuild or rerun it.
No second build is initiated under the founder's single-build limit. Another free
build attempt needs a continuation instruction; installed identity still remains
a separate pre-installation gate. Physical acceptance is not claimed.

Independent Reviewer `quota_review` reviewed the four-file correction against
`f6d01cceb746a56439a2bbdea8938d0343c62d7e`; raw-file manifest digest was
`0ccedf3f0fb73b93b79c4f58360d5c3cfbbeb25d90b138f5ffacc49d7a1fd833`.
Independent focused tests passed 6/6 with no actionable findings. This evidence
entry and the founder's later stop instruction were appended after that review;
the reviewed workflow and test bytes are unchanged.

The founder subsequently answered **save the correction and stop**. Do not
start another APK build under this task, including after CI or quota reset.
Only save/synchronize this safe correction checkpoint and verify its CI.
