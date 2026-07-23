# PRODUCTION-PUSH-PLAN.md — from 5/10 to production feel

Ruled by Mhofu on 2026-07-16. Scope: journey tracking, trip sharing to a friend, crowdsourced place names and shortcuts, self hosted map upgrade with optional 3D, and app speed. Target: all batches attempted before the Mutare bootcamp (27 Jul). Batches are ordered so the demo is never broken: if time runs out, everything above the cut line still ships clean.

This plan obeys CLAUDE.md fully: RLS on every new table, event sourced writes, unit tests with the feature, Mbare Sun design law, bilingual strings, adapters with mock twins, honesty tiers in the disclosure register. New features here are queries and rules, not AI. Say so wherever judges might assume otherwise; forced AI is penalised.

## Standing risk note

Eleven days is tight for five batches. The mitigation is the batch order plus a hard rule: a batch merges only when its gate proof exists and `pnpm typecheck && pnpm lint && pnpm test` is green. A half done batch stays on its branch and out of the demo. Batches M0 and M1 are the demo upgrades; M2 and M3 are the new product surface; M4 is polish that can land in slices at any point.

---

## M0 — Self hosted map platform (the foundation everything sits on)

**Why first:** every other feature draws on the map. This batch removes the MapTiler runtime dependency, makes the map faster on slow connections, and unlocks offline and 3D.

**Build:**

1. Generate a Harare region vector tile extract as a single PMTiles file. Pipeline: Geofabrik Zimbabwe OSM extract → Planetiler (OpenMapTiles schema, so existing layer names keep working) → clip to a Harare bounding box that covers all seeded corridors with margin. Script it in `tools/map-tiles/` so regeneration is one command; document the command and the OSM data date in the script header and in `docs/DATASET-STATEMENT.md` (OSM is real third party data, attribution required on the map).
2. Host the PMTiles file plus self hosted glyphs (IBM Plex Mono for street labels per DESIGN.md §11) and sprites on the existing static hosting or Cloudflare R2. The `pmtiles` JS protocol plugs into MapLibre; range requests mean the app downloads only the tiles in view, not the whole file.
3. Author a native Mbare Sun style JSON instead of repainting MapTiler basic-v2 at runtime. `mbareSunStyle()` in `apps/web/src/lib/map/style.ts` already holds every colour token per theme; port those values verbatim into a checked in style document per theme. Delete the runtime transform once parity is proven. Keep the unit tests, now asserting on the static style shapes.
4. Wrap tile sourcing in the standard adapter with a mock twin: `selfhosted` provider (default), `maptiler` provider (fallback, key stays in env), `mock` (fixture tiles for tests). The demo never dies because a bucket is down.
5. Service worker: precache style JSON, glyphs, sprites; runtime cache tile ranges with stale while revalidate. This is the single biggest perceived speed win on a 360px phone on 3G.
6. 3D as progressive enhancement: a pitch and rotate camera plus a `fill-extrusion` building layer using OSM heights where present and a modest default where absent, colours from the §2 building tokens per theme. 3D is a toggle, off by default, and disabled automatically on low memory devices (`navigator.deviceMemory` heuristic) and under reduced motion. Frame rate on the reference device decides whether it survives; if it stutters, it demotes to roadmap without argument.

**Gate proof:** side by side screen recording old vs new map load on throttled 3G with load times; unit tests for style shapes and adapter fallback; map renders offline after first visit in airplane mode; OSM attribution visible. Table of tile bytes transferred before vs after.

**Disclosure:** Tier 1. Map data is OpenStreetMap, self hosted.

---

## M1 — Journey tracking (record my trip)

**Why:** riders recording real journeys is the engine that feeds everything else: sharing, shortcuts, names, and the city mapping flywheel. The gps-logger PWA in `tools/` already proved the capture pattern; this brings it into the rider app properly.

**Build:**

