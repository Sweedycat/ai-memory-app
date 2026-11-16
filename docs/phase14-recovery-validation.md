# Phase 14 recovery and integration evidence

Date: 2026-11-17. Scope: application blocker repair and a separate, unpromoted
engineering integration candidate. No APK, prebuild, signing, installation,
main/preview merge, paid service, real-data access or production restore.
Phase 13 passed at cead9b3fbd18c48a571b77e87e6fc97894478d6f; its agent, Skill,
Hook and routing tests were not repeated. Historical Phase 13/14 evidence stays
in that immutable Omega checkpoint and does not describe this repair's results.

## Source and ownership

- Initial root: clean engineering/ai-memory-omega, cead9b3fbd18c48a571b77e87e6fc97894478d6f.
- GitHub-verified Notebook baseline: f457812cead8bcc46467751c0baebaefe6ce8476.
- New repair branch: repair/omega-phase14-notebook, rooted at that exact Notebook.
- During repair/candidate assembly, the primary Omega checkout remained unchanged;
  final checkout identity is recorded in the completion report. Task worktrees live under
  .omega-worktrees/; a local Git exclude keeps them out of the root status.
  The first temporary-directory edit was blocked by the Hook's path boundary;
  the task tree was moved inside the supported workspace, without changing Hooks,
  trust, sandbox, system security, or global Git safe-directory settings.
- Software Engineer alone wrote notebookSession.ts and its two owned test files.
  Principal Architect owns dependency, Settings, workflow, documentation and Git
  integration changes. DevOps Engineer supplied read-only overlap/trigger analysis;
  an independent reviewer supplied separate read-only safety review. No recursive
  delegation, conflicting writers or more than two concurrent specialists.

## Repairs

1. notebookSession.ts binds the indexed note to a local value and narrows it before
   comparing revision fields. No non-null assertion, cast, any, strictness change,
   new storage backend or production wiring. Existing-note update, persistence
   publication timing, invalid revisions, original bytes and unrelated notes have
   synthetic regression coverage.
2. standardPhone.test.cjs runs all seven privacy/source assertions under both LF
   and CRLF. Only the expected line boundary accepts optional CR; Contacts and
   local-encryption disclosures remain asserted.
3. Settings' stale 0.1.0 label now matches existing app version 0.0.2. This is a
   label correction, not a display-version/versionCode assignment. app.json,
   package version, application IDs, signing and owner version ambiguities remain.
4. Missing expo-crypto and expo-intent-launcher were installed from the verified
   lock in the isolated repair environment with npm ci. Doctor then required the
   official Expo 57.0.33 patch. npx expo install expo@~57.0.33 --npm preserved SDK
   57, React Native 0.86.3 and all other root dependency ranges. Doctor exposed a
   duplicate native expo-constants; npm dedupe consolidated it to 57.0.24 after
   verifying every consumer's existing range accepts that version. Transitive
   patch/minor updates and the complete lock diff were reviewed. No overrides,
   legacy-peer-deps, forced major update or dependency-check exclusion.
5. Existing Notebook verification workflow now also covers the two exact repair
   and integration refs and runs Doctor. It remains Ubuntu/Node 22, contents:read,
   20-minute timeout, DNS check, npm ci, Doctor, TypeScript and units. Android/EAS
   build workflows are unchanged; these branch pushes can trigger tests only.

## Final local repair evidence

Windows Node 24.19.0 / npm 11.17.0; CI's Node 22 is a distinct environment.
Final deduped lock was tested by a fresh npm ci (484 installed packages).

| Check | Actual result |
| --- | --- |
| npm run typecheck | PASS; strict and noUncheckedIndexedAccess remain true |
| All application units | PASS 206/206, zero skipped |
| Six Notebook files | PASS 25/25 |
| Backup/restore/generation/data-preservation group | PASS 139/139 |
| npm run doctor | PASS 21/21, no skipped checks |
| npm ls --all --offline | PASS, no dependency-tree problems |
| Git whitespace | PASS |
| Final npm audit | exit 1, 3 moderate, 0 high/critical; investigated below |

