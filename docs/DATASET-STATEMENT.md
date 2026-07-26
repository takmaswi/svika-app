# Dataset statement

What data Svika runs on, what is real, what is synthetic, and how the
synthetic gets checked against the real. This file is maintained: it changes
in the same commit as any change to the data. Rubric anchor: C3.

Last updated: 2026-07-26, the product branch close.

## Real data

### Two corridor rides, 2026-07-07

The entire real dataset today is two kombi rides on the Mount Pleasant
Heights to Rezende corridor, ridden and recorded by the team on 2026-07-07
with the Svika field GPS logger.

- Clean return run (Rezende to Heights, no touting detours): 491 raw riding
  pings, smoothed to a 23 vertex base line, 13.5 km, 27 riding minutes.
  This run is the corridor's base road geometry.
- Inbound run (Heights to Rezende, customer seeking detours): 2322 raw
  pings, 15.5 km, 43 riding minutes. Kept as variance data only; it never
  shapes the base line.
- 15 named stops, every name exactly as marked in the field during the
  rides. Three blank markers were dropped.
- The flat corridor fare, 150 cents, paid and recorded on the ride day. It
  is the only measured money number in the system and the watchdog
  simulator inherits it.

The derivation from raw rides to seed data is reproducible code
(`packages/db/seed/geo/derive.mjs`), and the ride to segment pipeline for
arrival prediction is `pnpm spine:ingest`. Spine 1 currently stands on 2
recorded journeys giving 20 segment observations
(`services/spine/metrics/METRICS.md`); that is below the 10 journey
promotion rule, so the baseline serves and the interface says how many rides
each estimate stands on. More ride days are planned (P3) and every new ride
raises the count.

### Base map data: OpenStreetMap (third party, ODbL)

The map the app draws is a self hosted Harare extract of OpenStreetMap:
Geofabrik's Zimbabwe extract, processed by Planetiler into OpenMapTiles
schema vector tiles and clipped to a Harare bounding box
(30.85,-18.12 to 31.25,-17.62), by the committed pipeline in
`tools/map-tiles/` (`pnpm map:tiles`). The OSM data date of the current
build is recorded by the pipeline in `tools/map-tiles/OSM-DATE.txt`; the
extract in use was built 2026-07-23 from the Geofabrik extract stamped
2026-07-22T20:21:25Z. OSM is (c) OpenStreetMap contributors, ODbL, and the
tile schema is OpenMapTiles (CC-BY); both credits are rendered on the map
itself. Nothing trains on the tiles. MapTiler remains an env keyed
fallback tile source only.

### Destination search corpus (derived from the same OSM extract)

D1's destination search runs on a committed local corpus
(`apps/web/src/lib/geocode/places.json`) extracted from the tiles above by
`tools/geocode-index/` (`pnpm geocode:index`): every named suburb, place,
point of interest and road inside the same Harare bounding box, 5,782
entries in the current build (94 suburbs, 8 places, 1,999 POIs, 3,681
roads), each carrying one representative point. Same provenance and
licence as the tiles: OSM, ODbL, data date per `OSM-DATE.txt`. It is a
lookup index for deterministic string scoring, not training data; rerun
the tool after any tile refresh and commit the result so the app never
geocodes through a vendor.

### Rider recorded journeys (M1, 2026-07-24)

Batch M1 lets a rider record their own trip: `rider_journeys` and
`rider_journey_points` (migration 0033) hold GPS traces a rider chose to
record and chose to upload. Two consents stand between a fix and the
server: the recording is started by hand, and the upload happens only
under an accepted `journey-v1` consent (the 0021 consent machinery, its
own stream); without it the trace stays in the phone's IndexedDB and
never leaves. Traces are personal data under RLS (a rider reads only
their own, proven by the JN checks in the security suite) and are NOT
training data: the server stores them and computes nothing. Any future
use for the spines would go through the 0019 ingest pipeline with its
source honesty flags and its own consent story, and this file would say
so first. As of this date the table holds only team test artifacts:
synthetic e2e walks (mocked browser geolocation, named as such) and the
real 2026-07-07 walking leg replayed through the app for the M1 gate
evidence (real geometry, replay timestamps).

### Place names and shortcuts (M3, 2026-07-26)

Batch M3 lets riders name the city: `place_names` and `shortcut_paths`
(migration 0038) hold names and walking shapes riders typed and flagged
by hand. A row is born personal, readable only by its author under RLS
(the PL checks in the security suite); community rows (suggested,
public) are minted only by the scheduled counting rule described in
AI-USAGE-MAP.md and carry no author column at all: aggregated knowledge,
not personal data. The rate limit attempt log stores outcomes only,
never the typed name: a rejected name is not ours to keep. anonymise_me
deletes a rider's personal names and shortcuts; community rows stay,
exactly like any other promoted history. As of this date the tables hold
only team test artifacts: the promotion suite and the naming e2e write
uniquely named rows at random spots away from the corridor, clean up
their personal rows, and hide their own community rows through the
report rail, so nothing they made surfaces in search, recommendations or
rendering. No real crowd data exists yet; when it does, this file gains
its counts and provenance first.

