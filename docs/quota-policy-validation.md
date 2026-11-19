# Permanent founder quota policy replacement

2026-11-19. Baseline `043caa6a327e22c490b29535fe4ac84b82b6d28a` on
`development/omega-commercial-mvp`, initially clean. The founder explicitly
replaced earlier quota restrictions and resumed the bounded APK investigation.
The authoritative rule is [AGENTS.md Rule 10](../AGENTS.md#permanent-founder-quota-policy).

Both official weekly and short-window remaining allowance use the same tiers:
above 10% normal authorized work; above 5% through 10% small controlled work;
above 2% through 5% finish/validate; above 1% through 2% finalize safe checkpoints,
authorized GitHub synchronization, exact-SHA CI and handoff; at/below 1% stop.
The stricter known window applies; normal requires complete fresh evidence and
backend permission. Unknown reliable telemetry permits one bounded milestone
then a stop. Backend denial stops work; expired/reset estimates never grant
allowance. Prepare earlier if needed. No purchases, top-ups or automatic reset
resume. All task/security/privacy/financial/release gates remain unchanged.

## Changes and ownership

Principal owns AGENTS, shared skill contract/orchestrator instructions, Cloud
startup instructions and engineering handoff. DevOps Engineer owns the existing
read-only quota projection, its tests and quota-related Omega documentation.
No new orchestration infrastructure, service, account configuration, dependency,
mobile source, signing, version or production flag changes.

The helper removes obsolete weekly-reserve/checkpoint metadata in favor of
uniform tier thresholds and documented safeguard states. Current instructions
and historical operational quota wording now point to the replacement policy;
commercial fee percentages and synthetic business ratios are untouched.

## Independent review and checks

Independent Reviewer authored none of the change. The frozen 19-file raw-byte
manifest digest was verified before and after its review:

`a94444c37d81bcfe4c595b77d883c4a2dd1f223aa7f674dde911e53faf57067f`

Algorithm: SHA-256 of UTF-8 JSON.stringify of ordered `{file,sha256}` objects,
each hash using raw bytes. Order is the baseline's sorted `git diff --name-only`
for the 19 pre-existing changed paths: two orchestrator skill/contract files,
`.codex/cloud/START.md`, `AGENTS.md`, `docs/engineering-handoff.md`, the 12 changed
`docs/omega/*.md` files, `tests/omegaControlCenter.test.cjs`, and
`tools/omega-control-center.cjs`. This new evidence file is outside that digest
and receives Principal consistency review.

Independent result: no actionable findings; 22/22 focused synthetic/local CLI
tests passed, whitespace passed, no conflict markers or operative superseded
thresholds. Boundaries and adjacent values for both windows, mixed/unknown
windows, stale/expired readings, backend denial and privacy canaries are covered.

Principal/integration evidence on Windows Node 24.19.0:

- Strict TypeScript: passed before the full test command.
- Existing full `npm.cmd run test:unit`: 444 total, 442 passed, zero failures,
  two existing Windows platform skips (file symlink permission and POSIX FIFO).
- Existing local skill validator: all 12 skills passed syntax/reference checks.
- Source/diff/path/whitespace and policy consistency inspection: passed.

No independent live-quota control enforcement, device/native acceptance or
release approval is claimed. No APK was built by this quota update. The pending
APK compatibility investigation remains subject to installed identity/signing,
version, cost and data-preservation gates. The earlier agent turns hit a backend
limit and produced no independent verdict then; the founder later explicitly
resumed after a fresh official permitted reading. No paid credits were used.

The containing Git commit is the policy checkpoint identity. Resolve it and
verify its exact-SHA existing full-regression/portability CI on continuation;
baseline CI is not proof of this new checkpoint. No main/preview merge or tag.
