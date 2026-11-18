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

When telemetry is absent/stale, use conservative checkpoints with validation
reserve. The helper marks reads older than two minutes unknown, never assumes a
reset restores allowance, and respects backend ordinary-usage denial. At <=10%
five-hour remaining avoid large work, <=5% prepare checkpoint, <=1% stop.
Phase 2 additionally starts weekly checkpoint preparation at 15% and stops
ordinary development at/below the 10% weekly emergency reserve. Never allocate
the same account balance separately to Windows, Cloud and Android. These are
advisory signals, not enforced account-wide controls. No reset consumption, purchase,
account switch, automatic restart or polling worker. Future decisions belong to
the authorized session; no invented public status feed.