Two honest riders on that: some community rows from failed test runs stay
in the table (a community row cannot be deleted without destroying its
own promotion event, and events are append only by design), invisible on
every surface once hidden and always at random spots off the corridor.
And the home map evidence shots
(`docs/design-evidence/places/places-home-names-*.png`, added with the
ruling 3 slice) show a name seeded by the evidence script beside the
rank, deleted at the end of the run: it is a staged name proving the
rendering, not a name anybody in Harare has given that spot.

### Post trip feedback and plan mismatches (D2, 2026-07-26)

Batch D2 adds two rider owned answer channels (migration 0040), both
append only under RLS with no update or delete path even for their
author. `trip_feedback` holds the explicit three tap card (right kombi,
right stop, too much walking), insertable only against the rider's own
ARRIVED ticket, skippable, and a skip stores nothing. `plan_trace_mismatches`
holds the implicit channel: where a rider recorded their journey (M1)
over a planned trip, the phone compares the planned alight stop and
walking tail against the trace with documented geometry rules
(`packages/shared/src/plan-trace-mismatch.ts`, named constants, no
model) and logs early alights, late alights and longer than planned
walks against the plan that produced them. Neither table carries a
conductor or vehicle column, deliberately. The unit tests for the
mismatch rules run on SYNTHETIC traces built in code
(`packages/shared/test/plan-trace-mismatch.test.ts`), named as such; no
real rider data feeds them. As of this date both tables hold only team
test artifacts from the e2e and security suites. This data is the
honest seed for a future learned plan ranker; if that ranker is ever
built it becomes an AI feature with a baseline and metrics table first,
and this file says so before any training happens.

### Vehicle linked fares (V5, 2026-07-26)

Until this batch every `ticket_events` row carried a null `vehicle_id`:
the redemption RPC had accepted a vehicle since migration 0018 but the
hwindi surface never sent one. Batch V5 adds one skippable step to the
conductor's shift ("which kombi today?"), and from then on each cleared
fare records which vehicle it was cleared on. That is the whole new
data point: a fare and a plate, both already ours, joined. Nothing new
is collected about a rider, and nothing about the conductor beyond what
the redemption row already held. The rank pulse on the rider card is a
count over those rows inside a 20 minute window against the registry's
declared seats; the fleet registry itself (plates, seats) remains
seeded staging, not fieldwork, until the corridor day brings real
plates. As of this date the vehicle linked fares in the database are
team test artifacts from the e2e suite and the gate evidence script
(both named in `docs/V5-GATE-REPORT.md`), cleared through the real
purchase and redemption RPCs rather than written in. A hwindi may skip
the step, so the linkage is a declaration and not a claim of complete
coverage; anything counted from it is honest about the window it
counted over.

### Demand beacons (V8, 2026-07-26)

A beacon is the shortest lived thing Svika stores: a rider, a stop, a
route and an expiry twenty minutes out (migration 0044). It exists to be
counted and then to disappear. Nothing is kept afterwards: there is no
history table, no archive and no aggregate rolled up from expired
beacons, so this data cannot become a demand dataset by accident. If a
future feature wants to learn from demand over time, that is a new
dataset with its own entry here and its own ruling, not a quiet
retention change.

What a conductor can see of it is a stop and an integer. What a rider
can see of it is their own beacon. Nobody else sees anything.

### What is deliberately not collected

No background location tracking of people, no data from anyone outside
the team. Gifted rides (V6) are the sharpest example of the rule: a rider
can pay for somebody else's kombi, and Svika stores who paid and which
ticket, but never who it was for. There is no recipient name, number or
account anywhere, because the sender's own phone carries the message and
the code identifies a ticket, not a person. Journey traces exist only when a rider starts a recording by
hand and end when they stop it; there is no passive collection. The two
corridor traces above are the team riding its own corridor. Real riders
enter the system only through the consent gate (migration 0021), and
what Svika stores about them is listed on the privacy notice: profile,
tickets, wallet ledger, saved trips, and (only with the journey consent)
recorded journeys.

## Synthetic data

### Watchdog ticket histories

The revenue watchdog needs months of per vehicle per day history and the
network has run for days, so the history it scans is generated. Method, in
full, in `services/spine/src/watchdog`:

