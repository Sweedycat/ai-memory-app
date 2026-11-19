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
