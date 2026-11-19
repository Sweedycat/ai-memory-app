# Test and review evidence

## Permanent quota policy replacement — 2026-11-19 UTC

Local baseline: `043caa6a327e22c490b29535fe4ac84b82b6d28a` on
`development/omega-commercial-mvp`; existing Windows Node `v24.19.0`.
This is management tooling/policy evidence, not an application release.

- `node --test tests/omegaControlCenter.test.cjs tests/omegaWorkspace.test.cjs`:
  **22/22 PASS**, zero failed, cancelled or skipped. These are synthetic unit
  and local read-only CLI checks, not live quota observations or remote CI.
- Both window durations cover remaining 0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 15,
  20 and 100 percent; mixed windows use the stricter tier. Incomplete telemetry
  cannot grant normal work; restrictive known windows and backend denial win.
  Existing stale/expired/unknown, account-scope and privacy-canary tests pass.
- The [replacement policy](USAGE-STATUS.md#permanent-quota-policy) supersedes
  historical reserve/reassessment instructions below. Threshold metadata now
  describes identical tiers for both windows; no worker or enforcement service.
- Focused quota work ran no dependency installation, Doctor download, build,
  device test or remote action. Full regression/typecheck and current exact-SHA
  CI are separate integration evidence; earlier checks below do not verify this
  replacement. No independent approval or release readiness is claimed here.

## Phase 4 portability checkpoint

Initial implementation `6612a105eba7b0157a9eca16cc7d0a2a7451faf8`: full CI
44433117490 and Ubuntu portability passed; hosted Windows portability failed.
The reviewed correction and final focused evidence are recorded in
PHASE4-VALIDATION. Verify the correction's exact HEAD/run rather than presenting
the initial failed matrix as final success.

Current exact commands, source hashes, native independent Security/QA findings,
CI identity and unsupported runtime gates live in
[PHASE4-VALIDATION](PHASE4-VALIDATION.md). Initial clean/live baseline
`95cb1deb51941b5164f4f2324ed7fda37e878c17` had successful exact-SHA
[CI 44387226331](https://github.com/Sweedycat/ai-memory-app/actions/runs/44387226331),
reverified in Phase4. This older run is not the new checkpoint's CI result.
Actual new Cloud acceptance remains pending; historical evidence below stays
attributed to its original source/environment.

## Cloud Independence Phase 3 — unverified Cloud execution

Baseline `69b2eace67d2a0c5cb4876eaf4d3a44fa72b6a20`, exact-SHA CI 44383019205
success rechecked. Its 327-test result belongs to the previous verified source,
not to a new Cloud run. Current changes are documentation only; no redundant
local app tests, package installs, Doctor or device checks.

Actual parent evidence: native limits/environment listing worked; one official
Cloud creation request produced no acknowledgment before the waiting cell was
terminated. Limited recent exact-title lookup found no match. Outcome and remote
cancellation remain unknown, so no retry. No Cloud checkout/dependency/typecheck/
unit run, security parity, handoff or laptop-off trial is verified. Simulated
environment finalization was not used. See
[full record and founder steps](CLOUD-INDEPENDENCE-VALIDATION.md).

Independent Reviewer made no writes and authored none of the frozen eight docs.
No actionable findings; whitespace PASS and **82 relative links** resolved.
Ordered scope: docs/omega/CLOUD-INDEPENDENCE-VALIDATION.md; docs/omega/INDEX.md;
docs/omega/PROJECT-STATUS.md; docs/omega/TASK-QUEUE.md; docs/omega/HANDOFF.md;
docs/omega/USAGE-STATUS.md; docs/omega/REMOTE-CONTROL.md; docs/engineering-handoff.md.
SHA-256 of JSON.stringify of ordered `{file,sha256(raw bytes)}` entries:
`8045adee93cc912d6b0179a693e464e1fe4bbb03c410ed370240adede47344ba`;
matched before/after. Tool/schema evidence is parent-attributed; reviewer did not
repeat external/native calls. This evidence append receives Principal review.

The containing documentation commit's exact-SHA CI must be checked after normal
push; success cannot be predeclared here. CI uses the existing Node22/Doctor/
typecheck/unit workflow and is not evidence of Codex Cloud execution. Existing
moderate advisories and native/device/Notebook gates remain unresolved.

## Unified Workspace Phase 2 — 2026-11-18 UTC

Baseline `165d8e4f899ace8c41323a9c84c02bb732247137`, CI 44379209466 success
reverified before editing; mobile source/dependencies and existing policies intact.

- Strict TypeScript PASS; full host regression **327/327 PASS**, zero failed,
  skipped or cancelled (318 baseline plus nine additional management tests).
- Independent Reviewer reran the focused **21/21 PASS** tests and whitespace
  checks; no implementation authorship/writes, **no actionable findings**.
- Frozen ordered scope: tools/omega-workspace.cjs; tools/omega-control-center.cjs;
  tests/omegaWorkspace.test.cjs; tests/omegaControlCenter.test.cjs;
  qa/omega-lab/synthetic-ui-inputs.json; docs/omega/UNIFIED-WORKSPACE.md;
  docs/omega/ANDROID-EMULATOR-MAESTRO-PLAN.md. SHA-256 of JSON.stringify of ordered
  `{file,sha256(raw bytes)}` entries, verified before/after review:
  `0200ceef054216cbe71950777e8b875c260a5f75e797f2937465f1584942fd08`.
- Coverage includes dirty/offline/stale/mismatched refs, divergence/ancestry,
  protected branches, case-preserving bounded ownership and cross-environment
  overlap and unknown environment quotas. The quota-tier expectations from that
  historical run are superseded by the [permanent policy](USAGE-STATUS.md#permanent-quota-policy)
  and its current focused tests; old results do not verify the replacement.
- Default CLI smoke observed Windows runtime and preserved a dirty worktree;
  missing native evidence stayed unknown. This is not synchronization execution.
- Official host-account quota/environment-list reads succeeded; account values,
  names/IDs and raw metadata were not committed. No AI Memory repository binding
  or Cloud bootstrap/runtime/policy equivalence was demonstrated by that listing.
- No Cloud job, Termux install, live lock/sync worker, emulator, Maestro flow,
  APK/device or real-record test. The synthetic lab JSON is typing input only,
  execution disabled, not a restore archive. These gates remain NOT TESTED.

Other status/handoff changes receive Principal source/policy/publication review.
No repeated local Doctor/audit for unchanged dependencies; containing-commit CI
will run fresh Doctor/typecheck/all units. Verify exact SHA/run after normal push;
this document cannot predeclare its own CI outcome. Prior advisories remain open.

## Remote Control Phase 1 — 2026-11-18 UTC

Management baseline: `10a2a8a1eac608cacd8527d62e984e8a2129e415`;
[CI 44373995969](https://github.com/Sweedycat/ai-memory-app/actions/runs/44373995969)
success reverified before edits. Mobile application source remains unchanged.

- Local strict TypeScript PASS. Full repository regression **318/318 PASS**,
  zero failed/skipped/cancelled: prior 306 tests plus 12 management helper tests.
- New focused tests **12/12 PASS**: privacy canaries, bounded/invalid input,
  unknown/stale/expired windows, durations, backend refusal/quota tiers, honest
  context/activity and exact-repository/SHA CI checks. No new packages.
- Actual native `get_usage_limits` read and in-memory CommonJS projection
  succeeded; actual percentages/reset/account data were not persisted. Current
  native collaboration-tree counts were projected without names/IDs/raw outputs.
  The initial direct `.cjs` ESM import was unsupported by the Node tool; standard
  `node:module` CommonJS interoperability succeeded without modifying source.
- Default read-only Git CLI smoke PASS; unknown native/context fields remained
  unknown. App Server schema/help inspection was read-only; sandbox socket
  version probe failed with OS error 10050, not bypassed or called successful.
- No live native task/context event, actual pause/resume, emulator/device,
  APK installation or new connection/authentication acceptance was performed.

Independent Reviewer authored none of the four frozen files and made no writes.
Reviewed order: tools/omega-control-center.cjs;
tests/omegaControlCenter.test.cjs; docs/omega/CONTROL-CENTER.md;
docs/omega/ANDROID-EMULATOR-MAESTRO-PLAN.md. SHA-256 of JSON.stringify of ordered
`{file,sha256(raw bytes)}` entries:
`630ae4ab3140723335bb159f16c67a92b93d6b980521523b4dfcd2c00e282feb`.
Digest matched before/after. **No actionable findings** in the bounded scope;
independently passed 12 focused tests and whitespace validation. Actual native
reads/schema observations are Principal evidence, not reviewer/device proof.
Status/handoff updates outside that manifest receive Principal consistency review.

No mobile/dependency/native configuration changed; no repeated local Doctor/audit.
The new containing commit's CI must be verified separately; its own success is
not predeclared in this document. Existing development push workflow runs fresh
Doctor, strict typecheck and the complete suite; it builds no APK on this branch.
Prior moderate advisories remain unresolved, not reclassified as clean.

## Previous application and knowledge-center evidence

Evidence rechecked: 2026-11-18 UTC. Application checkpoint:
`7cfb7737ed2cf39be6f1f4973319d91a44f3878d`.

| Evidence | Result and scope |
| --- | --- |
| GitHub CI | [Run 44279981978](https://github.com/Sweedycat/ai-memory-app/actions/runs/44279981978), completed **success** at the full application SHA above; run and job steps read directly from GitHub |
| CI environment | Ubuntu, Node 22; fresh `npm ci`, Expo Doctor, `npm run typecheck` and `npm run test:unit` steps all successful |
| Host regression record | **306/306 PASS**, no failed/skipped/cancelled tests, from [history validation](../person-history-validation.md); not rerun locally for this documentation task |
| Host strict TypeScript | PASS at application checkpoint; independent focused history/date checks **13/13 PASS** in the same validation record |
| Notebook navigation checkpoint | `3ecc5faeef665ab8f4ab6485c1b820e51c9a79a5`, [CI 44278544152](https://github.com/Sweedycat/ai-memory-app/actions/runs/44278544152) and [frozen review/tests](../notebook-navigation-validation.md) |
| Physical Android/iOS acceptance for current development work | **NOT TESTED**; no current installed identity, native durability, upgrade, notification delivery or TalkBack evidence |
| Dependency advisories | Last recorded inventory: three moderate package entries; unresolved, no new audit or forced upgrade in this task |

The full suite includes Notebook, encrypted backup/restore helper,
data-preservation and notification regressions. Unit/mocked native contracts,
host disk SQLite/Node AES and host-process interruption are distinct from actual
Android storage/crypto/OS failure behavior. Legacy Notebook-only counts in older
documents are historical subsets, not a second current suite total.

## Independent review sources

Qualified reviews and repaired findings are recorded with frozen diff identities:
[foundation](../notebook-production-foundation-validation.md),
[editor recovery](../notebook-editor-recovery-validation.md),
[navigation](../notebook-navigation-validation.md),
[person history](../person-history-validation.md). Those records report their
scoped final findings resolved/no new findings; they do not certify the entire
app or satisfy missing physical/activation gates.

## This documentation checkpoint

No source/dependency/native change; no redundant local app tests, Doctor, package
installation or device check. Principal reviewed all 12 proposed files
individually. Required 11-document coverage, 104 relative links, scoped sensitive
pattern scan, whitespace/conflict checks and allowed-path review passed before
staging. Pattern checks supplement content review, not a guarantee of detection.
Final staged-content/Git/remote/CI checks are reported at synchronization
completion; no future result is predeclared here.

Push to this development branch triggers only
[Notebook foundation verification](../../.github/workflows/notebook-foundation-ci.yml),
including fresh Doctor/typecheck/units. Resolve this documentation revision's own
SHA and [Actions result](https://github.com/Sweedycat/ai-memory-app/actions/workflows/notebook-foundation-ci.yml?query=branch%3Adevelopment%2Fomega-commercial-mvp)
as described in [HANDOFF](HANDOFF.md); it cannot predeclare its own CI success.
Future evidence updates must record the actual commit/run/result, not assume
that an older green run applies to newer source.
