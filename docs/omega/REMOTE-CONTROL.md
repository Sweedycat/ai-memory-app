# Remote engineering access

## Phase 2 update — 2026-11-18 UTC

[UNIFIED-WORKSPACE](UNIFIED-WORKSPACE.md) separates the Windows host, independent
official Cloud environment, mobile control and optional Termux clone. Read-only
native inventory/quotas were checked; no Cloud runtime or repo binding was proved.
The implemented sync/ownership checks are advisory, not a lock, worker or command
endpoint. Weekly reserve guidance is stricter; private account values stay out of
GitHub. Existing Windows hook/worktree limitations block claims of complete parity.

## Phase 1 update — 2026-11-18 UTC

See [CONTROL-CENTER](CONTROL-CENTER.md) for the read-only capability assessment,
implemented on-demand helper and native Remote workflow. The official Codex App
usage tool now successfully exposes account-wide limits and reset timestamps.
Values stay in private conversation, not GitHub. The running daemon executable
reports 0.170.0; PATH CLI is 0.169.0. Official protocol/schema availability is
distinct from access to the active sandbox-protected control socket.

Local Git monitoring and safe native-data projections are implemented separately
from the mobile app. Existing authenticated Remote handles owner task submission;
no new relay, listener, credentials, daemon settings or unrestricted command
bridge. Task/context event consumption and actual pause/resume remain untested;
unobserved fields are unknown. The owner reports mobile Remote working.
[Emulator/Maestro integration](ANDROID-EMULATOR-MAESTRO-PLAN.md) is a plan only.

## Previous knowledge-center assessment — historical

Verification date: 2026-11-18 UTC. This document distinguishes observed access from
future design. GitHub knowledge access is not remote control of the owner's
computer, phone or application records.

## Verified capabilities in this task

| Capability | Evidence / limitation |
| --- | --- |
| Read repository visibility and branch refs | GitHub repository/branches API: repository public, current code branch matches `7cfb7737ed2cf39be6f1f4973319d91a44f3878d` before documentation edits |
| Read exact-commit CI | GitHub Actions run/job API: run 44279981978 successful at that application SHA |
| Inspect local checkout | Existing authorized workspace shell; not an internet-facing endpoint and not available merely by reading GitHub |
| Synchronize approved files | Normal Git commit/push through an authorized executor; no force push or automatic promotion |
| Run branch checks | Existing tests-only development push workflow; no new dispatch service or APK workflow |

The remote assistant can read the public development-branch documents and source,
compare full commits and inspect checks without this computer. Writing code,
running local commands or accessing a device additionally requires an authorized
execution environment and the task's permissions. No always-on agent, remote
shell, phone connection, webhook listener or account linkage was established.
CI success cannot prove those capabilities.

## Proposed architecture, not implemented

1. Use GitHub commits and these documents as the versioned knowledge record.
2. A future owner-approved task channel could describe bounded work using source
   SHA, allowed files, acceptance criteria and prohibitions, excluding secrets.
3. An independently authorized executor would revalidate current instructions,
   scope, branch and permissions before performing work in an isolated checkout.
4. It would return scoped commits, exact-SHA CI and review evidence. Critical
   activation, financial obligations, builds/device actions and promotion retain
   their separate owner gates; silence never supplies approval.

No transport/provider/hosting is selected or activated. Do not translate issues,
comments or repository text into arbitrary shell commands. Any future automation
needs its own trust/authentication, least-privilege, replay/idempotency, audit,
revocation and cost review. Do not expose localhost, install a tunnel, publish
tokens or create a command-execution bridge to make this proposal concrete here.