Units use fabricated data and mocked/in-memory adapters; they establish neither
native crypto/storage durability nor Android lifecycle/upgrade safety. Earlier
Doctor failures (20/21: old Expo patch, then duplicate expo-constants) were repaired,
not excluded. An inventory read during installation observed a transient tree;
only the final fresh-install result above is used. A cross-worktree Git ownership
guard was not bypassed or resolved through a global trust setting.

## Dependency security assessment

Initial audit: fingerprint, glob and minimatch, involving two advisories.
The compatible fingerprint 0.20.15 -> 0.20.16 patch removes the vulnerable glob
13 subtree. The other existing glob route stays in a patched 14.x release.
Final inventory still has THREE moderate affected package entries: expo,
@expo/fingerprint and minimatch, all tracing to ONE remaining advisory:
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
Thus the affected-package count did not become zero despite removing one cause.

minimatch 10.2.6 is inside fingerprint's ^10.2.6 range; the advisory's patched
11.0.1 is outside that major. Registry metadata supplied no compatible fixed 10.x
release. npm's proposed breaking Expo 52 downgrade was not used. No audit fix
--force command or forced transitive override was executed.

The independent source trace found fingerprint's matchers use the default
optimizationLevel 1; the documented amplification path requires >=2. No affected
path was identified through inspected fingerprint options or app imports. This
is bounded build-tool exposure analysis, not proof that the package is secure or
that the advisory is resolved. Reassess upstream releases and any caller/config
changes before release; keep the residual moderate inventory visible.

