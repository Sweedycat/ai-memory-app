# Readable person history — 2026-11-18

Development baseline: `3ecc5faeef665ab8f4ab6485c1b820e51c9a79a5` on
`development/omega-commercial-mvp`, remote-verified at the preceding checkpoint;
its CI 44278544152 passed. This bounded milestone changes display/retrieval only.

## Implemented

Person detail searches original interaction summaries, sources/date labels and
completed follow-up text/dates locally with Unicode NFC normalization. Both
histories show five records initially and reveal all remaining records in steps
of five. Full text is selectable; controls have accessible names and 48-point
minimum height. New strings live in an English catalog; no unreviewed Turkish
translation or complete localization claim.

Known zoned timestamps sort newest first with stable equal-instant ties; unknown
dates retain saved order after dated records. Legacy relative labels are visible
as original labels, never interpreted as current dates. Completion dates are not
inferred from creation/reminder dates. Calendar-invalid dates, rollover times and
zone-less timestamps do not become factual dates. Cards/home recent memory select
the latest valid interaction across actual records, not the first array item;
undated-only memory is explicitly labelled undated.

No schema, migration, storage, key, notification, permission, dependency, version,
financial/payment policy or production flag changed. Existing people and original
date strings are never rewritten. Notebook/backup/paid providers remain disabled.

## Tests and limits

- Windows host Node 24.19.0 / npm 11.17.0: strict TypeScript PASS.
- Full application suite: **306/306 PASS**, zero failed/skipped/cancelled.
- Focused history/date suite: **13/13 PASS** (seven new history tests).
- New tests cover stable sorting/offsets, copy/source preservation, Unicode
  search, unavailable completion dates, invalid calendar/leap/time/zone values,
  latest memory across people, all-record reveal, search and honest empty states.
- Component tests execute the source with mocked React/native elements/hooks;
  host SQLite/crypto tests in the full suite are not native device evidence.
- Dependencies/config are unchanged; no redundant local Doctor/audit run.
  Exact-SHA CI runs fresh install, Expo Doctor, TypeScript and application tests.
  Three previously documented moderate advisories remain unresolved.
- No physical Android/iOS, TalkBack/font scaling/keyboard, signing, update,
  notification delivery or Notebook native durability/key tests performed.
  No APK build/install or production activation. See the Android acceptance plan.

## Frozen independent review

Principal is the only writer. Reused Independent Reviewer has read-only scope
over seven files, no nested delegation and no new security-sensitive activation.
Ordered raw-byte SHA-256 manifest digest:
`aa14b5efb33d9788d7feffe8eaab7c65f5ad87d95e6a5b68a05f215b0239a2a7`.
Order: App.tsx; src/components/PersonHistory.tsx;
src/strings/personHistory.en.ts; src/utils/interactionDates.ts;
src/utils/personHistory.ts; tests/interactionDates.test.cjs;
tests/personHistory.test.cjs. Hash SHA-256 of JSON.stringify of ordered
`{file, sha256}` entries, with each sha256 computed from raw file bytes.
Independent outcome: **no actionable findings**. Reviewer verified this digest
before/after, independently passed all 13 focused tests, strict TypeScript and
whitespace checks, and authored no changes. Physical layout/TalkBack/locale
rendering remains unverified. Prior Notebook critical review remains separate;
its false production gate is preserved. Documentation is outside the frozen
implementation digest and receives Principal consistency review.

## Continuation

Commit/push normally to the dedicated branch; verify exact-SHA CI and remote
equality. Resolve the containing checkpoint using
`git log -1 --format=%H -- docs/person-history-validation.md` and preserve newer
work. Quota telemetry is unavailable: stop conservatively after this validated
checkpoint, without asserting a percentage or automatic restart. Next bounded
work is structured life administration, after its persistence/data-safety design.
New external financial cost and obligations: **zero**.