1. Schema: `journeys` (id, rider, started_at, ended_at, mode enum kombi|walk|mixed, consent flag, status enum recording|complete|discarded) and `journey_points` (journey id, seq, lat, lng, accuracy, recorded_at), append only, RLS so a rider reads only their own rows. Consent reuses the 0021/0024 machinery; no consent, no upload, the trace stays on device.
2. Capture: start and stop from the plan screen and the ticket screen. Adaptive sampling (tighter when moving, sparse when still) to protect battery. Queue points locally (IndexedDB, same offline first pattern as the conductor cache) and sync in batches; first sync wins, conflicts flagged.
3. UI per Mbare Sun: live trace draws on the map in the §2 route ink, a recording chip with elapsed time and distance in IBM Plex Mono, one primary action (stop). Finish screen: named trip summary (distance, duration, route drawn), save or discard. Bilingual from the translation file.
4. HTTPS is already the deploy default; keep the field gotcha in mind that GPS silently fails on plain HTTP. Surface a clear permission denied state.
5. Server side: nothing clever yet. Store traces. Map matching and analysis are a later phase and the dataset statement says which traces are real fieldwork versus synthetic.

**Gate proof:** e2e test of record, save, reload, see the trip; RLS test that rider A cannot read rider B's journey; a real recorded walk shown on the map; battery and payload numbers for a 20 minute recording.

**Disclosure:** Tier 1.

---

## M2 — Share a trip to a friend (guide mode)

**Why:** the moment that sells Svika socially. A friend visiting gets guided from the gate, including the footpath cut through that no router knows.

**Build:**

1. Extend the `ride_shares` (0026) and `share/[token]` pattern: a rider shares a saved journey as a guide link. Token scoped, expiring, revocable, no login needed to view, and the viewer sees the route trace, stops, nicknames the sharer chose to include, and the walking tail from the boarding point to the destination gate.
2. Walking directions v1 are trace replay, not routing: the recorded points ARE the directions, and they beat any routing engine precisely because they include non road shortcuts. The viewer gets the trace on the map plus their own live position dot, with simple off path and approaching cues computed client side from distance to the polyline. No external routing call in the ride path.
3. Steps are derived, not typed: segment the trace by turns and mode changes and render a step list ("walk 200 m along the path", "cross at the shops") using nicknames where they exist. Plain geometry, no AI, and the doc says so.
4. Voice: reuse the pre generated cached voice pattern for the two or three generic guide phrases that fit the existing library; no new runtime vendor calls.
5. Roadmap, not now: a self hosted Valhalla foot profile for point to point walking routes where no trace exists. Slides only until after the bootcamp.

**Gate proof:** e2e of share, open link logged out, see route and steps; token revocation test; video of a phone following a shared walking trace including an off road shortcut.

**Disclosure:** Tier 1 for trace replay guidance. Routing engine is Tier 3 roadmap.

---

## M3 — Places layer: nicknames, shortcuts, suggested names

**Why:** this is the crowd mapping flywheel: riders name the city the way the city actually talks, and the database maps Harare faster than any survey.

**Ruling applied:** personal first, promote by consensus. Nothing a user types is public on submission.

**Build:**

1. Schema: `place_names` (id, author, point geography, name, kind enum stop|place|gate|landmark, scope enum personal|suggested|public, created_at) and `shortcut_paths` (id, author, geometry linestring, scope, source journey id), append only with RLS: personal rows visible only to the author, suggested and public rows readable by all, writes only as personal.
2. Consensus promotion is a rule, not a model: when N independent authors (start N=3) log a similar name (pg_trgm similarity above threshold) within a small radius, a scheduled job promotes it to suggested; sustained acceptance (riders tapping the suggestion when naming that spot) promotes to public. Every promotion is an appended event, never an UPDATE of history. Document the rule in AI-USAGE-MAP.md as deliberately not AI.
3. Recommended naming: when a rider drops a pin, a nearest neighbour query (PostGIS `<->` ordered, trgm ranked) returns existing suggested and public names to tap instead of retyping. This is the "recommended naming" ask and it is one indexed query.
4. Shortcuts: a saved walking journey can be flagged "this is a shortcut" and becomes a personal `shortcut_paths` row rendered as a §2 walk toned dashed line on the author's map; consensus (independent similar traces, Hausdorff style distance check) promotes it, same machinery as names.
5. Safety rails: rate limit submissions per user per day, wordlist screen on names in both languages before even personal save, report action on any public name, and audit language that flags patterns and never accuses a person.
6. Map rendering: nicknamed stops and public names render as a symbol layer above the basemap in street label type; personal names get a subtle distinguishing treatment. Any pattern DESIGN.md lacks gets flagged as a spec gap, never improvised.

