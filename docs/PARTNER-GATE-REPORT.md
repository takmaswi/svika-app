# Partner gate report — Svika Partner: data collection comes into the app

Date: 2026-07-26 · Branch: product · Status: **IN PROGRESS**

Goal 9. Bring corridor data collection into the main app as a consented
rider facing feature, close the gaps between what the standalone field
logger captured and what the in app recorder captures, and retire the
standalone logger without deleting it.

---

## Step 1 (required before building): what `tools/gps-logger` carries

`tools/gps-logger` was written as a mock up grade field tool for one job:
get the 2026-07-07 corridor rides onto disk. It did that job and the two
bundles it produced are still the entire real dataset
(`docs/DATASET-STATEMENT.md`). It was never production code, it sits
outside the pnpm workspace (`README.md:68`, `pnpm install
--ignore-workspace`, its own lockfile, its own pinned typescript and
vite), so **nothing in the repo's CI has ever typechecked, linted or
tested it**, and it drifted away from the schema underneath it.

This is the full audit, read line by line. Every item is either fixed in
the in app flow or explicitly not carried across. Nothing here gets
re imported.

### A. Product law violations (would fail review on sight today)

| # | What | Where | Ruling |
|---|---|---|---|
| A1 | The dead palette. Bone `#FFFCEF`, linen `#E9E2C8`, pine, plus an invented riding blue `#1d4ed8` and waiting orange `#b4530a` that exist in no Svika spec | `src/styles.css:5-19` | Forest/Bone/Signal is dead by CLAUDE.md. Zero CSS crosses over; the in app surfaces are Mbare Sun tokens only |
| A2 | Glyph junk: `✎` pencils and `‹` back chevrons as text | `ui/detail.ts:49,60`, `ui/active.ts:51`, `ui/detail.ts:162` | Product law is exactly one arrow glyph (DESIGN.md §3). In app uses `BackIcon` and no chevrons |
| A3 | Every string hardcoded English | `ui/active.ts:13-17`, `ui/detail.ts:22-26`, all of `ui/modals.ts` | Bilingual from the start. Every new string lands in `dict.ts` in English and Shona |
| A4 | Free text place names go straight into proposed seed stops with no screen and no dedupe; an unnamed mark becomes a stop literally named `Unnamed dropoff (sp_marked_2_1)` | `export.ts:334-346` | The places layer (0038) already solves naming properly: wordlist screen, personal first, promotion by consensus. Marked stops go through `submit_place_name`, never straight into `stops` |
| A5 | The access token is pasted by hand into `localStorage`, no expiry, no refresh, no sign in | `upload.ts:18-32` | Deleted from the design. The in app path uses the rider's live session and RLS |
| A6 | `h()` accepts raw `html` (an `innerHTML` sink) in a tool that renders user typed names | `ui/dom.ts:23` | Not carried. React escapes by default and no `dangerouslySetInnerHTML` appears anywhere in the new code |

### B. Real bugs

