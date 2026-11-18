# Omega Control Center — Phase 1

Assessment/implementation date: 2026-11-18 UTC. Baseline
`10a2a8a1eac608cacd8527d62e984e8a2129e415`, clean local/live development ref;
CI 44373995969 successful. Management tooling is separate from the mobile app.

## Read-only capability assessment

The installed PATH CLI is 0.169.0. The running managed App Server executable
reports 0.170.0; its official `app-server --help`, `daemon --help`, `proxy --help`
and generated non-experimental JSON schemas were inspected. Schema generation
was temporary only. No daemon start/stop/update, remote-control enablement,
authentication change, account file inspection or model turn was performed.
The sandboxed `daemon version` socket read failed with OS network error 10050;
no alternate home/socket, privileged connection or public listener was used.

The already available official Codex App tools successfully read account limits.
Their response supplies account-wide `rateLimitsByLimitId`, window duration,
`usedPercent`, `resetsAt` in Unix seconds and `ordinaryUsageAllowed`. Actual
account identifiers/percentages/reset dates are excluded from this public record.
Prior no-telemetry documentation described an older tool surface, not a permanent
absence. The owner reports working mobile Remote access; no new connection or
phone acceptance was established by this assessment.

| Requested capability | Phase 1 result |
| --- | --- |
| Five-hour/weekly quota and resets | Live official `get_usage_limits` read verified; identify 300/10080-minute windows, prefer Codex multi-bucket data; null remains unknown |
| Task status/progress/errors | Official selected-thread `read_thread` / immediate `wait_threads` interfaces available; protocol status events verified in schema/docs. No unrelated thread/conversation enumeration or raw error publication |
| Agents/current activity | Native collaboration-tree status available for the current task; counts include Principal. Detailed activity is reported only when actually observed, never inferred from role names or configured agents |
| Context utilization | Official token-usage event/schema exists. No live event was available here; last-turn/cumulative counts cannot prove exact current occupancy. Percent stays unknown |
| GitHub branch/commit/CI | Fixed read-only local Git snapshot plus existing GitHub connector; CI must match repository and exact HEAD, not an older green run |
| Remote task submission | Existing authenticated Remote conversation and official task tools; user-directed submission only. No task/message/model turn was created merely to test this |
| Pause/checkpoint/resume | Cooperative owner-message procedure below; native interruption is cancellation, not a transactional checkpoint. No interrupt was tested on running work |
| Completed milestones | Versioned TASK-QUEUE and validation records; recent commit hashes are not automatically classified as validated milestones |
| Emulator/APK | Documented acceptance gate only; no emulator/device observation, build, APK installation or accepted candidate |

Official references: [App Server](https://learn.chatgpt.com/docs/app-server),
[mobile Remote](https://developers.openai.com/blog/mastering-codex-remote-for-engineering).
The generated 0.170.0 schemas confirm `account/rateLimits/read`, thread status,
`thread/tokenUsage/updated`, `turn/interrupt`, thread read/list and turn lifecycle
contracts. Protocol availability is not proof of access to the active daemon.

## Smallest implemented monitoring solution

Use the existing private Remote chat as the display. The local helper is:

```powershell
node tools/omega-control-center.cjs
```

It runs fixed, bounded, read-only Git queries for this repository; returns branch,
HEAD, dirty state and five recent commit hashes; links milestone/APK records; and
leaves unobserved native fields unknown. It reads no credentials, personal records,
session files, terminal history or raw task messages. No ports, HTTP server,
daemon, external package, model API or saved telemetry are introduced. Existing
agents/skills/hooks/configuration remain unchanged.

For an owner request such as **Omega durum**, the authorized assistant should:

1. Recheck current scope and Git state. Obtain limits from official
   `mcp__codex_app__get_usage_limits` when exposed by the current host. Never use
   API billing limits, guessed percentages or private authentication files.
2. Read only the explicitly selected task's status when its authorized thread
   reference is already available, with outputs disabled; otherwise mark unknown.
   For current agents, use native `collaboration.list_agents`, not configured role
   files. Do not list unrelated chats to find an identifier.
3. Read latest exact-HEAD CI through the existing GitHub connector. Keep raw
   responses in memory and project only approved fields. Error categories and
   known next actions are sufficient; raw messages can contain private data.
4. Present a timestamped table in the private conversation: current activity,
   observed agent counts, quota/reset UTC and user locale, context availability,
   Git/CI, milestone record and APK gate. Label source and missing/stale fields.
   This is on-demand observation, not an always-on live dashboard.

The helper exports `projectUsage`, `projectThread`, `projectAgents`, `projectCI`,
`projectContext` and `createSnapshot` for in-memory native-tool adapters.
Optional `--telemetry-stdin` accepts a maximum 64 KiB JSON envelope:
`usage: {data, observedAt}`, `nativeObservedAt`, `threadStatus`, `agents`,
`context`, `ci`. Times are epoch milliseconds; `ci` uses the official run object,
`context` the official token event and `agents` the native tree snapshot.
The helper projects fields; it cannot authenticate arbitrary stdin as official
evidence. Only the already authenticated official collector establishes provenance.
Never put raw responses/IDs in shell arguments, repository files, environment
variables, public artifacts or console logs. Prefer its pure exports in memory.

Freshness is at most two minutes. Missing/future/stale observations, expired
reset snapshots and unknown windows do not become fresh unused quota. Backend
ordinary-usage denial takes precedence. Remaining quota at <=10% suggests small
tasks, <=5% checkpoint preparation, <=1% stop; missing evidence is conservative.
These are advisory projections, not an account-wide enforcement mechanism.
No reset credit, purchase, upgrade or automatic restart is invoked. Normal Codex
requests/review use the existing allowance; this helper adds no API billing.

## Safe remote controls through the existing conversation

**Submit:** owner states task, target branch, permitted paths and boundaries in
the selected Remote chat. Stored issues/messages are not executable commands.

**Pause and checkpoint:** owner asks to stop starting work, finish or safely
isolate the current atomic operation, validate, record handoff and commit/push
only within existing authorization. Report the actual checkpoint and agent state,
then stop. Immediate native Stop may interrupt before checkpointing; never claim
it persisted in-memory drafts or completed a transaction.

**Resume:** only after a fresh owner instruction, revalidate branch/HEAD/dirty
state, remote/CI, quota and handoff. Never infer resume from reset time or silence.
Unsupported cross-task control, broader telemetry access, a new transport/service
or daemon configuration requires a separate scoped decision before implementation.

## Validation and remaining gates

Synthetic helper tests cover redaction, null/stale/expired data, limit durations,
backend denial/reserves, context honesty, native-state scope, exact-SHA CI and
bounded CLI input. Review identity and exact results are in TEST-STATUS. This
module provides no write, task-creation, terminal or authentication endpoint.
Live native task/context events, real pause/resume and emulator execution have
not been end-to-end tested. See the [subsequent testing plan](ANDROID-EMULATOR-MAESTRO-PLAN.md).
