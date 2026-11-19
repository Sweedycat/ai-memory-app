# Historical GitHub Test APK identity — 2026-11-19

The founder authorizes read-only compatibility investigation and one free APK
build only after all applicable identity, signing, version and financial gates
pass. The founder is operating remotely from Android without USB access.
No installed-phone identity has yet been observed. Do not infer it from this
historical artifact or use an installer attempt as a compatibility test.

## Artifact and actual binary facts

- Repository: `Sweedycat/ai-memory-app`.
- Successful historical run: [43643898173](https://github.com/Sweedycat/ai-memory-app/actions/runs/43643898173).
- Source: `594004718471c4269bf3d75943e9a033fcf6f1c1`, `feature/contact-export`.
- Artifact: `14132499977`, `ai-memory-isolated-standalone-apk`.
- ZIP: 32,378,418 bytes; SHA-256
  `30a0429c921dbdbfee457c79dd78ea325e8c45b28006f38c6e9bbe4cb6299cef`.
  The downloaded archive hash matches current GitHub artifact metadata.
- APK: `app-release.apk`, 71,133,270 bytes; SHA-256
  `af5691a66c7d212e38c75dea0aa3abf0b202df23baeffb8fdcfabe2cd1fb4fd4`.
- Actual binary manifest package: `com.sweedycat.aimemory.githubtest`.
- Actual binary versionName: `0.0.2`; **versionCode: `1`**.
- Actual signer certificate SHA-256:
  `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.

The earlier founder-supplied versionCode 2 was an unverified historical reference;
it does not match this APK. The EAS Preview package
`com.sweedycat.aimemory.preview` is a different variant. Preserve the actually
installed package once established; never switch variants to make an update work.

The verified ZIP/APK remain in the local temporary inspection directory
`%TEMP%/ai-memory-apk-inspection-abf483fd79d7456ea859f37b88050259/`.
Do not redownload while these bytes remain available and their hashes match.
They are historical app binaries, not backups of the founder's records.

## Verification method and signing reproduction

Android Engineer used read-only, in-memory Node 24.19.0 parsing of ZIP, binary
AndroidManifest and the public APK v2 signing block. Verification included RSA
PKCS1-v1.5/SHA-256 algorithm 0x0103 signature over complete signed data, matching
certificate/SPKI, matching ordered digest/signature algorithm IDs and the full
chunked protected-content digest. Altered signed-data and protected-content
negative controls were rejected. Layout references were the official
[AOSP v2 format](https://source.android.com/docs/security/features/apksigning/v2)
and [AOSP v2 signer implementation](https://android.googlesource.com/platform/tools/apksig/+/master/src/main/java/com/android/apksig/internal/apk/v2/V2SchemeSigner.java).

Inspector source is retained in the agent/tool-call transcript, SHA-256
`e6460bbde5a6f4bee05fe13801ec3043e13bd38efd2d68fbce4a1d664dfe70fb`.
This is a bounded custom host inspection, not an Android `apksigner` result or
OS/device acceptance. No APK code was run. The initial proposed temp-script
write was hook-rejected; no file was created and that mutation was not retried
through another tool. The accepted operation evaluated readable Node source
entirely in memory without filesystem writes.

The certificate exactly matches the public development certificate bundled in
the current Expo 57.0.33 template. Only public certificate data was inspected;
encrypted private-key sections were skipped without decryption, extraction or
logging. No owner's signing credentials were accessed or changed.

The existing `.github/workflows/android-preview-apk.yml` uses `APP_VARIANT=github-test`,
clean Expo prebuild and `assembleRelease`, without an EAS signing step. The
template release configuration uses its bundled debug signing configuration.
These source/certificate observations support reproducing the historical signing
identity through that existing GitHub Test pipeline. Every future APK still
requires direct package/version/certificate verification. This shared development
certificate is not evidence of exclusive publisher authenticity or a production
release-signing setup.

Identity-related app configuration, package manifests and workflow were unchanged
between the inspection baseline `043caa6a327e22c490b29535fe4ac84b82b6d28a` and
quota-policy checkpoint `ed0cdb668ee8bf39937cb2787be304867884e9e8`.

## Remaining gates and phone-only observation

Required missing device evidence: installed package, versionName/versionCode and
signer certificate SHA-256. The artifact cannot supply that evidence on behalf
of the installed application. Installation, retained records/settings/keys,
biometrics, notifications, restart and failure recovery remain untested.
No new build has been dispatched; no new key, signing credential, package,
version, application data or production flag has been changed. Notebook stays off.

Prefer an already trusted local package inspector. If the founder chooses App
Manager, its [official manual](https://muntashir.dev/AppManager/en/#subsec:signatures)
documents App Info and Signatures including certificate checksums. Use No-root
mode and leave Use the Internet disabled; select only the installed AI Memory
package and read its package/versionCode/certificate SHA-256. No root, ADB,
backup, upload, scanning, signing, installer or data-clearing action is needed.
Share only those metadata values. Do not request personal records or keys.

After device evidence is obtained, choose a strictly higher versionCode rather
than relying on the unresolved equality wording, prepare the visible feature
version under the existing owner cadence, revalidate the exact source SHA,
confirm zero-cost runner/artifact capacity, and then dispatch at most the one
authorized GitHub Test APK build. Do not use EAS Preview as a package substitute.
No main/preview merge, paid operation, Play publication or automatic reset resume.