| # | Bug | Where | Fix in the in app recorder |
|---|---|---|---|
| B1 | **Ping seq can collide after a resume.** `resume()` sets `seq = countPings(journeyId)`, a count and not `max+1`. If any single write ever failed, the resumed run reuses an existing seq. `pings` autoIncrements its own key, so the duplicate is silent, and every consumer sorts and dedupes on seq | `journey.ts:94`, `db.ts:106-108` | Already right in M1: `recorder.ts:145-146` resumes from `last.seq + 1`. Legs and marks follow the same rule |
| B2 | **The direction validation is a dead ternary.** `(direction === null ? outBtn : inBtn).focus()` inside a branch that only runs when `direction` is null, so it always focuses the same button, and there is no visible error | `modals.ts:58-62` | The board sheet disables its confirm until a direction is picked, and says why |
| B3 | **The wake lock reports `supported`, not `held`.** The snapshot claims the lock is active on any browser with the API, including when the request was denied and swallowed | `journey.ts:114`, `sensor.ts:89-92` | M1's `RecordingWakeLock` reports the real hold state and the e2e asserts it (`data-wake`) |
| B4 | **A mark is stamped with the last fix, however stale.** No age guard, no staleness shown; on a napping or weak GPS a mark lands tens of metres and many seconds behind the rider | `journey.ts:135-136` | The mark control is disabled until there is a fix, and the sheet prints the age of the fix it will use |
| B5 | **A mark's `recordedAt` is the GPS fix time, not the tap time**, and the two are silently merged | `journey.ts:141`, `reducer.ts:132` | Split: `recorded_at` is the fix time, `marked_at` is the tap. Both stored, both named |
| B6 | **Two things share the word "point" on one screen**: the ping counter is labelled "Points" and a marked stop is also a "point" | `ui/active.ts:41` vs `modals.ts:121` | Named apart everywhere: trace points and marked stops |
| B7 | **Nothing enforces one active journey.** `activeJourney()` takes the first active row it finds and `start()` never checks, so a second tab opens a second live journey and both write | `db.ts:84-86`, `journey.ts:72` | The in app recorder keeps one active id in `meta` and resumes it |
| B8 | **`resume()` can silently reassign a leg.** When the stored `currentLegIndex` has no matching row it falls back to the last leg, putting subsequent pings on a leg the rider is not on | `journey.ts:91-92` | Resume restores the open leg by index or opens a fresh one; it never guesses |
| B9 | **A transition is four unbatched IndexedDB writes.** A crash between them leaves a leg ended with no successor, or a journey pointing at a leg that was never stored. The README claims "crash safe" | `journey.ts:181-189`, `README.md:57-62` | Legs are written as one record per leg with the journey's own counters, and the server door takes a whole leg set idempotently |
| B10 | **`buildGeoJson` and `buildBundle` are not deterministic** despite the header calling them pure: both stamp `Date.now()` inside | `export.ts:185`, `export.ts:351` | Not carried. Nothing in the new path mints a timestamp inside a builder |
| B11 | **Upload has had no valid target since migration 0019.** It posts a `journey_id text` / `route_name` / `source: 'field_logger'` shape at `public.gps_pings`, which is a `journey_id uuid` referencing `public.journeys` with a `route_id` and a fixed source enum, and which revokes insert from `authenticated` outright. The 404 message it prints is now wrong: the table exists, the shape and the grants are the blocker | `upload.ts:39-78`, `README.md:106-133`, `0019_ride_data_pipeline.sql:43-58,100` | The whole client upload path is deleted from the design. A partner journey reaches the pipeline the way every other row does: through a service role script |

### C. Rough edges and field failure modes

| # | Edge | Where | Ruling |
|---|---|---|---|
| C1 | **No accuracy filter and no de duplication.** Every `watchPosition` fix is written, so a phone standing at a rank writes hundreds of near identical rows and a 200 m fix is stored with the same weight as a 5 m one. This is why the inbound run has 2322 pings for 15.5 km | `journey.ts:215-224`, `sensor.ts:37-41` | M1 already fixed this: `shouldKeepPoint` and `sampleDelayMs` in `packages/shared/src/journey-trace.ts` |
| C2 | **No battery policy.** A continuous high accuracy watch, `maximumAge: 0`, held for the whole journey. On a cheap Android that is the single biggest drain | `sensor.ts:40` | M1's two phase watch and nap policy (`lib/journey/policy.ts`) |
| C3 | **No teleport rejection.** One bad fix permanently inflates the exported leg distance | `export.ts:96`, `geomath.ts:30-39` | M1 has the teleport guard (`recorder.ts:266-268`); legs inherit it |
| C4 | **A GPS error carries no severity.** Permission denial and a tunnel produce the same "Location error" string, and no secure context check exists at all even though the tool's own dev flow is a LAN IP over plain HTTP | `sensor.ts:39`, `vite.config.ts:79`, `README.md:72-78` | M1 names `denied`, `insecure` and `unsupported` as separate cards (`recorder.ts:91-98`) |
| C5 | **The mark sheet defaults to a type and offers no undo.** A mistap in a hurry produces a wrongly typed stop; only the name is editable later, never the type | `modals.ts:95`, `ui/detail.ts:60`, `db.ts:114` | No preselected kind, and both kind and name stay editable on the saved trip |
| C6 | **A modal closes on any overlay click, discarding a half typed name**, with no confirmation. On a bumpy kombi this is a real data loss path | `ui/dom.ts:45-47` | The board and mark sheets do not dismiss on backdrop tap |
| C7 | **Export is four sequential deliveries with four separate fallbacks**, so a half reachable dev server produces a mix of saved and downloaded files with no single answer, and four `a.click()` calls in a row is a download prompt storm on Android Chrome | `deliver.ts:46-57` | No file shuttle at all in the new path |
| C8 | **The dev save endpoint is an unauthenticated POST on a LAN bound server that writes into the repo.** The path traversal guard is correct, but the hole is that it exists on shared wifi at all | `vite.config.ts:17-59` | Never re created |
| C9 | **`countPings` runs once per journey on every home render** | `ui/home.ts:37` | The in app list reads counts from the journey row |
| C10 | **Journeys never expire and there is no storage warning.** A full data day on a cheap phone hits the quota with no named failure | `db.ts` (no eviction anywhere) | Named as a standing limit, see "Not fixed" below |
| C11 | **Tests cover the pure half only** (reducer, geomath, export: 28 tests). The recorder, the store, the sensors and the whole UI are untested, which is exactly where B1 to B9 live | `src/*.test.ts` | The in app path ships unit tests with the feature and rides the repo CI |

