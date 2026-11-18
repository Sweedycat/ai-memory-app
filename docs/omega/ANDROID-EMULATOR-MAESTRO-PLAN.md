# Subsequent Android Emulator and Maestro integration plan

## Phase 2 preparation

[Synthetic UI inputs](../../qa/omega-lab/synthetic-ui-inputs.json) are committed
only as future typing fixtures. `executionEnabled=false`; they are not a backup,
import file, Maestro flow or proof of passing UI tests. Use only a newly authorized
isolated synthetic laboratory and explicit test variant. No guessed selectors,
clear-state action, phone Contacts, production package or real records are used.
Windows is the proposed primary Android lab. Cloud test execution and Termux are
not assumed to provide an emulator, signing identity or native App Lock evidence.
All installation/build/device approval gates below still apply.

Prepared 2026-11-18 UTC; **plan only, not performed**. No download, installation,
AVD creation/start, ADB connection, APK build/install or production flag change.
The PATH-only lookup resolved no `adb`, `emulator` or `maestro` command here;
that does not establish absence from the machine. Tool/runtime/SDK identity,
licenses, disk/memory and virtualization remain to be verified in a later task.

## Entry and execution gates

1. Obtain task-specific owner authorization for tool installation if needed,
   isolated synthetic emulator, exact source/build variant and any APK install.
   Verify licenses/commercial use, existing free local tooling and no paid Cloud
   execution. Preserve original EAS/signing configuration and existing phone app.
2. Inspect current official installed Android tooling before choosing commands.
   Use Android Studio's supported virtual-device manager or the matching official
   CLI; the current Android documentation now also describes `android emulator`.
   Do not assume the older `emulator` command remains the preferred interface.
3. Use a dedicated synthetic AVD and explicitly selected emulator serial. Never
   target an arbitrary connected device. Preserve existing AVDs/data; no generic
   wipe/uninstall/reset. Keep ADB/local emulator access private; no external ADB,
   tunnels, public ports or WSL network bridge.
4. Maestro's current official guide supports native Windows and requires Java
   17+. Prefer this supported local path if compatible; do not create the guide's
   optional WSL/network exposure. Verify exact versions/licenses before setup.
   Select only local CLI tests; no Maestro Cloud/account/purchase is needed here.
5. Verify approved artifact digest, package, variant, version and signing before
   any authorized installation. An isolated test package does not prove the
   owner's Preview in-place update. Notebook stays false until a separately
   reviewed isolated test harness/activation is authorized.

## Bounded first UI milestone

After the gates pass, add versioned local-only flows in a separate management/test
directory. Begin with launch/onboarding and readable synthetic person history:
create a fabricated person, add interactions/follow-up, complete, search, reveal
older history, reopen and verify persistence. Add stable accessibility selectors
only in a later explicitly scoped source change, preserving existing behavior.

Then cover reminder permission denial/rescheduling, app background/foreground,
save-error disclosure and safe retry. Notebook CRUD/draft/recovery follows only
in the approved synthetic harness: stale decisions, interrupted save, reopen,
unknown key/ciphertext and no data resurrection. Never disable App Lock or
replace biometric authentication to make a test pass. Use the existing
[Notebook acceptance scenarios](../android-notebook-acceptance-plan.md).

Record source SHA, matching CI, tool/OS/API/AVD/build identities, scenario results,
observed failures and sanitized diagnostics. Do not capture the real phone or
upload screenshots, app records, keys or raw logs automatically. Any synthetic
artifact publication needs explicit review. Keep emulator and physical evidence
separate: real biometrics, OEM notification timing, hardware durability and
retained-data Preview upgrade still require owner-participated physical checks.

Recommended first checkpoint: local synthetic launch/person-history smoke flow,
verified selectors and reproducible evidence, with no paid CI executor or mobile
app management interface. This task implements none of those future flows.

Official references, checked 2026-11-18:
[Android emulator commands](https://developer.android.com/studio/run/emulator-commandline),
[Maestro installation](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli.md).
