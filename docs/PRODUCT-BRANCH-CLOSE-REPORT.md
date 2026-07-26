# Product branch close report

Closed 2026-07-26. Eight goals, 78 commits, 46 migrations applied, one branch
that never touched main and never deployed.

This is the hand-in document for the product branch: what was built, what
proves it, and what is honestly still open. Every claim below points at a file
or a command whose output was seen, not remembered.

---

## The validation wall, run clean at the close

Every suite below was run at the end, on servers Playwright owned, against the
live Supabase project.

| suite | command | result |
| --- | --- | --- |
| typecheck | `pnpm typecheck` | clean across 4 packages |
| lint | `pnpm lint` | clean |
| unit | `pnpm test` | **466 passed** (226 web, 114 shared, 37 conductor, 89 spine) |
| RLS security | `pnpm db:security-test` | **247 passed, 0 failed, 0 skipped** |
| ledger invariants | `pnpm db:ledger-test` | **18 passed, 0 failed** |
| offline sync | `pnpm db:offline-test` | **34 passed, 0 failed** |
| places promotion | `pnpm db:places-test` | **25 passed, 0 failed, 0 skipped** |
| beacon expiry | `pnpm db:beacon-test` | **6 passed, 0 failed** |
| e2e, 32 spec files | `pnpm test:e2e` in four chunks | **76 passed, 4 skipped, 0 failed** |

**The four skips, each by name and each a result rather than a hidden red:**

1. `commute.spec.ts` "past the window the float returns" — the demo account's
   stray rides now outnumber its 56 ride fixture. Every run that books as
   Takunda leaves a real, undeletable ticket (wallet paid, ledger foreign
   key) at whatever hour the suite ran; once those outweigh the fixture the
   miner is correctly reading a different history and there is nothing to
   assert. Raising the fixture is not a way out: the RPC caps it at 60.
2. `v1-answer-home.spec.ts` "the peek answers with the ride back" — same
   cause, same check, same skip.
3. `places.spec.ts` "a name is personal until three riders agree" — the report
   rail caps an author at ten a day and this spec spends three per run, so
   about six runs exhausts it. The skip names the count left.
4. `v7-last-kombi.spec.ts` "hours before the last kombi the screen stays
   quiet" — the run happened too late in the evening to stage a window five
   hours ahead without crossing midnight.

Each skip carries its numbers in the test annotation, so a reader can see
exactly which condition fired.

---

## Goal by goal

### Goal 1 to 4 (before this session): the spine of the product

Recorded in `docs/BUILD-LOG.md` and their own gate reports: P0 and P1 (schema,
RLS, money, tickets, board codes v2), P2 (offline boarding), the map platform
(M0), the answer first home (V1), destination first planning (D1). Evidence:
`docs/P0-GATE-REPORT.md`, `P1`, `P2`, `M0`, `V1`, `D1`, `MAP-GATE-REPORT.md`.

### Goal 5: journeys (M1 + M2)

Recording a rider's own trace with consent, and sharing a trip as a guide.
Evidence: `docs/M1-GATE-REPORT.md`, `docs/M2-GATE-REPORT.md`.

### Goal 6: family doors (V3 + V2)

Guardian mode with mutual confirm and the child visible chip; guest mode with
the OTP wall moved to the identity moments. Evidence: `docs/V3-GATE-REPORT.md`,
`docs/V2-GATE-REPORT.md`, both PASSED AND CLOSED with rulings.

### Goal 7: places and feedback (M3 + D2)

Crowd naming with consensus promotion by counting rules; the post trip
feedback loop and the plan versus trace mismatch seed. Evidence:
`docs/M3-GATE-REPORT.md`, `docs/D2-GATE-REPORT.md`, both PASSED AND CLOSED.

### Goal 8: rider extras and polish (this session)

| batch | what shipped | gate report |
| --- | --- | --- |
| V5 | Rank pulse: the conductor shift declares its kombi, so fares carry a vehicle at last, and the rider card counts them against declared seats | `docs/V5-GATE-REPORT.md` |
| V7 | Last kombi countdown: a percentile over observed evenings, warned only while a rider can act, said as "usually" and never as a promise | `docs/V7-GATE-REPORT.md` |
| V6 | Send a ride, not money: a gifted board code, no account needed, revocable until somebody boards | `docs/V6-GATE-REPORT.md` |
| V8 | Demand beacon: a signal that cannot become dispatch, enforced in schema rather than copy | `docs/V8-GATE-REPORT.md` |
| V4 | Live fare board: what riders actually paid today, reported and never judged | `docs/V4-GATE-REPORT.md` |
| M4 | Bundle, glyphs, skeletons, indexes, and Web Vitals measured before and after | `docs/M4-GATE-REPORT.md` |

---

## What Goal 8 changed underneath

**Six migrations, all additive, demo machinery untouched:**

| migration | contents |
| --- | --- |
| 0041 | rank pulse: the own-fleet picker door, the pulse pair on the kombi board, the partial index the board always wanted |
| 0042 | service day ends: one observation per day from the fare ledger, plus a labelled synthetic evening history no client can read or write |
| 0043 | ticket gifts: a gift row and the first refund path in Svika's history |
| 0044 | demand beacons: the signal, its twenty minute life, and a counts door that cannot carry a person |
| 0045 | fares paid today: a group by, and the index for it |
| 0046 | saved trips reach places (the D1 follow-up), plus the beacon index the advisor asked for |

**The security suite grew from 213 checks to 247.** The new blocks: KB-5 to
KB-9 (the pulse pair and the fleet door), LK-1 to LK-6 (the evening history
and the generated table), GF-1 to GF-7 (gifted rides), DB-1 to DB-15 (the
beacon boundary).