### D. Lessons the logger got right and this batch keeps

1. **Mode and leg index stamped on every captured point** so the export
   reconstructs a trip with no dependence on wall clock joins
   (`types.ts:1-9`). M1 does not have this today. It is the single biggest
   gap being closed.
2. **A leg is a maximal run of one mode, and a journey is a chain of any
   number of them** (`reducer.ts:63-82`). Board, walk, board again. Never
   a fixed shape.
3. **Marked stops are dropped at the moment something happens**, name
   optional at drop time and editable later, because you cannot type on a
   moving kombi (`README.md:35-38`).
4. **Never ask a field user for a machine key.** `route_name` is free
   text and `route_code` is null on purpose; the ingest distrusts both and
   infers direction from geometry (`segments.ts:86-105`). The in app board
   sheet asks the same human question.
5. **An append only event log beside the derived state** so a crash cannot
   lose the shape of a journey (`types.ts:84-95`).
6. **Local capture is the primary path; upload is the optional one.** The
   phone owns the data until the rider says otherwise. This is now the
   consent law rather than a connectivity workaround.

### Not fixed by this batch, named honestly

- **C10, storage pressure.** The in app recorder inherits the same
  unbounded IndexedDB growth. A saved and uploaded journey could drop its
  local points once the server confirms them; it does not yet. Logged for
  Mhofu below rather than quietly left out.
- The logger's own bugs are **not** patched in `tools/gps-logger`. It is
  frozen as the record of how the first real data was collected (step 5),
  marked superseded, and its 28 tests still pass as they always did.

---

## What shipped

Data collection came into the app as a consented rider feature, the three
gaps the field logger had over M1 were closed inside M1's recorder, and the
logger was retired without being deleted.

### Schema (0047, applied to the shared project, additive only)

- **`partner-v1`, a consent stream and nothing else.** There is no partner
  column on a profile anywhere. The newest row in the `partner-v1` stream of
  the 0021 `consent_records` table is the whole answer, exactly like
  `journey-v1` and `emergency-v1`, and every gate query filters on its own
  version so no stream can move another (proven: PA-23).
- `rider_journeys` gains `partner_consent_version`: which accepted partner
  consent covered this trip's contribution, a recorded fact in the same
  shape as the journey's own `consent_version`. Null means the trip is not a
  contribution and the pipeline never sees it.
- `rider_journey_points` gains `leg_index`, defaulted to 0 so every row
  already in the table stays exactly what it was.
- **`rider_journey_legs`**: one row per maximal run of one mode, with the
  route as free text, the direction, and the fare note. A check constraint
  says a route, a direction and a fare belong to a riding leg and nowhere
  else.
- **`rider_journey_marks`**: where something happened. Keeps `recorded_at`
  (the GPS fix) and `marked_at` (the tap) as two separate facts, which the
  logger merged; carries `place_name_id` when the naming rails accepted the
  name.
- **Two new doors, partner only:** `save_rider_journey_legs` (settles the
  whole set, because the leg you are on has no end until you leave it) and
  `add_rider_journey_mark` (idempotent on its seq). Both refuse without a
  live partner consent and both need the trip still recording. RLS from
  birth on both tables, no client write path, `anon` sees nothing.
- `anonymise_me` learns the stream: the withdrawal is appended, legs and
  marks go with the journeys they belong to, and the app stream pick now
  excludes three side streams instead of two.

### The recorder (the gaps, closed inside M1)

Leg tagging and marked stops now live in the recorder, gated to appear only
under a live partner consent, because they only mean something when the trip
is going somewhere. Every other rider sees exactly the M1 screen they had.

- **Board** opens a sheet asking the route the way a person says it, a
  direction, and what you paid. The primary stays disabled until a
  direction is picked and says why (fixes B2, the logger's dead validation
  branch). **Got off** is one tap.
