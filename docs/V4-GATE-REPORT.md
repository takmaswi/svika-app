# V4 gate report: live fare board

Status: PASSED (built and proven 2026-07-26). One defect found on the way and
left alone deliberately; one open question at the bottom.

Scope: docs/PRODUCTION-PUSH-PLAN.md batch V4, ruled 2026-07-16 and ruled to be
built LAST. Every digital ticket is a verified fare observation. A simple
aggregate query per route and hour renders "what riders actually paid today" on
the plan screen, with rain and peak jumps visible as history, not editorial.
Not AI, and the docs say so.

## What V4 delivered

- **Migration 0045: the dumbest possible query.** `fares_paid_today` returns
  how many tickets were bought at each fare in each local hour today, for one
  route and direction. That is the whole database side. It carries no rider,
  ticket, conductor or vehicle, and the hour bucket is as fine as time ever
  gets, so it faces guests like the other board surfaces.
- **Every rule is in testable code.** `packages/shared/src/fare-board.ts`
  turns those buckets into the fare most riders paid, the low and high of what
  was actually paid, whether the day varied at all, the busiest hour, and one
  entry per hour that carried a fare.
- **The one judgement call, stated in the file and pinned by a test.** When
  the evidence is split evenly between two fares, the typical fare ties to the
  LOWER number. A board that leaned upward would quietly talk the going rate
  up, and this feature exists to report the street, not to move it.
- **An empty day says nothing.** A route nobody has paid for today gets no
  board at all rather than a row of zeroes.
- **The surface reports and never judges.** No "good deal", no comparison with
  another route, no guess at the next hour. The card's own line: "Counted from
  digital tickets on this route. Not a prediction and not a recommendation."
  Peak jumps are visible because they are in the history, not because anything
  labels them a peak.
- **Where it lives.** In the plan sheet body, below the legs and the save
  form, not in the peek. The peek's job is the fare, the time and one primary
  action; a rider who wants the day's history opens the sheet for it.

## Gate proof

| proof | result |
| --- | --- |
| unit: the aggregate | `packages/shared/test/fare-board.test.ts`, 9 tests green. Empty day, zero-ticket buckets, one fare all day, the real range, a peak hour that reads as an hour rather than a verdict, the tie leaning low, hours in order, the busiest hour counting every fare in it, and a single ticket still being an honest board |
| e2e: plan screen | `apps/web/e2e/v4-fare-board.spec.ts`, 2 tests green. Buys a real ticket through the real RPC and asserts the counted number moves by exactly one, then asserts the board says what it counted and refuses to be a prediction. Second test: the same board in Shona |
| plan screen screenshot | `docs/design-evidence/fare-board/`, 360px, both themes, both languages |
| AI-USAGE-MAP.md row | added, under "what is NOT AI at all", including the tie rule |
| unit suite, typecheck, lint | 466 tests green, clean |

## M4 slice landed with this batch

`tickets_route_day_idx` on `(route_id, direction, purchased_at desc)`. The only
index on tickets was `(route_id)` from 0004, and the board filters route,
direction and today.

## Honest note about what the board currently shows

The corridor's real fares today are mostly team and e2e traffic, so the busiest
hours on screen are sometimes the middle of the night. Nothing is filtered to
make that look better: a board that quietly hid inconvenient real data would be
the exact failure this feature is supposed to prevent. It resolves itself the
moment real riders outnumber the test suite.

## Defect found and deliberately not fixed

The route badge on a plan leg renders the full route code, and
`HEIGHTS-REZENDE` overflows its chip and collides with the leg name (visible in
the evidence shots, left of "Mt Pleasant Heights to Rezende Rank"). This is
pre-existing, unrelated to V4, and sits in a component this batch did not
touch, so it is flagged rather than quietly fixed. It is a two line change
whenever you want it.

## Open question for Mhofu

1. **Today, or a rolling window?** The board is "today", which is honest and
   simple but goes blank every midnight and stays thin all morning. A rolling
   24 hours would always have something to say but stops being "today". A
   rider asking "what are people paying" probably means the last day of
   riding rather than the calendar day; your call, and it is a one line change
   in the SQL.