**Gate proof:** RLS matrix test (personal invisible to others, public visible); unit tests for promotion rule including the adversarial case (one user with three accounts fails the independence check); e2e of name a stop, second and third user name it, suggestion appears; screenshot of nickname rendering in both themes and both languages.

**Disclosure:** Tier 1. Explicitly documented as rules, not AI.

---

## M4 — Speed and production polish (land in slices throughout)

1. **Bundle discipline:** dynamic import MapLibre so non map routes never pay for it; verify with a bundle analyzer table in the gate report; route level code splitting audit; font subsetting for the three families.
2. **Perceived speed:** skeleton states on every data screen per Mbare Sun surfaces, optimistic UI on wallet and ticket actions, `preconnect` to Supabase, HTTP cache headers audited.
3. **Data layer:** indexes for every new query in M1 to M3 (journey by rider, place names by location), Supabase advisors run and acted on.
4. **Measured, not felt:** Lighthouse and Web Vitals on a throttled 360px profile, before and after table committed to the gate report. The rubric rewards evidence.
5. **Production hygiene:** error boundary and reporting on every route, empty and error states designed per spec, offline banner behaviour, accessibility pass (labels, large text mode), e2e per new user flow, dataset statement updated for journey and place data, disclosure register rows for every feature above.

**Gate proof:** metrics table before vs after; CI green; updated DISCLOSURE-REGISTER.md and DATASET-STATEMENT.md.

---

## V batches — rider value ideas (ruled in by Mhofu, 2026-07-16)

### V1 — Answer-first home

The home peek stops being a search box and starts being an answer. The commute pattern engine (`apps/web/src/lib/commute/patterns.ts`) already knows a rider's usual trips and windows; use it to pick the home peek state by moment. A known commuter inside their window sees their usual trip, its live ETA, the fare, and whether wallet covers it, with one tap to rebook and hold a board code. Evening shows the reverse trip. No recognised context falls back to the current search peek. This is UI rewiring of computed data, not new intelligence; the provenance labels stay. **Gate proof:** e2e of one tap from cold open to board code for a rider with commute history; screenshot of each peek state in both themes and languages.

### V2 — Guest mode

The map, live ETAs, trip planning and fares work logged out and read only. The OTP wall moves to the moments that need identity: paying, saving a trip, recording a journey, naming a place. The sign in prompt says exactly why an account exists: so Svika can remember you, your trips, your wallet. Consent gate stays where it is, at account creation. Shared trip links (M2) open in guest mode, making every share a door into the app. **Gate proof:** e2e of plan a trip logged out then hit the wall only at pay; RLS untouched (guests read only public data through the anon role, verify no widening).

### V3 — Guardian mode (travel with me, and family)