- **Mark a stop** opens a sheet with four kinds, none preselected (fixes
  C5), an optional name, and a line saying how old the fix the mark will use
  is; a fix older than 90 seconds disables the drop (fixes B4). Neither
  sheet dismisses on a backdrop tap (fixes C6).
- The live chip carries the leg number in mono and the mode in words, and
  the finish summary counts legs and marks.
- The trip's mode is now read off the legs: no ride is a walk, one kombi is
  a kombi trip, two or more is a transfer, and a rider who tagged nothing
  keeps the mode they picked. `apps/web/src/lib/journey/legs.ts` is pure and
  unit tested, the one thing the logger's architecture got right.

### The surfaces

- **`/app/partner`**: the whole bargain in plain words in three sections
  (what you would send, why it matters, what stays yours), one switch, and
  the rider's own counts under it. Trips recorded, stops named, distance
  mapped, read straight off their own rows through RLS. No badges, no
  streaks, no leaderboard, nobody compared to anybody.
- **Profile card**: the opt in beside the other consents, with the state
  line and a link into the full explanation.
- **The gentle door**: offered once, on the trip a rider just saved, to
  somebody who is not a partner yet. A link to read what it means, never a
  switch on a card they were not looking for.
- **The privacy page** now separates "Recorded trips" from "Given to the
  network", because the difference between those two numbers is the whole
  bargain.

### The pipeline hop

`pnpm spine:ingest -- --partner` reads only trips carrying a partner stamp,
shapes them into the same `ParsedBundle` the logger's exports produced, and
runs them through the untouched `buildIngestPlan`. So a partner ride and a
2026-07-07 corridor ride are indistinguishable to everything downstream.
`waiting` lands as walking (the pipeline has two modes), a point whose leg
has no row walks rather than inheriting a ride, and every skip prints its
reason rather than staying silent.

### Retiring the logger

`tools/gps-logger/README.md` opens with a superseded banner pointing at the
in app flow and at the audit above. Nothing is deleted: it is the record of
how the first real data was collected, its bundles still re ingest, and its
28 tests still pass.

## Gate proofs

| Proof | Result |
|---|---|
| Step 1, the audit | The table above: 6 product law violations, 11 real bugs, 11 rough edges, 6 lessons kept, every one cited to a file and line, each either fixed or explicitly not carried across. One item (C10, unbounded local storage) is named as **not fixed** rather than quietly dropped. |
| RLS matrix | `pnpm db:security-test` **271 passed, 0 failed, 0 skipped** (24 new PA checks). The load bearing one is **PA-16: a partner's raw trace stays theirs** (no other rider, no guest). Also: both doors refused without consent (PA-1, PA-2), an unstamped trip when partner mode is off (PA-3), the stamp recorded on contribution (PA-5), the leg set settling rather than doubling with its fare note (PA-6), a named mark born personal in the places layer and never a network stop (PA-8), a replayed mark being the same mark (PA-9), no cross rider read or write (PA-10 to PA-13), no direct table write even for the owner (PA-14, PA-15), the leg riding with the point (PA-17), anon blind (PA-18, PA-19), a saved trip refusing more legs (PA-20), opting out closing the doors (PA-21), contributed rows staying contributed (PA-22), and the partner stream never moving the app gate (PA-23). |
| Pipeline proof | `pnpm db:partner-test` **7 passed, 0 failed** (`packages/db/test/partner.pipeline.test.mjs`). Real 2026-07-07 corridor geometry replayed through the product's own doors, then: the plan builder infers a direction and derives segment times from it (PP-5), the rows land in `journeys`, `gps_pings` and `segment_times` and **re running changes nothing** (PP-6), and the derived segment times are the network's while the raw trace behind them is still only the rider's (PP-7). The run deletes everything it made. |
| E2e | `partner.spec.ts` **1/1 green**: partner off (no leg controls, no marks, no leg chip), on (board with a route, a direction and a fare, mark a rank, three legs and one mark at finish, save), **the counts move because the rows landed on the server**, then off again (controls gone, the gentle door back, and the counts do not move). |
| Ingest against the real database | `pnpm spine:ingest -- --partner` run twice: reads the partner trips, and correctly **skips the e2e's synthetic avenue walks by name** ("ride starts and ends nearest the same stop; direction is ambiguous"). That refusal is the proof that the pipeline does not invent a direction for a trip that is not on the route. |
| Screenshots | `docs/design-evidence/partner/`: the partner screen and the profile card, on and off, **both themes and both languages** (`partner-screen-on-{light,dark}-{en,sn}.png`, `partner-card-on-*`, `partner-contributions-*`); the gentle door in both languages; and the tagging surfaces live over the map (`partner-recording-light-en.png`, `partner-board-sheet-light-en.png`, `partner-mark-sheet-light-en.png`). Real basemap, 360px reference viewport, real counts (3 trips, 2 stops named, 842 m). |
| CI gate | `pnpm typecheck` and `pnpm lint` clean; unit tests **496 passed** across the workspace (shared 114, conductor 37, spine 101, web 244), including 16 new leg chain tests (`apps/web/test/journey-legs.test.ts`), 12 new adapter tests (`services/spine/test/ingest-partner.test.ts`) and 2 added to the sync batching suite for the new optional `leg_index`. |
| Docs law | `docs/DISCLOSURE-REGISTER.md` + `apps/web/src/lib/disclosure.ts` (new Svika Partner row, Tier 1; M1 row rewritten), `docs/DATASET-STATEMENT.md` (a full section on what a partner contributes, what does not change, where it goes, and that what exists today is team test artifacts named one by one), the privacy page's own counts, and `tools/gps-logger/README.md` marked superseded. |

