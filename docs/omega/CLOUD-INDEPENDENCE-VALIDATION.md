# Cloud independence validation — Phase 3

Assessment date: 2026-11-18 UTC. Required baseline verified clean locally and at
the live development ref: `69b2eace67d2a0c5cb4876eaf4d3a44fa72b6a20`.
[Exact-SHA CI 44383019205](https://github.com/Sweedycat/ai-memory-app/actions/runs/44383019205)
was rechecked successful. **Cloud independence is NOT VERIFIED.**

## Actual execution evidence and uncertainty

Official usage and saved-environment reads succeeded. Runnable default entries
contained no repository bindings. A single official `create_thread` request
targeted a returned runnable default configuration, with the title
**AI Memory Cloud independence validation** and the fixed repository/SHA above.
No configuration identifier, account value or session reference is published.

The request did not return a task identifier or acknowledgment while awaited.
The waiting orchestration cell was terminated; that is NOT proof that a remote
operation was cancelled. A subsequent bounded recent-task lookup returned no
exact-title match. This limited listing does NOT prove that creation never
occurred. Creation/execution remains unconfirmed; no second request was sent.
The founder must inspect the official UI before resubmission or setup to prevent
duplicate tasks. No Cloud checkout, runtime, installation, test result, handoff
or powered-off-laptop execution was observed.

The `finalize_environment` tool explicitly describes a **simulated** environment
and prototype catalog. It was not called. Simulated readiness, inventory entries,
local Linux CI and documentation cannot establish actual Cloud independence.

## Repository/policy compatibility disposition

The [Phase 2 matrix](UNIFIED-WORKSPACE.md) remains in force. Repository AGENTS and
skills are documented portable inputs, not proof of discovery in a live Cloud
task. Exact custom-role dispatch, native policy and two-specialist cap need actual
runtime verification. Existing command hooks use fixed Windows launch paths and
a `.git` directory assumption. They were neither changed nor disabled. Native
Cloud orchestration is not equivalent to local command hooks; no portable
replacement is activated without supported-interface evidence and independent
security review. No protected socket, credential file or private endpoint was used.

## Founder interaction: exact next steps

These are manual setup/authorization instructions, not actions already completed.

1. In official Codex/ChatGPT, inspect recent Cloud tasks for the validation title
   above. If it exists, inspect its actual environment and status; continue that
   task only after resolving pending input. Do not create a duplicate. If it
   doesn't exist, proceed to a single deliberate creation.
2. On web/desktop select **Work in > Cloud**. An existing default environment may
   clone an accessible repository; a new reusable environment is optional, not a
   prerequisite. For reusable setup use **Select environment > Create environment**
   or **Settings > Codex Cloud > Environments > Create environment**.
3. Select only `Sweedycat/ai-memory-app`; connect the correct GitHub account only
   if the official UI prompts. Review the requested repository access. Keep the
   environment **Only me**, with no service secrets, new provider/API key, credits,
   automatic top-up or subscription purchase. Stop if included-use eligibility or
   access is uncertain; never use the simulated finalizer as a substitute.
4. Before **Get started**, explicitly approve any dependency/tool installation
   and review proposed commands/network access. Target Node 22 and the locked
   dependency tree. Public GitHub/npm access may be needed; approve only justified
   destinations, not unrestricted services. No signing/Google/production secrets
   are needed. Additional runtime installation requires its own decision.
5. Use the bounded task below, exact source SHA and a new isolated task-owned
   checkout. Verify actual AGENTS/skill discovery and native policy first. If
   hook/policy equivalence needs configuration changes or trust decisions, stop;
   never turn protections off to obtain a green test result.
6. Only after installation/runtime/policy approval run the repository checks.
   Review setup output and files before **Publish** if creating a reusable setup;
   then **Start a new task**. Verify that the actual executor is Cloud, not the
   connected Windows host or a prototype environment.

Official procedure: [Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments.md).
Saved state does not replace Git checkpoints. Phone software/device operations
remain outside this task; retain the [Android plan](ANDROID-EMULATOR-MAESTRO-PLAN.md).

## Prepared isolated validation task

Run only in an actual official hosted Cloud workspace; no Windows/SSH/socket
fallback and no simulated execution. Clone public
`https://github.com/Sweedycat/ai-memory-app.git` into a NEW task-owned directory,
checkout `69b2eace67d2a0c5cb4876eaf4d3a44fa72b6a20`, and verify full HEAD.
Do not reset or overwrite an existing checkout.

Read AGENTS.md and relevant policies. Report actual policy/skill/custom-agent/hook
discovery separately from file presence. No source edits, commits, pushes, PRs,
subagents, daemon/listener, credential reads, signing, APK/device operations or
paid API/service activation. The first submitted probe permitted only a fresh
clone/read-only inspection and tests with already installed dependencies; it did
not authorize package installation. New installation remains founder-gated.

After explicit setup authorization, use the existing scripts:

```text
node --version
npm --version
npm ci
npm run typecheck
npm run test:unit
npm run doctor
```

`npm ci` installs packages and may run dependency lifecycle scripts;
`doctor` invokes `npx expo-doctor@latest` and may fetch a tool. Neither is a
read-only inspection. Stop on missing runtime, denied access, failed check or
required policy decision. Synthetic tests only; no real records or raw logs.
Report command exits, exact counts and omissions without sensitive content.
Preserve weekly 15% checkpoint preparation and 10% emergency reserve; no automatic
restart or duplicate creation after a timeout/reset.

For a genuine Windows–Cloud handoff, return the exact Cloud checkout SHA, actual
backing/runtime evidence, policy results, commands/results, unchanged source
status and unresolved gates. The Windows coordinator compares that SHA to GitHub
and records only safe evidence in the engineering handoff. An unconfirmed task
or prepared prompt is not a demonstrated handoff. A laptop-off observation still
requires founder participation; no workstation power operation occurred here.

## Usage analytics: supported interfaces versus observed data

The founder reports the official dashboard sharing plan limits across Codex,
Work, Workspace Agents and ChatGPT for Excel, excluding ordinary ChatGPT chats,
and showing feature/conversation analytics. This is owner-observed UI evidence;
we did not scrape that dashboard or independently read its account data.

| Interface | Verified scope / limitation |
| --- | --- |
| Native `get_usage_limits` | Live account limit windows and resets were read; no feature/conversation breakdown in that tool's contract |
| Official `account/usage/read` | Documented account token summary/daily buckets. Existing installed 0.170 non-experimental generated schema additionally accepts optional `threadId` and returns nullable `threadUsage` estimates when a billing route is available |
| Installed thread-usage schema | Credit/USD estimates and groups by model, speed/reasoning, token counters. These are not actual plan-percent balances, a feature taxonomy or a promise that every conversation is queryable; null is unknown |
| Personal feature dashboard | No stable matching feature-breakdown interface was located in the inspected native tools/schema. Availability of UI analytics does not authorize private endpoint access |
| Official Analytics API | Workspace aggregate reporting exists, with enabled-endpoint/admin authorization requirements. It is not automatically available from a personal dashboard or a substitute for per-conversation data |

Schema support is not a successful live read. This host exposes the limit tool,
not a direct account-usage RPC tool. The protected socket was not bypassed or
reconfigured; no analytics values were obtained through it. No Admin key,
Compliance API access, plan upgrade, screen scraping or unofficial endpoint was
requested. Credits/USD estimates must not be presented as money spent by this
project or converted into quota percentages.

Sources: [App Server protocol](https://learn.chatgpt.com/docs/app-server.md),
[Analytics API](https://learn.chatgpt.com/docs/enterprise/analytics-api.md),
[reporting scopes](https://learn.chatgpt.com/docs/enterprise/workspace-analytics.md).
No account identifiers, conversation IDs, private metrics or raw responses are
part of this public assessment. Existing Android conflict-safe planning remains
advisory and inactive; the mobile app, agents, skills, hooks and policies are intact.