Ties together ride shares (0026), emergency next of kin (0023) and the journey pipeline. One tap on the ticket screen shares the live trip with the rider's guardian contact, notifies on safe arrival, and flags a trip that stalls or goes dark unexpectedly. Family accounts: a guardian can link a child's account (both sides confirm; the child's app always shows a visible "guardian sees your trips" chip, dignity law, no silent tracking) and then sees the child's trips automatically: boarded, en route, arrived. Alert copy flags situations, never accuses people. **Gate proof:** e2e of guardian link, child rides, guardian sees arrival; RLS matrix proving a guardian sees exactly the linked child's trips and nothing else; the child-visible chip in both languages.

### V4 — Live fare board (build last)

Every digital ticket is a verified fare observation. A simple aggregate query per route and hour renders "what riders actually paid today" on route cards, with rain and peak jumps visible as history, not editorial. Not AI, and the doc says so. **Gate proof:** unit test of the aggregate, screenshot on the plan screen, AI-USAGE-MAP.md row.

### V5 — Rank pulse (loading now)

Conductors already clear fares digitally; counting boarded fares against the vehicle's seat capacity gives a live fill state per kombi at the rank. Rider sees "loading at Copacabana, leaves soon" on the route card; owners get queue turnover for free. A count, not AI, documented as such. Requires seat capacity on the vehicle record and a recent-fares window query. **Gate proof:** unit test of fill state from fare events; e2e where conductor clears fares and the rider card updates; AI-USAGE-MAP.md row.

### V6 — Send a ride, not money

Buy a board code for someone else from your wallet. Extends credit transfers (0011) to ticket gifting: the recipient needs no wallet, just the code, delivered as a shareable ticket card through the phone's own share sheet (Web Share API; travels over WhatsApp without the WhatsApp Business API, which stays cut). Redemption stays code-scoped and rate limited per board codes v2. Diaspora fare gifting is the future version and stays a slide. **Gate proof:** ledger invariant tests extended to gifted tickets (no creation, loss or double spend); e2e of gift, share card render, recipient boards; revocation before redemption.

### V7 — Last kombi countdown

Ticket history shows when each route's service actually dies each evening. A percentile query per route and weekday yields "last Kuwadzana kombi usually gone by 8:40pm"; the app warns riders on that route while they can still act, with a voice cue from the cached library. Honest uncertainty language ("usually"), never a promise. Not AI, documented. **Gate proof:** unit test of the percentile with sparse and dense history; screenshot of the warning in both languages; voice cue plays from cache.

### V8 — Demand beacon (signal, never dispatch)

A waiting rider taps "I'm at the turn-off heading to town"; conductors on that route see anonymous rider counts ahead. Hard boundary ruled by Mhofu's cut list: this is a glanceable signal, never an assignment or dispatch system. No rider identity reaches the conductor, counts expire quickly, and the conductor surface stays one-action-per-screen. If any iteration drifts toward dispatch, stop and flag. **Gate proof:** RLS proof that conductors see counts only, no identities; expiry test; conductor surface screenshot at sunlight contrast.

## D batches — take me there (destination-first navigation, ruled 2026-07-16)

Born from a real ride: Mhofu was given an address, did not know the alight stop or whether a connecting kombi existed, and dropped one stop early into a long walk. The planner today resolves stop to stop; production navigation must resolve address to arrival.

### D1 — Destination-first planning

1. **Destination input:** the home search accepts any place, not just stops. The search corpus is built from the self-hosted OSM extract (suburbs, roads, POIs, from the same M0 pipeline) plus the M3 places layer as it grows (nicknames become searchable the moment they are public). Geocoding is a local index query, no Google, no vendor in the ride path.
2. **Plan to a point, not a stop:** given a destination point, candidate alight stops are the nearest stops on routes reachable from the rider's origin. The planner scores candidates on total ride time plus walking tail and picks the best, honestly showing the trade ("drop at Westgate turn off, then 400 m walk"). Where a connecting kombi exists the plan shows the transfer; where none exists it says so plainly and gives closest stop plus walk. Deterministic scoring, documented as rules.
3. **Alight guidance in ride:** the existing voice guide pattern extends to any planned trip: live position against the alight stop drives "your stop is next" and "chiburuka" cues, on screen and in cached voice, both languages. This is the feature that prevents the drop-one-early walk.
4. **Walking tail rendering:** the walk from alight stop to destination draws in the §2 walk tone; where an M3 public shortcut exists it is offered.

**Gate proof:** e2e from address search to plan with alight stop and walking tail; unit tests of candidate scoring including the no-connection case; video of alight guidance firing at the right stop on a trace replay; both languages, both themes.

### D2 — Did we get you there right? (feedback loop)

1. **Explicit:** after arrival, one tap: right kombi? right stop? too much walking? Three taps maximum, skippable, bilingual.
2. **Implicit:** when the rider recorded their journey (M1), compare the planned alight stop against the actual trace: early or late alights and longer-than-planned walks are detected geometrically and logged against the plan that produced them. No model yet; a mismatch table the planner rules can be tuned from, and the honest seed for a future learned ranker (which would then need its baseline and metrics table per AI law).
3. Feedback rows are append only with RLS, feed the dataset statement, and never single out a conductor or vehicle in any surfaced output.

**Gate proof:** e2e of feedback capture; unit test of trace-vs-plan mismatch detection on synthetic traces (documented as synthetic); dataset statement updated.

## Cut line and order

M0 → V1 → D1 → M1 → M2 → V3 → V2 → M3 → D2 → V5 → V7 → V6 → V8 → V4, with M4 slices attached throughout. V1 jumps the queue because it upgrades the first screen judges see for near-zero risk; D1 sits high because destination-first planning plus alight guidance is the core rider promise. V4 is last by ruling.

**Honest calendar note:** this list has outgrown eleven days. The order IS the priority list; expect the cut line to bite somewhere around M3. The pre-bootcamp must-haves are M0, V1, D1, M1, M2 and V3; everything after that is upside if it lands and roadmap if it does not. A batch that misses the bootcamp is not deleted, it is simply after.

If the calendar bites, cut from the bottom: M3 consensus promotion can ship personal only (still demos), M2 can ship without derived steps (trace on map still demos), D2 can ship explicit-only (implicit trace comparison follows M1 data), 3D demotes to roadmap the moment it stutters on the reference device. The demo is never hostage to an unfinished batch.

## Explicitly out (do not build, slides only)

Valhalla or any routing engine, Mapillary street imagery layer, MLT tile format migration, map matching of traces, any on device inference. Flag the conflict if asked.

## Prompts for Claude Code

One per batch, run in order, each ending with the gate proof demand:

- **M0:** "Read docs/PRODUCTION-PUSH-PLAN.md batch M0. Build the self hosted Harare PMTiles pipeline in tools/map-tiles, author the native Mbare Sun style JSONs from the existing MAP_COLORS tokens, wire the pmtiles protocol behind a tile source adapter with maptiler and mock twins, add the service worker caching, and implement the 3D toggle as described. Do not touch feature code outside the map layer. Show the gate proof before declaring done."
- **M1:** "Read batch M1. Migration for journeys and journey_points with RLS and tests, offline first capture with adaptive sampling, record and finish UI per Mbare Sun in both languages. Consent gating reuses the existing machinery. Show the gate proof."
- **M2:** "Read batch M2. Extend ride_shares to journey guide links with trace replay guidance and derived steps. No routing engines, no new vendor calls. Show the gate proof."
- **M3:** "Read batch M3. place_names and shortcut_paths with the personal first consensus promotion rule, recommended naming query, safety rails, and map rendering. Document in AI-USAGE-MAP.md that this is rules, not AI. Show the gate proof."
- **M4:** "Read batch M4. Bundle, perceived speed, indexes, and hygiene slices; produce the before and after metrics table. Show the gate proof."
- **V1:** "Read batch V1. Home peek states driven by the existing commute pattern engine, one tap rebook to board code. No new intelligence, provenance labels stay. Show the gate proof."
- **V2:** "Read batch V2. Guest mode: map, ETAs, planning and fares logged out and read only; OTP wall only at pay, save, record, name. Verify no RLS widening. Show the gate proof."
- **V3:** "Read batch V3. Guardian mode: one tap live trip share to the guardian contact, arrival notify, stall flag; family linking with mutual confirm and the child-visible guardian chip. Never-accuse copy. Show the gate proof."
- **V4:** "Read batch V4. Fare board aggregate per route and hour on route cards. Rules not AI, document it. Show the gate proof."
- **V5:** "Read batch V5. Live fill state per kombi from conductor fare events against seat capacity, surfaced on route cards. A count, not AI. Show the gate proof."
- **V6:** "Read batch V6. Ticket gifting on top of credit transfers with shareable ticket cards via Web Share API. No WhatsApp Business API. Extend ledger invariant tests. Show the gate proof."
- **V7:** "Read batch V7. Last kombi countdown from ticket history percentiles per route and weekday, with cached voice cue and uncertainty language. Show the gate proof."
- **V8:** "Read batch V8. Anonymous demand counts from waiting riders to conductors on the route. Signal only, never dispatch; no identities; fast expiry. Show the gate proof."
- **D1:** "Read batch D1. Destination-first planning: local geocoding index from the M0 OSM pipeline plus public place names, alight stop candidate scoring with walking tails and the no-connection case, in-ride alight guidance with cached voice in both languages. Show the gate proof."
- **D2:** "Read batch D2. Post-trip feedback: three-tap explicit capture plus geometric plan-vs-trace mismatch detection where a journey was recorded. Append only, RLS, dataset statement updated. Show the gate proof."

## N batches — network operations (ruled in by Mhofu, 2026-07-20)

Validated in IDEA-VALIDATION-2026-07-20.md in the planning folder. All three sit after the existing cut line; none jump the pre bootcamp must haves.

### N1 — Crew identity and per trip crew

A kombi has many drivers over time, a driver drives many kombis, same for hwindis (source: Mhofu, ground truth). The current schema cannot express this: conductors bind to one owner (0001_identity_and_fleet.sql:86), there is no drivers table, and no record of who worked a trip. Target model: crew_members (profile plus role, driver or hwindi or both), crew_engagements (many to many with owners and vehicles), trip_crew (driver id and hwindi id recorded at trip start on the conductor app). Commission and RLS follow the engagement. This is the substrate for the Kombi Trust Value badges and sharpens Spine 3 segmentation; the never accuse law holds, the watchdog still flags patterns only. Post submission migration; identity tables do not move the week of the bootcamp.

### N2 — Work Station (internal ops dashboard)

Internal Svika company view of the live network: trips running, crews on shift, revenue flow, anomaly flags. Not user facing, internal auth only. It is queries and views over data already captured; document in AI-USAGE-MAP.md that the only AI surfaced is the three existing spines re rendered. The owner dashboard already proves the pattern; this is the same idea with cross fleet scope. Keep it to at most one roadmap slide in the submission story.

### N3 — Rank change points (Tier 3, slides only, RBZ check required)

Cash to ticket on ramp at ranks: a rider hands cash to a trusted vendor and gets Svika ticket credit, small percentage fee to Svika. Human agents first, following Kigali Tap&Go (about 45 agents) and Lagos Cowry kiosks; vending machines are a later hardware option only ($5,000 to $15,000 per unit plus 10 to 15 percent yearly maintenance is formal BRT economics, not rank economics). The hard part is the redemption leg: crews cashing tickets out makes Svika a float operator, the exact model the RBZ shut down for EcoCash agents in 2019 over cash premium abuse. Near term design therefore redeems into the existing Svika ledger (crew wallet credit, settled at owner level), never physical cash. Prerequisite before any pilot: RBZ regulatory review. Does not enter code before that ruling; flag the conflict if asked.

### N4 — Intercity bus safety layer (Tier 3 vision, slides only, ruled in 2026-07-23)

The same safety spine, bigger vehicles. Zimbabwe's SI 118 of 2023 already mandates speed limiting (100km/h cap) and speed monitoring hardware on every public service vehicle, with a police monitoring centre in Harare; Kenya's NTSA pairs the same hardware with telematics and reports commercial sector fatality reductions. What no one has built is the passenger facing layer: visible compliance and trust badges, trip following for families, incident reporting, and a digital boarding manifest that doubles as first responder infrastructure (after the Oct 2025 Limpopo crash, identifying 42 victims across two nationalities took days). The stakes are real: about 1,200 bus accidents in 2023, forty percent from speeding, per police figures. Product law for this item: partnership with operators, Svika never touches how bus companies sell tickets or run their business; it adds the layer. Crash detection and speed scoring stay on the cut list for buses exactly as for kombis. SI 118 data access is a negotiation with operators and the regulator, an open question, never a scrape. Nothing here enters code; evidence in the planning folder IDEA-VALIDATION-2026-07-20.md section 4.

## Kept in context, not built (Mhofu evaluating)

Kombi charter for company commutes (office park contracts instead of a company car). Devil's advocate recorded: different buyer (B2B invoicing and credit risk versus the mock-only money law), reliability blame without vehicle control, permit and insurance class questions, association politics when a kombi leaves the rank queue. Strong Tier 3 slide in the future-of-kombis story; the fare and journey data being collected now is what would price such contracts later. Diaspora fare gifting likewise stays a slide until real money movement is lawful in the codebase.