Primary references: [glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4),
[Expo installation procedure](https://docs.expo.dev/more/expo-cli/#install),
[npm dedupe](https://docs.npmjs.com/cli/v11/commands/npm-dedupe/).

## Eight overlaps and selected application lineage

Compared exact f457812 (Notebook) and cead9b3 (Omega), relative to their common
ancestor 22e9d42dba6919251068121e9ded3974c3d0492d. Complete old application merging
is unnecessary: candidate application source must descend from repaired Notebook.

| Path | Reconciliation |
| --- | --- |
| App.tsx | Keep Notebook contact actions/export consent, completed-follow-up search, keyed screens and newer cards; do not replace with Omega's older layout. |
| docs/backup-security.md | Identical Git blob; preserve. Historical status drift is not activation permission. |
| src/components/BackupSafetyDiagnostics.tsx | Keep Notebook preferences, synthetic key practice and sanitized stage reporting; actual backup stays disabled. |
| src/components/SettingsPanel.tsx | Only overlap difference was stale label; repaired to existing 0.0.2. |
| src/utils/backupNativeSelfTest.ts | Keep Notebook sanitized stage failures and native UTF-8 diagnostic. |
| src/utils/driveBackupTransport.ts | Identical blob; preserve. |
| tests/backupNativeSelfTestGate.test.cjs | Keep Notebook's narrow nonsecret preferences-write allowance and subsequent side-effect prohibitions. |
| tests/driveBackupTransport.test.cjs | Identical blob; preserve. |

Integration strategy: branch from the validated repair commit, then apply ONLY
engineering commits 9cd5612, 1a1c1fb, 33c735f, c92c1e4 and cead9b3 in order.
Their complete path sets are limited to .codex, .agents, AGENTS.md and the handoff.
Exclude older preview application commits d1a7dff and a438003. Verify infrastructure
tree equality against cead9b3 and application tree equality against repair; never
overwrite newer application files with older copies. Stop on any actual conflict.

## APK provenance and remaining device gate

GitHub run [43643898173](https://github.com/Sweedycat/ai-memory-app/actions/runs/43643898173)
and artifact metadata 14132499977 identify the latest available named-checkpoint
APK source exactly: 594004718471c4269bf3d75943e9a033fcf6f1c1, feature/contact-export,
successful run, artifact ai-memory-isolated-standalone-apk. Its workflow asserts
the isolated com.sweedycat.aimemory.githubtest package, not Preview. No binary,
signing credential or real app data was downloaded. The commit has no GitHub
comments supplying a physical-device attestation.

The device-tested branch label and successful build do NOT prove installation
or physical acceptance. Existing Preview screenshot documentation points to
35f5238/0.1.0(1), a different historical build. The exact last physically tested or
currently installed APK source/certificate/versionCode remains UNVERIFIED from
available records. No Samsung access, APK build, install, deletion or data clearing.

Before any later authorized APK/update, obtain actual installed identity and
artifact binding, preserve recoverable records, verify signing/version policy,
then test in-place retention, restart, App Lock, permission denial/revocation,
reminders and follow-ups. Backup/Notebook production storage, key lifecycle,
durable rollback and large-file/native failure gates remain separate and disabled.

## Review and checkpoints

The frozen seven-file implementation manifest (ordered {file,sha256} entries for
workflow, lock, package, Settings, session and the two tests) is
fdc792f3e0f1a7e2313f5f896fe65255ece1a969329124aaa5beb0c5e7518b24.
Documentation is outside that implementation hash. A separate native
independent_reviewer inspected the complete frozen seven-file diff and verified
that exact digest. No blocking correctness/privacy/data-loss finding. It checked
890 dependency resolution edges with zero missing/incompatible ranges and ran
32 focused tests independently before final dedupe. Final full suites, Doctor and
audit above are Principal-run evidence, not reviewer-rerun or device evidence.
Its review preserves the residual moderate advisory and all activation gates.
Repair commit/push, actual integration and resulting CI evidence belong to the
subsequent checkpoint update; this document does not pre-claim them.

## Actual recovery checkpoints

Repair commit 099084964819b1f57df81852675c17ce1b930df3 was normally pushed only to
repair/omega-phase14-notebook with runtime approval; GitHub ref equality verified.
[Repair CI 43956904182](https://github.com/Sweedycat/ai-memory-app/actions/runs/43956904182)
completed SUCCESS on that exact SHA (Ubuntu/Node 22), independently of local checks.
Notebook's original branch still points to f457812; no work was replaced there.

The separate integration/omega-notebook-phase14 branch starts at 0990849 and
applied all five engineering commits without conflicts:

| Original engineering commit | Replayed candidate commit |
| --- | --- |
| 9cd5612 | 514f604dcab0db3478a5c19802e17dbc51e6fcbf |
| 1a1c1fb | be7fabe43793531212abee934fcda0d83bb79317 |
| 33c735f | 892ad7474992dd62ec489eb539c0ed4fcbf28fc7 |
| c92c1e4 | d4a2032fa526d018e039a99617245b1e41018af3 |
| cead9b3 | dbc636cfad701ddfd7eb37659d71bc38da16645a |

At dbc636c, Git tree comparison proves all 38 .codex/.agents/AGENTS files and the historical
handoff match cead9b3 exactly; all app source/tests/manifests/workflows match
0990849 exactly. The handoff is then intentionally updated for current evidence.
This is engineering-only replay, not a claim that the original Omega commit is
an ancestor of the candidate. The complete repaired Notebook ancestry is retained.

Candidate-specific local checks at dbc636cfad701ddfd7eb37659d71bc38da16645a:
fresh npm ci PASS (484 packages), strict TypeScript PASS, full units 206/206,
Doctor 21/21. These are actual candidate runs, not inferred from repair CI.
Focused Notebook 25/25 and backup 139/139 are repair runs on the identical app tree.
Candidate assembly and local validation PASS. Device/native/release readiness
is not established; the moderate advisory remains unresolved.

Repair CI job 133613726380 confirms successful DNS, npm ci, Doctor, TypeScript and
unit steps. Its tests-only workflow also matches the integration ref. Final
candidate review and approved normal push must preserve the same app/infra trees;
only this evidence file and the current handoff may differ. Final remote SHA and
matching CI run are recorded in the owner's completion report. On resume, resolve
integration/omega-notebook-phase14 and require a successful run at that exact SHA,
rather than assuming freshness from this static document. No APK is authorized.