- A seeded simulator (deterministic mulberry32 generator, so every run
  reproduces from code alone) writes 90 days of ticket history for 4
  synthetic kombis on the corridor: legs per day, seat load, digital share
  and rush hour share drawn from a reviewed config
  (`services/spine/src/watchdog/config.ts`). Every number in that config
  except the measured fare is an assumption and is flagged for review in
  `docs/CHECKS-FOR-MHOFU.md`.
- Leakage is injected on about 8% of days with known ground truth: a heavy
  skim of one kombi's cash fares, a rush hour skim, or a day whose
  recording stops mid afternoon. Digital fares survive skims because ledger
  entries cannot be quietly removed, which is the product's own argument
  showing up in the data.
- Every generated row is marked `data_source = 'synthetic'` in the
  database, the owner screen labels the card "Simulated history", and the
  disclosure register carries the same line. The injected leakage labels
  are what the detector evaluation scores against
  (`services/spine/metrics/WATCHDOG-METRICS.md`).

### Evening service history (V7, 2026-07-26)

The last kombi countdown answers "when does this route's service usually
die?" from one observation per day: the local minute the last fare
cleared. The corridor has run for days, so most of those evenings do not
exist yet. `packages/db/seed/service-days.mjs` generates them, and that
file IS the method, committed and readable:

- one row per route, direction and day over the last 90 days, written to
  `public.synthetic_service_days` where every row is stamped
  `data_source = 'synthetic'`, and which no client can read or write
  (RLS proven in the security suite, LK-4 to LK-6)
- a base last-fare minute per ISO weekday, assumed rather than measured:
  around 20:35 to 20:45 on weekdays, later on Friday and Saturday,
  earliest on Sunday. Those five numbers are an assumption about Harare
  evenings and are flagged for Mhofu on the V7 gate, not presented as
  fieldwork
- a per day jitter of up to 22 minutes either side, seeded from the route
  id and the date so a rerun reproduces the same history. The jitter
  exists because a flat number would make the card's own spread reading
  a lie
- a fares count per day above the three fare observation floor

Nothing in this generator touches `tickets`, `ticket_events` or the
ledger: it is not money and not a ticket. The RPC that feeds the card
returns real observations and generated ones separately labelled, a real
day always displaces a generated one for the same date, and the card on
screen prints how many of the evenings it counted are generated. As real
evenings accumulate they replace the generated ones day by day with no
code change, and the generated rows can be deleted outright without
breaking anything.

### Simulated kombi movement

The live map's moving kombis are a mock vehicle feed moving along the real
recorded road at the speed the field ride measured. The map carries a
permanent demo chip. This is display simulation, not a dataset; no model
trains on it.

## Checking synthetic against real

The plan, executed as real data arrives:

1. Once real ledger aggregates cover a few weeks, compare the simulator's
   per route per day distributions against the real ones: tickets per day,
   digital share, peak share, weekday against weekend shape. Distribution
   distance (a two sample Kolmogorov Smirnov check per feature) plus a
   plain table of means and spreads, committed next to the watchdog
   metrics.
2. Recalibrate the simulator config from the measured values and rerun
   `pnpm watchdog:eval`; the metrics table and this file update in the same
   commit.
3. Retire the simulator for the demo owner once months of real fares
   exist; the same tables then hold real aggregates and the card label
   changes, which is a register tier change and follows the register rule.

Until step 1 is possible, the honesty line is: the detector is real and its
evaluation is real, but it is proven on data whose shape we chose. The
config assumptions are flagged, the seed is committed, and every synthetic
row is labelled in the schema, on screen, and here.

## State at the product branch close (2026-07-26)

Real: two corridor rides recorded by the team on 2026-07-07, the OSM extract
and everything derived from it, the fare ledger as it actually stands, and
the rider recorded journeys, place names, feedback and vehicle linked fares
that the team's own test accounts have produced. Generated and labelled:
the watchdog's ticket history, the evening service history (V7), the moving
kombi positions, and the placeholder voice recordings. Nothing else exists.

No data from anyone outside the team has entered this system.

## Licensing and rights

- The field GPS traces, stop names and fare were collected by the team and
  are covered by the repository licence (all rights reserved, publicly
  visible for adjudication).
- The synthetic histories are generated by committed code in this
  repository, same licence.
- The base map is OpenStreetMap (ODbL, (c) OpenStreetMap contributors),
  self hosted as a Harare extract with attribution on the map; the IBM
  Plex map fonts are SIL OFL 1.1. Both are display assets only; nothing
  trains on them. MapTiler is a licensed fallback tile service, display
  only. No other third party datasets are used.
- No dataset contains a real rider's personal data. Demo accounts are
  synthetic people; real riders are governed by the consent records and
  the privacy notice, and anonymisation on request is built in.
