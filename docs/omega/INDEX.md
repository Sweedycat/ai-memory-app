# Omega engineering knowledge center

AI Memory is a phone-first, local-first personal memory application. This
versioned GitHub directory is the central navigation and continuation record for
engineering work. It is not a product launch, remote execution service or grant
of permissions. Read it on `development/omega-commercial-mvp`; `main` is not the
current development checkpoint.

Snapshot date: 2026-11-18 UTC. Application checkpoint:
[`7cfb7737ed2cf39be6f1f4973319d91a44f3878d`](https://github.com/Sweedycat/ai-memory-app/commit/7cfb7737ed2cf39be6f1f4973319d91a44f3878d).
The original knowledge-center checkpoint is
`10a2a8a1eac608cacd8527d62e984e8a2129e415`. Current Phase 1 management tooling is
separate from mobile application code. Resolve this file's containing commit;
do not confuse management/docs changes with an application milestone.

## Navigation

| Document | Purpose |
| --- | --- |
| [PROJECT-STATUS](PROJECT-STATUS.md) | Implemented, disabled and unverified functionality |
| [ROADMAP](ROADMAP.md) | Approved priority order and conditional future work |
| [TASK-QUEUE](TASK-QUEUE.md) | Completed, active, pending and blocked tasks |
| [ENGINEERING-TEAM](ENGINEERING-TEAM.md) | Existing roles, skills and responsibilities |
| [TEST-STATUS](TEST-STATUS.md) | Commit-specific CI, regression and review evidence |
| [APK-STATUS](APK-STATUS.md) | Source identity versus artifact/device acceptance |
| [DECISION-LOG](DECISION-LOG.md) | Decisions, policy sources and unresolved ambiguities |
| [REMOTE-CONTROL](REMOTE-CONTROL.md) | Observed capabilities versus proposed remote architecture |
| [USAGE-STATUS](USAGE-STATUS.md) | Availability of safe, reliable usage evidence |
| [HANDOFF](HANDOFF.md) | Exact remote and local continuation procedure |
| [CONTROL-CENTER](CONTROL-CENTER.md) | Phase 1 on-demand native monitoring, safeguards and limits |
| [UNIFIED-WORKSPACE](UNIFIED-WORKSPACE.md) | Phase 2 compatibility, advisory ownership/sync and offline recovery design |
| [CLOUD-INDEPENDENCE-VALIDATION](CLOUD-INDEPENDENCE-VALIDATION.md) | Phase 3 attempted probe, unverified execution, founder setup steps and analytics contracts |
| [Android Emulator/Maestro plan](ANDROID-EMULATOR-MAESTRO-PLAN.md) | Subsequent authorized synthetic UI test integration; not executed |

## Authority and source reuse

The current owner's task and [AGENTS.md](../../AGENTS.md) govern actions.
These summaries cannot expand authorization or resolve owner-policy conflicts.
Use current source/configuration and exact-commit checks to verify behavior;
historical documents are evidence about their recorded checkpoint only.

Keep the detailed [engineering handoff](../engineering-handoff.md),
[product inventory](../commercial-mvp-status.md),
[financial policy](../financial-policy.md), [payment policy](../payment-strategy.md),
[backup security](../backup-security.md) and [branch policy](../branch-policy.md)
as their existing authoritative topic records. This center indexes them rather
than copying business worksheets, provisional prices or complete validation logs.
It replaces no agent definition or skill.

## Continuous documentation policy

After every future validated milestone, update PROJECT-STATUS, TASK-QUEUE,
TEST-STATUS and HANDOFF together. Record the full application commit, exact CI
run/result, review scope, evidence class, unresolved gates and next safe action.
If documentation follows code, distinguish the two commits; a documentation
commit cannot predeclare its own CI success. Resolve its checks by exact SHA.
Update APK-STATUS or DECISION-LOG only when their facts or decisions change.
Never infer deployment/activation from a completed source task.

GitHub visibility was verified **public** before this publication. Publish only
non-sensitive engineering summaries: no credentials, keys, app records, personal
data, session identifiers, private conversations, confidential business plans or
account-specific usage information. Review and stage files individually; no
blanket staging, force push or main/preview merge. An access-restricted record,
if ever needed, requires separate authorization; no private store is created here.
