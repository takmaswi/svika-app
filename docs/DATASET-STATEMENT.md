# Dataset statement

What data Svika runs on, what is real, what is synthetic, and how the
synthetic gets checked against the real. This file is maintained: it changes
in the same commit as any change to the data. Rubric anchor: C3.

Last updated: 2026-07-23.

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
itself. The tiles are display data only; nothing trains on them. MapTiler
remains an env keyed fallback tile source only.

### What is deliberately not collected

No rider GPS, no location tracking of people, no data from anyone outside
the team. The two traces above are the team riding its own corridor. Real
riders enter the system only through the consent gate (migration 0021), and
what Svika stores about them is listed on the privacy notice: profile,
tickets, wallet ledger, saved trips.

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