**The ledger suite grew from 8 checks to 18**, because a gift is the first
thing here that can send money backwards and that deserved its own proof: the
wallet ends exactly where it started, a second take-back moves nothing, and a
boarded ride cannot be taken back.

---

## Things found on the way that were not on the list

Written down because a close report that only lists wins is not a close
report.

1. **No fare in the database carried a vehicle id.** `redeem_board_code` had
   accepted one since migration 0018, but the hwindi surface never sent it, so
   "fill state per kombi" had nothing to stand on and the K1 trust states could
   only ever read unverified. Put to Mhofu before building; ruled and fixed.
2. **A latent service worker bug.** `fetch` returns a decoded body while the
   Response keeps its `Content-Encoding`, so caching it stored decoded bytes
   labelled as compressed. Found by compressing the glyphs, fixed for every
   cached asset.
3. **The K1 board spec asserted a flat "unverified"**, which only held while no
   fare carried a vehicle. It now asserts the state each kombi's own ledger
   implies, plus the rule that must hold forever.
4. **"Is my beacon still live" was answered by the web server's clock**, which
   runs seconds behind Supabase, so a withdrawn beacon could still read as
   live. Found by the test suite before the product; fixed with `my_beacon()`.
5. **A place quick pick fell back to the demo arrival twin.** I wrote that off
   as acceptable and it was not: it demotes the flagship number on the home
   screen. The alight stop is now recovered from the local corpus and the point
   planner.
6. **A pre-existing defect left alone deliberately:** the route badge on a plan
   leg renders the full route code, and `HEIGHTS-REZENDE` overflows its chip
   into the leg name. Visible in the V4 evidence shots, unrelated to any Goal 8
   batch, flagged in `docs/V4-GATE-REPORT.md` rather than quietly fixed.

---

## Open questions for Mhofu

Collected from the six gate reports. None blocks anything; all are numbers or
choices that only you can settle.

| # | question | where |
| --- | --- | --- |
| 1 | The rank pulse window (20 min) and its two thresholds (half the seats, 85 percent) are untuned engineering defaults. One corridor observation on the P3 data day settles them | V5 |
| 2 | The generator's assumed evening curve (weekdays ~20:40, later Friday and Saturday, earliest Sunday) is a guess about Harare, not fieldwork | V7 |
| 3 | The 90 minute lead window on the last kombi warning: too long and it becomes wallpaper, too short and it arrives after the rider committed | V7 |
| 4 | A gifted ride is valid for four hours against two for your own ticket. A guess at how long someone needs to see a message and reach a rank | V6 |
| 5 | The fare board is "today", which goes blank at midnight and is thin all morning. A rolling 24 hours always has something to say but stops being "today" | V4 |
| 6 | Loading skeletons are a spec gap (DESIGN.md has no loading state). Ratify the treatment or replace it | deviation 15 |
| 7 | `auth_leaked_password_protection` is off in the Supabase dashboard. A checkbox for the deploy owner, not code | M4 |

---

## Honesty state at the close

**Disclosure register** (`docs/DISCLOSURE-REGISTER.md`, mirrored on screen at
`/register` from `apps/web/src/lib/disclosure.ts`): five new rows this goal.
Rank pulse, gifted rides, the demand beacon and the fare board are Tier 1 real;
the last kombi countdown is Tier 2 because most of the evenings it counts are
generated, and the card says so on screen. The kombi board row was corrected:
its trust states are thin because vehicle linked fares only started existing
this week, not because the feature is fake.

**AI usage map** (`AI-USAGE-MAP.md`): five new paragraphs under "what is NOT
AI at all". Rank pulse is a count. The last kombi is a percentile. Gifted rides
are a purchase and a refund. The demand beacon is counting rows, and the
paragraph names what would make it stop being a signal. The fare board is a
group by, including the one judgement call in it (a tie leans to the lower
fare, so the board never talks the going rate up).

**Dataset statement** (`docs/DATASET-STATEMENT.md`): three new sections.
Vehicle linked fares (what the new linkage does and does not collect), the
generated evening history (the method in full, with the five assumed numbers
named as assumptions), and demand beacons (which explicitly cannot become a
demand dataset by accident: no history table, no archive, no rollup). The
"deliberately not collected" section gained the sharpest example the product
has: a rider can pay for somebody else's kombi and Svika never learns who it
was for.

**What is generated and labelled as such, at the close:** the watchdog's
ticket history, the evening service history, the moving kombi positions, and
the placeholder voice recordings. Every one of them is disclosed in the
register, documented in the dataset statement, and visible as such on screen.

---

## Standing guards, for whoever works here next

- **The demand beacon must never gain a way to answer.** No accept, no claim,
  no assign, not even "seen". Adding one needs Mhofu's ruling, and the e2e
  fails loudly if a control appears on that screen.
- **The count on a rank pulse is never clamped.** A kombi clearing more fares
  than it declared seats is a real contradiction that belongs to the trust
  rail.
- **The fare board reports and never judges.** No comparison, no prediction,
  no "good deal".
- **Every string a rider reads exists in both languages**, and the Shona still
  waits on the external translator pass (`docs/CHECKS-FOR-MHOFU.md` item 13).

---

## Where the evidence lives

- Gate reports: `docs/*-GATE-REPORT.md`, one per batch, each with its proof table
- Build log: `docs/BUILD-LOG.md`, one line per completed task with its proof
- Screens: `docs/design-evidence/` (rank-pulse, last-kombi, gift, beacon, fare-board, and the earlier batches)
- Performance: `docs/perf/web-vitals-before.json` and `-after.json`
- Deviations and spec gaps: `docs/DESIGN-DEVIATIONS.md`, 15 entries
- Open items for Mhofu: `docs/CHECKS-FOR-MHOFU.md`
