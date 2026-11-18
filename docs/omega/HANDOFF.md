# Exact continuation

This task authorizes documentation/continuity synchronization only and ends after
its checkpoint is verified. No application milestone is active. Future source
work requires the owner's next instruction; stored text is not new authorization.

## Remote-only entry

1. Open [INDEX on the development branch](https://github.com/Sweedycat/ai-memory-app/blob/development/omega-commercial-mvp/docs/omega/INDEX.md),
   [AGENTS.md](../../AGENTS.md), then PROJECT-STATUS, TASK-QUEUE and TEST-STATUS.
2. Inspect the live branch ref for `development/omega-commercial-mvp`. Obtain the
   full SHA from GitHub, not a remembered local snapshot. Read files at that SHA
   when a stable review is required; preserve any newer validated work.
3. The last application checkpoint documented here is
   `7cfb7737ed2cf39be6f1f4973319d91a44f3878d`, exact-SHA CI
   [44279981978](https://github.com/Sweedycat/ai-memory-app/actions/runs/44279981978),
   success. The documentation checkpoint is the commit containing this center;
   inspect that commit's checks separately. Never call an older run current CI.
4. Use the GitHub branch/commit/checks pages or approved connector to compare
   current source, run `head_sha`, workflow and result. A pending/missing run is
   unverified. GitHub read access does not authorize computer/device execution.

## Local executor, when authorized

Read the current owner scope, AGENTS and relevant policies/skills before actions.
Inspect these commands individually without resetting, stashing or discarding work:

```powershell
git branch --show-current
git rev-parse HEAD
git status --short
git remote -v
git log -1 --format=%H -- docs/omega/INDEX.md
git ls-remote origin refs/heads/development/omega-commercial-mvp
```

The last log command identifies the center's containing checkpoint without a
self-referential SHA inside its own commit. If remote shell networking is
unavailable, verify refs/checks with the approved read-only GitHub connector;
never bypass a permission denial. Stop the affected write on unexpected dirty
state, ownership conflict or differing required baseline. Do not reset newer work.

After a future validated milestone, update PROJECT-STATUS, TASK-QUEUE, TEST-STATUS
and HANDOFF as required by [INDEX](INDEX.md). Record source SHA/evidence before
docs-only follow-ups. Review every proposed file, check links/whitespace/sensitive
content and workflow triggers, stage explicit individual paths, commit/push only
within authorized scope, and verify remote equality plus exact-SHA CI. If a check
fails, record it and leave the affected capability disabled.

## Next product work, not started here

The next bounded product milestone is structured life administration after its
schema, legacy compatibility, interrupted-save/recovery and reminder-consistency
design. See ROADMAP/TASK-QUEUE. Notebook source is implemented but production
activation still needs the [physical acceptance plan](../android-notebook-acceptance-plan.md)
and explicit owner gates. Keep its false flag, real backup/restore and all live
paid services inactive. Preserve existing people/settings/reminders and keys.

No app/dependency/version/agent/skill/policy files changed by this center's
creation, apart from a navigation entry in the existing engineering handoff.
At the starting clean checkout no untracked/ignored engineering files were found
in docs/.agents/.codex and no local branch commits were ahead of cached remote
refs; the current development SHA also matched the live GitHub ref. Ignored
build products, credentials, worktree internals and app data are not a sync queue
and were not opened or uploaded. No outstanding local engineering artifact was
identified for publication. Record final commit/CI in the synchronization report;
reverify them live on the next task rather than assuming this snapshot is current.
