# AI Memory Preview 0.0.2 — phone-only, in-place upgrade checklist

This document is a safety gate, **not** a completed or approved installation.
The owner has valuable on-device person records and notes; never uninstall the
existing AI Memory Preview or clear its app data.

## Already verified from the `preview` source
- `app.json` and `package.json`: display version `0.0.2`.
- Expo EAS project ID: `16c767fa-215f-497e-a7eb-55ff9435b428`.
- `app.config.js` maps the `preview` build profile to application ID
  `com.sweedycat.aimemory.preview` and name `AI Memory Preview`.
- `eas.json` preview profile: `distribution=internal`,
  `android.buildType=apk`, `android.image=latest`,
  `APP_VARIANT=preview`.
- Automated Expo Doctor, TypeScript and unit checks have passed on preview.
- The current source does **not** specify an explicit Android `versionCode`
  nor an explicit `cli.appVersionSource`/preview `autoIncrement` setting.
  The installed app's `versionCode` is not yet verified.
- GitHub tests do not produce an APK and cannot validate EAS signing keys.

## Before requesting/building an upgrade
1. On the owner's phone, sign into the **existing** Expo account at
   https://expo.dev/ and open the AI Memory project > Builds.
2. Inspect the previous Android **Preview** build that is actually installed.
   Record its exact **application ID, versionCode, EAS project, build profile,
   and Android signing-key identity** (fingerprint if available).
3. Verify the current Expo project is the original project and uses the **same
   stored Android signing credentials** as the installed Preview package.
   Do not regenerate/replace signing credentials.
4. Ensure the new APK will use the same application ID and certificate and an
   Android `versionCode` not lower than the installed one. Prefer a strictly
   higher `versionCode` for updates. The visible `0.0.2` version string
   does not replace `versionCode`.
5. Confirm Expo GitHub App linkage to `Sweedycat/ai-memory-app`. If linked,
   from the project's Builds screen choose **Build from GitHub**:
   git ref `preview`, platform **Android**, build profile **preview**.
   Verify the selected source commit is the current approved `preview` HEAD.
   If GitHub is not linked, stop: do not authorize unknown third-party apps or
   make a new Expo project as a workaround.
6. Build can use the existing Expo account. **Do not purchase extra build
   credits or new paid services** without owner approval.
7. Do not install immediately. Verify the resulting artifact is `.apk`,
   package identity, signing identity, `versionCode`, and absence of accidental
   app-variant switches.

## In-place Android tests after approvals
- Open existing Preview first and confirm `Test Kişi 01`, original notes,
  interactions, notifications and follow-up history are present.
- Update **over the existing installed app** (never uninstall); if Android
  says the package conflicts or cannot be installed, **stop** — do not clear
  app data.
- Launch with App Lock and biometric authentication; confirm all prior
  records remain.
- With a **fabricated** number only, test adding a person, editing the phone
  number, searching by it, navigating away/back, killing/reopening the app,
  and device restart if needed.
- Verify saving a number does **not** write to the phone's Contacts application
  or request Contacts permission. Verify reminders are still scheduled.
- Only after successful real-device results and owner sign-off consider
  promotion to `main`.

## Scope
The backup/Drive, deal documents and face enrollment prototypes are not
released or promoted to `main`. Local app-managed at-rest encryption was
declined for the current MVP; **cloud/off-device backup encryption is still
required**.