### One bug this batch found and fixed in its own work

The first e2e run went red on the marked stop, not the legs. The partner
layer was being latched as synced on the **first** successful pass, but a
recording syncs every twenty seconds and a mark dropped after one of those
passes was then never uploaded. Fixed by only latching once the trip itself
is complete; re pushing is free, because the leg set settles and a mark is
idempotent on its seq (`apps/web/src/lib/journey/sync.ts`). Worth naming
because it is exactly the class of silent data loss the audit above is
about.

## Design notes

Everything is composed from existing Mbare Sun grammar; no new visual
pattern was invented.

- The tag row and the leg chip are the §7 map overlay pill (opaque, drawn
  border, never frosted) so they read over the live map.
- The two sheets are plain §8 cards that rise into the same bottom slot the
  stop CTA occupies, and **replace** it rather than covering it, so "one
  primary action per screen" holds while a sheet is open. The map stays
  visible above them, which is the right call on a moving kombi.
- Kind and direction chips reuse the M3 `place-kind-chip` grammar (marigold
  fill, char text, when selected).
- One CSS decision worth recording: `.partner-counts` uses `align-items:
  end` so the three figures line up whatever the label does. "Distance
  mapped" is three lines in Shona and two in English, and a count you cannot
  read across is not a count. This was caught by looking at the Shona night
  screenshot, not by a test.
- No new DESIGN.md deviation is claimed; nothing here needed a pattern the
  spec does not cover.

## Open questions for Mhofu

These are decisions I made to keep moving. Each is reversible and each
wants a ruling.

1. **The consent model.** Partner mode is a consent stream (`partner-v1`),
   not a preference row, so the history of who agreed and when is append
   only like every other consent. Correct?
2. **Where the tagging controls live.** They appear only under a live
   partner consent, so a rider who just wants to record a walk keeps the
   plain M1 screen. The alternative was showing them to everyone and letting
   partner mode decide only what uploads. I chose the quieter screen.
3. **Rows already contributed stay contributed** when a rider turns partner
   mode off. The notice says so plainly ("What you already sent stays part
   of the map"), and `anonymise_me` still removes everything. The
   alternative is retracting contributions on opt out, which would mean the
   network can silently lose road geometry that other riders' estimates now
   stand on.
4. **`mixed` now means a transfer** (two or more kombis), derived from the
   legs rather than from the chip the rider tapped before starting. This
   changes what an existing `mixed` row means in principle; in practice no
   real rider data exists yet.
5. **The caps**, proposed and unratified: 60 legs and 200 marks per trip,
   90 seconds before a GPS fix is too stale to mark on. All three are
   sanity walls far above real use, not tuned numbers.
6. **The route is a maintainer's call.** `--partner` takes a `--route CODE`
   and the pipeline infers direction from geometry, ignoring the typed route
   name entirely. That means partner trips do not self file onto routes, and
   a batch is a deliberate act. I think that is right for a network with one
   coded route; it needs revisiting when there are twenty.
7. **C10 is still open**: a saved and uploaded journey could drop its local
   points once the server confirms them, and does not. On a cheap phone a
   full data day will eventually hit the storage quota with no named
   failure. Inherited from M1, not introduced here, and not fixed here.
8. **The Shona strings** in this batch are machine drafted and ride the
   standing external translator pass, same as M3 and D2.
