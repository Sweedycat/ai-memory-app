# People follow-up and briefing reliability

2026-11-19. Authorized development branch `development/omega-commercial-mvp`.
Baseline clean/local/live-matching
`ac29d59ff324db8bc91cf750f4e5935d1aec15f2`; its exact-SHA full CI
[44501857119](https://github.com/Sweedycat/ai-memory-app/actions/runs/44501857119)
and portability
[44501857103](https://github.com/Sweedycat/ai-memory-app/actions/runs/44501857103)
both passed. That published checkpoint includes the local grounded assistant.
No factory, Cloud configuration, dependencies, builds or paid services changed.

## Reproduced defects and acceptance

Software Engineer executed actual App handlers in an in-memory React/native
mock harness using only fabricated records. Holding the original notification
cancellation allowed two UI sequences:

1. Mark complete → Edit → revise/save follow-up → release completion. The edited
   follow-up disappeared; history recorded the old text and the new scheduled
   alarm remained orphaned (zero open, one completed, one scheduled).
2. Mark complete → Edit → release completion → save the stale form. The
   completed follow-up was recreated and scheduled (one open, one completed,
   one scheduled, same follow-up text).

Serialization of people storage bytes does not serialize these native/UI
operations. The repair must reject overlapping mutation entry points before any
native await, preserve the original edit target/base, and compare full follow-up
revisions before applying completion. Same-ID checks alone are insufficient.
Stale saves must retain the form, and scheduling denial must preserve the old
record/reminder. Existing unchanged-reminder reuse and schedule-first semantics
must remain. Final implementation evidence is recorded below after freeze.

Implemented App coordination uses a synchronous shared operation ref before
native awaits plus visible busy/disabled mutation controls. Edit captures its
full original person; stale save keeps the draft. Completion compares all
original follow-up fields, and delete confirmation rechecks its original full
record. App-local acknowledgment observes React's committed in-memory result
before an obsolete alarm is cancelled. Functional updaters remain pure under
replay. An unused newly scheduled alarm is cancelled best-effort on conflict or
unmount; late operations cannot mutate/navigate an unmounted view or replace a
later selected person's input. This acknowledgment does not claim disk success.

Software Engineer's final focused run passed 26/26: 12 new actual-App/real-hook
cases plus existing reminder decisions and people persistence cases. The new
cases include both reproduced orderings, same-tick double completion/delete,
updater replay, notification navigation, stale full-base/revision conflicts,
scheduling denial, existing-alarm reuse, failed disk-save retry without repeated
native actions, unmount and stale deletion confirmation. Strict TypeScript passed.
Principal's Expo Doctor passed 21/21. All inputs/adapters are fabricated/mocked;
no actual notification or owner storage was accessed.

## Final automated evidence and independent review

Final existing `npm.cmd run test:unit` exited 0: **443 tests, 441 passed,
0 failed, 2 skipped**, on Windows Node 24.19.0/npm 11.17.0. The unchanged
platform skips are synthetic file-symlink creation and FIFO availability;
Linux/Node 22 CI is separate. The default command/concurrency/timeouts and all
assertions are preserved. Final strict TypeScript passed; Expo Doctor 21/21.
The earlier assistant checkpoint's transient TLS/Cloud child timeout and their
successful retries remain in its validation report; no failures are hidden.

Independent Reviewer implemented none of this change. It verified six-file
digest `149cf28964edd5eeddb4fd0e16618de485c71fdae71c4478424e0eed05c060f1`
at start/end, independently ran **27/27** focused tests, checked whitespace and
conflict markers, and reported **no actionable findings** in the bounded diff.
The review covered guard/base conflicts, pure updater replay, React acknowledgment,
native replacement ordering, target/navigation/unmount handling, briefing/date
grounding and stated limitations. It does not approve release or establish
physical/native behavior.

Digest is SHA-256 of UTF-8 JSON.stringify of ordered `{file,sha256}` objects,
each file hash using raw bytes, in this order:

1. `App.tsx`
2. `src/utils/buildMemoryBriefing.ts`
3. `src/utils/dailyBriefing.ts`
4. `tests/buildMemoryBriefing.test.cjs`
5. `tests/dailyBriefing.test.cjs`
6. `tests/personFollowUpConcurrency.test.cjs`

Principal inspected the complete resulting source/test changes and the three
status/handoff/validation documents; those documents are outside the digest so
final evidence can be recorded. Only assigned product/test/document paths change.
No implementation review findings remain, but the native/device/release limits
below are still open.

Principal also reproduced four briefing failures with new regression cases:
array order selected an older interaction; legacy relative dates were called the
last conversation; future entries became past contact; an embedded completed
follow-up was described as the next step. All four failed before correction.

The briefing now selects the latest valid dated interaction at/before now,
includes its actual local formatted timestamp, labels undated source text
without claiming chronology, and warns that undated/future entries need review.
Completed follow-ups are excluded from next-step prose. No date, conversation,
promise or new memory is generated. Existing notes/context remain readable.
Briefing copy remains English alongside the existing person UI; this change
does not claim full localization. Seven briefing tests and related date/history
regressions passed in a focused 20/20 run after the correction.

The existing home daily overview had the same midnight-DST normalization pattern
found in the new assistant's review. Principal reproduced it with a failing
Cairo test, then derived its tomorrow and horizon independently. Its established
window remains today plus the next seven complete local dates; the assistant's
separate seven-calendar-date question explicitly includes today plus six.
Both retain their documented semantics and no reminder is rescheduled. All
eight daily-overview cases pass after correction, including both extra-hour
boundaries. Principal owns this disjoint utility/test adjustment too.

## Ownership and safety limits

Software Engineer owns only App mutation coordination and its actual-handler
regression test. Principal owns briefing utility/tests and reports. Independent
Reviewer authors neither implementation and reviews the frozen diff read-only.
No overlapping writers or recursive delegation. Existing gates/settings, people
schema/key, pending-save notice/retry, life records, Notebook, dependency and
signing/version configuration remain unchanged.

These repairs do not make notifications and AsyncStorage one atomic transaction.
Storage save failures still use the existing visible process-memory pending-save
and explicit retry behavior; process death can lose unpersisted edits. Native
notification cancellation/scheduling can fail, and mocked successful cancellation
does not prove physical delivery, native alarm cleanup or Android durability.
Do not claim general notification reconciliation, durable migration/restore or
complete people-data transactionality from this bounded UI-race correction.

No real owner data, secrets, external AI, transfers, new services/costs, billing,
APK/AAB, signing, device install, production flags or main/preview changes.
Physical Galaxy S26 Ultra restart/lock/notification/permission/retained-update
acceptance remains unperformed and separately gated. Existing Notebook/backup
security and native gates remain outstanding.
