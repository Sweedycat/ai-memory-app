# Usage evidence availability

Availability rechecked **2026-11-18 UTC**, during Remote Control Phase 1.
This public document records capability, not private account measurements.
Phase 3 records the founder-observed shared-product dashboard scope and the
installed schema's optional conversation usage estimates in
[CLOUD-INDEPENDENCE-VALIDATION](CLOUD-INDEPENDENCE-VALIDATION.md). Live limit reads
remain distinct from token/credit estimates, feature analytics and Admin APIs.
No per-feature/conversation analytics or private account values were fetched or
published; no hidden endpoint, protected-socket workaround or new key was used.
Phase 2 reverified that official host-account reading; no Cloud/Android-specific
balance was observed or inferred. Official guidance allows shared plan allowance
with different consumption; identical environment quotas are never assumed.

The official Codex App `get_usage_limits` read succeeded. Its account-wide
five-hour/weekly windows, used percentages, reset Unix seconds and backend
ordinary-usage permission can be projected privately on demand. Actual values,
reset dates, account identifiers and raw responses are not committed. Null is
unknown, window length identifies the period, and the multi-bucket view takes
precedence. This is Codex allowance, not paid API billing telemetry.

Exact live context utilization is still unavailable here; token-usage schema
support does not constitute an observed live event. At the earlier 18:41:47 UTC
documentation checkpoint no quota tool was exposed; that was historical evidence,
not a permanent statement. See [CONTROL-CENTER](CONTROL-CENTER.md).

For future updates, publish a measurement only if its source is reliable, current,
explicit about scope/time/unit and safe for this public repository. Otherwise
record availability as unknown; do not estimate a percentage. Never inspect
credentials, switch accounts, buy credits or bypass a limit to obtain telemetry.

## Permanent quota policy

Effective 2026-11-19: the founder's replacement policy applies equally to weekly and short-window
(currently five-hour) remaining allowance. Use the most restrictive current
window; these percentages are remaining allowance, not consumption targets.

| Remaining in either window | Authorized work within the existing task scope |
| --- | --- |
| >10% | Normal work |
| <=10% and >5% | Small, controlled work |
| <=5% and >2% | Finish existing work and validate; start no new work |
| <=2% and >1% | Finalize the checkpoint, GitHub synchronization, CI evidence and handoff within existing authorization |
| <=1% | Mandatory stop |

Begin preparation earlier if validation, synchronization, CI or handoff needs
more headroom. These tiers supersede the older weekly preparation/reserve and
large-work thresholds. They grant no commit, push, remote-run, build, release,
paid-service or security authorization. Synchronization/CI that cannot finish
safely before stopping stays explicitly pending in the handoff.

When reliable official telemetry is unavailable, incomplete or stale, complete
at most one bounded milestone, validate/checkpoint within scope, then stop; never
chain milestones or invent percentages. A restrictive known window still
applies when the other is unknown. The helper marks reads older than two minutes
unknown, never assumes a reset restores allowance, and respects backend
ordinary-usage denial as a stop regardless of percentages. It remains an
on-demand read-only advisory projection, not account-wide enforcement or a worker.

Never allocate the same account balance separately to Windows, Cloud and Android.
No purchased credits/top-ups, account switch, limit bypass or automatic resume
after a reset. Resume requires a fresh owner instruction and revalidation.
Keep measurements private; this policy creates no public status feed or change
to financial, security or release boundaries.
