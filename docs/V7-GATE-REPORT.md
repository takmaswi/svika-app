# V7 gate report: last kombi countdown

Status: PASSED (built and proven 2026-07-26). Two open questions for Mhofu at
the bottom, one of them about numbers only a corridor evening can settle.

Scope: docs/PRODUCTION-PUSH-PLAN.md batch V7, ruled 2026-07-16. Ticket history
shows when each route's service actually dies each evening; a percentile per
route and weekday yields "last Kuwadzana kombi usually gone by 8:40pm", and
the app warns riders on that route while they can still act, with a voice cue
from the cached library. Honest uncertainty language, never a promise. Not AI,
documented.

## What V7 delivered

- **Migration 0042, the observation layer only.** `public.service_day_ends`
  returns one row per observed day: the local minute the last fare cleared on
  that route and direction, the weekday, how many fares the day carried, and
  whether the observation is real or generated. Days below three fares are not
  observations at all, which is a quality rail (two fares is not evidence a
  service ended) and a privacy rail (an observation always describes a day
  several people rode, never one person's last trip home). The function is
  aggregates only, so it faces guests: a rider planning an evening trip
  without an account needs this warning most of all.
- **The rules live in code, not SQL.** `packages/shared/src/last-kombi.ts`
  holds the percentile, the fallback and the warning states with named
  constants. Median for the usual time; p90 minus p10 for the spread; a
  weekday with four or more evenings of its own answers for itself (Friday
  nights are not Tuesday nights) and otherwise the pooled week answers and
  says so; below six evenings there is no answer at all. This is deliberately
  not in the database: the rule riders read is the rule the tests exercise.
- **The warning appears only when it is useful.** Inside a 90 minute lead
  window before the usual last kombi, or after it has passed. A rider told at
  noon that the last kombi goes at 8:40pm learns nothing they can act on, and
  a screen that always warns is a screen nobody reads.
- **The copy never hardens.** "Usually gone by 5:00pm, about 36 min left"; past
  the time, "the last kombi has usually gone by now. Some nights it still
  runs." A wide spread (an hour or more between p10 and p90) prints its own
  line rather than being smoothed into a confident looking time. Both
  languages, both themes.
- **The card declares its own history.** "Counted from 13 evenings on this
  route. 11 of them are generated history, not real evenings yet."
- **Voice from cache.** `CachedPhrase` fetches `last-kombi.wav` once while the
  rider reads and plays from memory on every later tap, so a tap in a dead
  zone still speaks. It plays only when the rider taps listen: a warning that
  speaks unasked is a warning nobody keeps switched on. The recording is a
  placeholder from the same SAPI stand-in library as the ride cues, listed in
  the P5 recording table.
- **The primary action stays above the fold.** The plan sheet's peek grows
  when the warning is present, so a warning about missing the kombi can never
  push the pay row under the fold.

## The evenings problem, stated plainly

Most of the evenings do not exist. The corridor has run for days, not months,
so `packages/db/seed/service-days.mjs` generates a labelled synthetic evening
history in the same spirit as the watchdog's synthetic ticket history: every
row stamped synthetic, in a table no client can read or write, touching
neither tickets nor ticket_events nor the ledger. A real day always displaces a
generated one for the same date, the card prints how many generated evenings
it counted, the disclosure register carries the row, and the dataset statement
documents the method including which numbers are assumptions. Delete every
generated row and nothing breaks: the countdown simply goes quiet until real
evenings accumulate.

## Gate proof

| proof | result |
| --- | --- |
| unit: percentile on sparse and dense history | `packages/shared/test/last-kombi.test.ts`, 20 tests green. Sparse: five evenings refuse to answer, one evening is never an answer, a weekday with three of its own borrows the pooled week. Dense: twelve evenings answer for their own weekday, Friday nights outlast Tuesday nights, the spread reports how much the evenings actually move |
| unit: the warning rule | same file. Quiet at noon, warns inside the lead window with the minutes left, inclusive at both edges, still a warning at the usual minute itself, flips to past without hardening the claim, flags a wide spread |
| unit: the Harare clock | same file. UTC+2 arithmetic, including an evening UTC instant that rolls the Harare date into the next weekday |
| unit: voice cue plays from cache | `apps/web/test/voice-audio-cache.test.ts`, 3 new tests: three listens make one fetch, two racing loads make one fetch, a missing recording mutes the button instead of breaking the screen |
| e2e: the warning, both languages | `apps/web/e2e/v7-last-kombi.spec.ts`, 4 tests green. Inside the window with the time left and the basis line; the same warning in Shona; quiet hours before; and a route with no evening history at all saying nothing rather than borrowing another route's answer |
| RLS | `pnpm db:security-test` 224 passed, 0 failed, 0 skipped (was 218). LK-1 to LK-3 pin the guest readable aggregate and the three fare floor, LK-4 to LK-6 prove the generated table is invisible and unwritable to every client |
| unit suite | 457 tests green (226 web, 105 shared, 37 conductor, 89 spine) |
| typecheck, lint | clean |
| evidence | `docs/design-evidence/last-kombi/`, 8 shots: warn and past states at 360px in both themes and both languages |

The e2e and the evidence stage the DATA around the real clock rather than
faking the clock, which is the same trick the commute specs use for Takunda's
history: the server's wall clock stays real, so these runs exercise the real
Harare time arithmetic and the real percentile. Both carry a named skip for
the hour near midnight when a window cannot be staged at all, the same shape
as the existing CAT clock skip. Both hand the corridor back to the committed
generator afterwards (`pnpm db:service-days`).

## M4 slice landed with this batch

`ticket_events_redeemed_recent_idx` on `(created_at desc) where event_type =
'redeemed'` for the daily observation scan, alongside
`synthetic_service_days_route_idx` for the generated history.

## Adversarial pass

- **What a judge pokes:** "so it tells riders when the last kombi leaves?" No.
  It says when the last fare on that route has usually cleared, over evenings
  it names and counts, and it says how many of those evenings are generated.
  Nothing on the card is a timetable.
- **What breaks on stage:** if the demo runs at the wrong hour the card is
  simply absent, which is the designed behaviour, not a failure. Staging one
  route's evenings around the current clock (the script in the evidence
  section) puts it on screen at any hour.
- **What a hostile user does:** the generated table is unreadable and
  unwritable to every client (LK-4 to LK-6); the RPC returns nothing that
  identifies a rider, a conductor or a vehicle, and the three fare floor means
  no row can describe a single person's evening.
- **The honesty trap avoided:** the tempting version of this feature is a
  countdown clock. A countdown implies a schedule, and this network has none.
  Every string says "usually", the past state explicitly allows that some
  nights it still runs, and a wide spread admits itself.
- **What still bothers me:** the real observations on the demo corridor come
  from e2e runs at arbitrary hours, so they are noisy evidence of nothing.
  They are still counted, because filtering out inconvenient real data to make
  a demo look better is exactly the thing this project refuses to do. The
  generated evenings outnumber them, and the card says so.

## Open questions for Mhofu

1. **The assumed evening curve.** The generator assumes weekday service ends
   around 20:35 to 20:45, later on Friday and Saturday, earliest on Sunday.
   Those five numbers are guesses about Harare, not fieldwork. One evening on
   the corridor on the P3 data day settles them, and the dataset statement
   flags them as assumptions until it does.
2. **The 90 minute lead window.** How long before the last kombi does a rider
   actually need to know? Ninety minutes is an engineering default. If it is
   too long the warning becomes wallpaper; too short and it arrives after the
   rider has already committed. Worth your judgement, and cheap to change: one
   named constant.
