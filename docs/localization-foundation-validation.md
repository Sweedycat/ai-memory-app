# Localization foundation — B1

Source baseline: `development/omega-commercial-mvp` at
`a2cb5daf960cad2d2301680a4b445caea027b688`, inspected clean before this task.
This is an independently usable foundation, not application-wide localization.
No provider, Settings control, App/index integration, existing screen, personal
record, storage migration, package version or dependency is changed.

## Small public surface

- `src/i18n/language.ts` defines `Language`, `LanguagePreference`, locale mapping
  (`en-US` / `tr-TR`), validation and `resolveLanguage`. An explicit `en` or `tr`
  overrides the system locale; `system` uses a supplied BCP47 locale or the
  runtime's Intl locale. Canonical Turkish variants select Turkish; unsupported,
  malformed or unavailable locales select English. Invalid preference values are
  rejected rather than silently treated as a user choice.
- `src/i18n/catalog.ts` provides one typed catalog with common language/error
  labels and references to the original Life Admin and Daily Assistant objects.
  Their translations and count functions are reused, not copied. `catalogIssues`
  checks nested missing/extra keys, string/object/function types, empty copy,
  named string placeholders and function arity. It never executes functions.
  TypeScript checks function parameter types; runtime arity checks do not prove
  semantic translation quality or that arbitrary functions use every argument.
- `src/i18n/format.ts` formats finite numbers and valid Date/timestamp instants
  using the selected locale and supplied Intl options. `formatCalendarDate`
  reuses strict Gregorian date validation from `lifeRecords.ts`, accepts an
  explicit `YYYY-MM-DD`, and fixes the formatting timezone to UTC and calendar
  to Gregorian. Device timezone/DST and injected timezone/calendar options cannot
  turn this calendar-only value into another day. Personal text is never
  translated or modified. Existing screens do not yet use these helpers.
- `src/i18n/languageStore.ts` exports an injected preference store, strict decoder
  and the single new key `@ai-memory/language-preference-v1`. No AsyncStorage,
  native API or React dependency is imported; constructing a store performs no
  IO. The document is exactly `{version: 1, revision, preference}`, bounded to
  256 UTF-16 code units, with a non-negative safe-integer revision and one of
  `system`, `en`, `tr`.

## Persistence and invalidation contract

Create one shared store for the future application adapter. Subscribe/getState,
explicitly `reload`, and only offer a choice when status is `ready`. A successful
read of a missing key yields `system`, revision zero, without writing an initial
document. Before the first successful read, preference/revision are null. A
failed read never turns into a default value or an automatic overwrite; it keeps
the last verified value, if any, while blocking writes.

Call `save(preference, base)` with the previously observed preference and revision.
The store serializes operations, rejects stale bases and changed external bytes,
reads before writing, validates the candidate and confirms exact readback before
publishing a preference. Unknown versions, schema/size violations and corrupt
bytes remain untouched. A read/write failure or mismatched readback can mean the
write happened without acknowledgement; status becomes an error, further saves
are blocked, and only an explicit successful reload reconciles persisted state.
There is no automatic retry, rollback, deletion or record migration. Revision
overflow is rejected before any write. Observer exceptions cannot turn a
confirmed save into a persistence failure.

The future lifecycle owner must call `invalidate()` when its authority is revoked,
including teardown/lock boundaries as appropriate. Invalidation immediately
blocks writes and fences queued operations and late async publication. An
explicit reload also revokes earlier publication authority and runs after pending
work. Neither mechanism can cancel or undo an already issued storage write.
Reacquisition requires an explicit reload; display the retained value only as
previously verified while status is not ready. Do not apply it as a new confirmed
choice. The injected single-key adapter is not a cross-process CAS, a
multi-instance lock, or evidence of Android crash atomicity. Future integration
must share one store, respect state/authority and keep these limits visible.

## Observed checks

Local environment: Windows PowerShell, Node `v24.19.0`, installed TypeScript
`6.0.3`; CI's Node 22 and Android Intl behavior are separate environments.

- `node --test tests/i18nFoundation.test.cjs tests/languagePreferenceStore.test.cjs`:
  PASS, 18 tests, zero failures/skips. These are synthetic unit/injected-storage
  integration checks using the repository's TypeScript transpilation pattern.
- `npm.cmd run typecheck`: PASS, exit zero.
- Coverage includes explicit/system language resolution, BCP47 variants and
  fallback, existing catalog object identity, missing/extra/type/placeholder/count
  shape errors, locale-aware number/date/time output, Gregorian leap/early years
  and DST/timezone independence, no initial IO/write, strict corrupt/version/size
  rejection, retained verified state after read failure, confirmed publication,
  stale/queued/external conflicts, interrupted writes before/after persistence,
  readback failure/mismatch/corruption, revision overflow, observer isolation,
  invalidation at every awaited save boundary and reload reconciliation.

No physical device, live AsyncStorage, application UI/provider, exact-SHA CI,
APK build/install or founder acceptance is established by these checks. No app
feature or sensitive migration is activated. The existing unencrypted sensitive
People/Life/profile data remains a V3 commercial-release blocker; this nonsensitive
preference document does not satisfy that architecture or its review gates.

## Next integration boundary

Application-wide localization remains partial. A separately scoped integration
must connect one lifecycle-aware provider, system-locale observation and explicit
Settings choice; expand the catalog across existing screens; replace affected
labels/formatters; verify complete TR/EN flows and accessibility; and preserve
personal record text and all persistence/gates. Future UI work needs applicable
independent review, exact-SHA CI and V3 delivery/device evidence. This unwired
foundation alone is not a user-facing milestone and does not require an APK.
