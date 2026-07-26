# M4 gate report: speed and production polish

Status: PASSED (built and measured 2026-07-26). Slices landed across Goal 8
rather than as one batch, exactly as the plan intended ("land in slices
throughout"); this report gathers all of them with their numbers.

Scope: docs/PRODUCTION-PUSH-PLAN.md batch M4. Bundle discipline, perceived
speed, the data layer, and measurement rather than feeling.

## 1. Bundle discipline: MapLibre stops riding in first load

MapLibre is the heaviest thing in the app. `LiveMapLazy` had already taken it
off the home screen, but `TraceMap` and `PlacesMap` were still imported
directly, so every journey and places screen paid for it before painting
anything. `TraceMapLazy` and `PlacesMapLazy` give them the same treatment.

Measured from `next build`, first load JS per route:

| route | before | after | change |
| --- | --- | --- | --- |
| /app/journeys/[id] | 455 kB | 170 kB | **−285 kB** |
| /app/places | 456 kB | 171 kB | **−285 kB** |
| /app/record | 459 kB | 174 kB | **−285 kB** |
| /share/journey/[token] | 418 kB | 133 kB | **−285 kB** |
| /app (already lazy) | 170 kB | 170 kB | unchanged, the reference |
| shared by all routes | 106 kB | 106 kB | unchanged |

Every map carrying route now matches the home screen's shape: the shell paints
first and the map arrives after.

## 2. The self hosted glyphs, compressed (the M0 gate note)

Raised by Mhofu on the M0 gate (2026-07-23): "next start ships them raw today
(75 KB vs MapTiler's 49 KB gzipped for the same range)".

What was measured on the way to the fix, because the obvious answers did not
work:

| attempt | bytes on the wire |
| --- | --- |
| as shipped (application/octet-stream) | 78,323 |
| declaring `application/x-protobuf` so Next's compressor would take it | 78,323 (that type is not on its compressible list) |
| **precompressed on disk, `Content-Encoding: gzip` declared** | **43,668** |

Inventing a text-ish media type to trick the compressor would have been a lie
in a header, so the bytes on disk are now the gzip bytes
(`tools/map-tiles/compress-glyphs.mjs`, wired into `pnpm map:assets`, and
idempotent so it cannot double compress). The whole font directory went from
794 kB to 375 kB, and a served range is now smaller than the vendor's.

That change surfaced a latent bug in the service worker: `fetch` hands back a
DECODED body while the Response keeps the gzip header, so caching it stored
decoded bytes labelled as compressed. `putDecoded` now strips the encoding and
length headers on the way into every cache, which is correct for any compressed
asset and not just glyphs; the static cache version moved to v3 so old entries
are dropped rather than reused. Proven by the map and offline e2e.

Glyphs also gained `Cache-Control: public, max-age=31536000, immutable`: a font
range never changes, so a cheap phone should never fetch one twice.

## 3. Perceived speed: skeletons where the shape is known

Eight data screens (wallet, journeys, family, places, owner, profile, parcel,
intelligence) had no loading state at all: a server render that waits on the
database showed a white page on a slow connection. They now have `loading.tsx`
files rendering a shared skeleton.

DESIGN.md has no loading state, so this was built by the extract only rule from
the section 8 card, the section 12 rise and park toned bars, with no spinner
and no new colour. Recorded as spec gap 15 in `docs/DESIGN-DEVIATIONS.md`,
awaiting ratification. The pulse stops under reduced motion, and the skeleton
announces itself to screen readers.

Screens whose whole shape depends on the answer (the plan screen, a ticket)
deliberately have none: a skeleton that guesses wrong makes the screen jump,
which is worse than waiting.

## 4. Data layer: indexes and the advisors

Every query added in Goal 8 got its index in the same migration:

| index | migration | what it serves |
| --- | --- | --- |
| `ticket_events_vehicle_recent_idx` | 0041 | all four kombi_board laterals and the rank pulse count |
| `ticket_events_redeemed_recent_idx` | 0042 | the daily last-fare observation scan |
| `synthetic_service_days_route_idx` | 0042 | the generated evening history lookup |
| `ticket_gifts_sender_idx` | 0043 | a sender's own gifts |
| `demand_beacons_live_idx` | 0044 | live beacons per route and direction |
| `demand_beacons_rider_idx` | 0044 | a rider's own beacon |
| `tickets_route_day_idx` | 0045 | today's fares for the fare board |
| `demand_beacons_stop_idx` | 0046 | the beacon counts join, added FROM the advisor run |

Supabase advisors run on the finished branch:

- **Performance:** one finding attributable to this goal's work
  (`demand_beacons_stop_id_fkey` without a covering index) and it is fixed in
  0046. The rest are pre-existing INFO notices on tables this goal did not
  touch (unindexed foreign keys on audit and lookup tables that are never
  queried by that key) plus "unused index" notices on indexes created hours
  ago, which is what a fresh index looks like.
- **Security:** 57 WARN, all one class: "SECURITY DEFINER function is
  executable by authenticated/anon". That is the architecture, not a defect:
  RPCs are the only write path into money and history, every one of them gates
  on `auth.uid()` and its own rules, and the 240 check RLS suite is the proof.
  Six INFO "RLS enabled, no policy" notices are the deliberate ones (the
  generated evening history and other service-role-only tables). One real
  item for Mhofu: `auth_leaked_password_protection` is off in the Supabase
  dashboard. It is a checkbox, not code, and it belongs to the deploy owner.

## 5. Measured, not felt: Web Vitals on the reference device

`apps/web/scripts/perf-profile.mjs` drives a real production build through the
Chrome DevTools Protocol at 360x740 with Lighthouse's own mobile throttling
preset (4x CPU, Fast 3G at 1.6 Mbps and 150 ms RTT). Before is the branch at
commit `7dcf957` (built in a worktree), after is this branch.

| route | FCP before | FCP after | LCP before | LCP after | CLS after |
| --- | --- | --- | --- | --- | --- |
| landing | 3362 ms | **1380 ms** | 4591 ms | **2455 ms** | 0 |
| home | 3575 ms | 3335 ms | 3575 ms | 3335 ms | 0 |
| plan | 3595 ms | **2553 ms** | 3595 ms | **2553 ms** | 0.0014 |
| kombis | 2548 ms | 2337 ms | 3296 ms | 3096 ms | 0.0397 |
| wallet | 3200 ms | 2773 ms | 3931 ms | **3131 ms** | 0 |
| places | 2088 ms | 1892 ms | 3113 ms | 2733 ms | 0.0001 |

Raw numbers in `docs/perf/web-vitals-before.json` and `-after.json`.

Honest reading of that table:

- Every route paints sooner and every LCP improved. Landing and plan moved
  most; home moved least, because it was already the lazy map reference.
- **Transferred bytes went UP on some routes** (places 560 kB to 778 kB) and
  that is the lazy loading working, not regressing: the map chunk now arrives
  AFTER first paint instead of blocking it, and the sample is taken four
  seconds in, by which time it has landed. The rider sees content sooner and
  downloads the same map either way.
- CLS is effectively zero everywhere except the kombi board (0.04, still well
  inside the 0.1 budget), where the live wait row fills in after the first
  paint.
- These are single runs on a developer machine, not a lab average. The
  direction is consistent and the mechanism is understood, but nobody should
  quote these to three significant figures.

## 6. Follow-up landed: saved trips to places

Logged on the D1 gate as "not lost, not yet scheduled". Migration 0046 extends
`saved_trips` additively: a saved trip is now EITHER a stop pair (unchanged) or
a stop to a named place carrying its own name and coordinates, with a check
constraint enforcing exactly one kind of destination rather than trusting the
app. The plan screen's save form and the home quick picks both learned it.

One honest limitation, written into the code: a quick pick to a place has no
alight stop to aim at, so the arrival estimate falls back to the mock twin,
which the basis label on the card already says out loud. Working out the alight
stop would mean replanning every quick pick on every home render, and a wrong
number would be worse than a labelled demo one.

## Gate proof

| proof | result |
| --- | --- |
| bundle table | above, from `next build` before and after |
| glyph bytes | above, three measured attempts, `curl` against `next start` |
| skeletons | 8 `loading.tsx` files, shared component, spec gap 15 recorded |
| indexes | 8 new indexes, table above, advisors run and acted on |
| Web Vitals | before/after table above, raw JSON committed |
| saved place trips | `apps/web/e2e/saved-trip.spec.ts` 3/3 green, including the new place case |
| regression | map e2e 1/1, offline e2e 3/3 (the offline spec learned the V5 kombi step), unit 466, typecheck and lint clean |
