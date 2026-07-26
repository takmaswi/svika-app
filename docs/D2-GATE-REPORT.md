# D2 gate report — Did we get you there right? (feedback loop)

Date: 2026-07-26 · Branch: product · Status: **PASSED, rulings below open**

## What shipped

Two answer channels for the planner, both rider owned, both append only,
neither carrying a conductor or vehicle column (product law: answers tune
plans, never people, and the card says so on screen).

- **Explicit (three taps, skippable, bilingual):** after arrival the
  ticket page shows the feedback card: right kombi, right stop, too much
  walking. Yes or no chips per question, the third tap saves the row, a
  quiet skip stores nothing and is remembered on that phone. The insert
  policy demands the rider's own ARRIVED ticket, proven by the event
  stream, so feedback cannot be minted for rides that never landed
  (migration 0040, `trip_feedback`, one row per ticket, no update or
  delete for anyone).
- **Implicit (geometry, no model):** where the rider recorded their
  journey (M1) over a planned trip, the phone compares the planned alight
  stop (tickets.to_stop) and walking tail (trip_walk_tails, the 0031 seed
  written exactly for this) against the trace:
  `packages/shared/src/plan-trace-mismatch.ts`, documented rules with
  named constants: riding speed 4 m/s ends the ride, a 150 m tolerance
  decides the alight verdict, early versus late reads against the plan's
  reference point, a 1.5x factor plus 200 m dead band decides a long
  walk, and a walk-only or unfinished trace judges NOTHING rather than
  guessing. Detected mismatches land in `plan_trace_mismatches` against
  the plan that produced them, once per kind (unique, upsert ignores
  replays). This is the honest seed for a future learned ranker, which
  would then need its baseline and metrics table per the AI law; the
  docs say so in three places.
- `anonymise_me` learned both tables: opinions and derived comparisons
  go with the rider.

## Gate proofs

| Proof | Result |
|---|---|
| E2e feedback capture | `d2-feedback.spec.ts` **1/1 green**: book through the real pay path, arrive by the rider's own tap, card opens with all three questions and the never-people note, the implicit channel reports zero mismatches without a recorded journey (honesty on camera), three taps save, a reload proves the row is server truth, and the card speaks Shona when the app does |
| Mismatch unit tests | `packages/shared/test/plan-trace-mismatch.test.ts` **8 tests green** on SYNTHETIC traces (built in code, documented as synthetic in the test header and DATASET-STATEMENT.md): clean trip judges nothing; the drop-one-early ride that started this batch reads early_alight + long_walk with honest metres; carried past reads late_alight; wandering walk reads long_walk alone; a stop to stop plan that promised no walk flags a 300 m trek; walk-only, unfinished and stub traces all judge nothing |
| RLS matrix | `pnpm db:security-test` **213 passed, 0 failed** (14 new FB checks: no feedback before arrival, no minting in another's name or on another's trip, invisible cross rider and to anon, no update or delete even by the author, mismatch table same walls) |
| Dataset statement | Updated (D2 section: both channels, synthetic test data named, the future-ranker honesty clause); the diff is part of this gate hand-in |
| Regression | 17/17 e2e green across every touched surface (family, share, book, journey, d1-destination, places, d2-feedback); typecheck + lint clean; unit tests **420 passed** (shared 85 incl. the new 8, conductor 37, spine 89, web 209) |
| Docs law | AI-USAGE-MAP.md D2 row (geometry rules, no model, ranker clause); DISCLOSURE-REGISTER.md + in-app disclosure.ts rows (Tier 1) |

## Constants for ratification (named in plan-trace-mismatch.ts)

ride speed 4 m/s, alight tolerance 150 m, long walk factor 1.5x with a
200 m dead band, arrival radius 500 m (beyond it the trace judges
nothing), minimum 5 trace points.

## Open rulings for Mhofu

1. **Early versus late is a v1 simplification.** The verdict reads
   distance to the plan's reference point (the walking tail destination,
   or where the rider actually ended for stop to stop), not position
   along the route line. It is honest for the straight case and
   documented as v1 in the module header; proper along-route projection
   is a later slice if the mismatch data earns it.
2. **The three tap card auto-saves on the third tap** (exactly three
   taps, no send button). Partial answers plus walking away save
   nothing, same as skip. Say the word if partial answers should save.
3. **Feedback is one row per trip, forever.** No editing an opinion
   after the fact, even by its author (append only law applied to
   feelings). Flagging in case you want a corrected-row mechanism later.

## Plain language summary

After you arrive, Svika asks three quick questions: right kombi, right
stop, too much walking. Three taps, or skip it, and your answer can
never be edited or read by anyone else. If you also recorded the trip,
the app quietly checks whether the plan's promises held: did you get
dropped early, carried past, or walked much farther than promised, and
writes any miss against the plan that caused it. That comparison is
plain geometry with the numbers written down, not AI, and it only
speaks when the recording actually shows the whole trip. All proofs are
green: the full flow end to end, the geometry rules on synthetic test
traces, and the security walls around both new tables.
