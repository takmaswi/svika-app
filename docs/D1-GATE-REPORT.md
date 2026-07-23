# D1 gate report. Destination first planning

Date: 2026-07-23. Batch D1 of docs/PRODUCTION-PUSH-PLAN.md, executed on the product branch after V1.

## What shipped

Born from a real ride: given an address, the planner now resolves address to arrival, not stop to stop.

1. **Local geocoding corpus** (`tools/geocode-index/build-index.mjs`, `pnpm geocode:index`): reads the committed M0 PMTiles (the self hosted OSM extract) at z14 across the same Harare bbox and extracts every named feature from the place, poi and transportation_name layers into `apps/web/src/lib/geocode/places.json`. Current build: 5,782 entries (94 suburbs, 8 places, 1,999 POIs, 3,681 roads), one representative point each, provenance and ODbL licence recorded in the file and in the dataset statement. No Google, no vendor in the ride path; the corpus is a committed file and the search is a local query.
2. **Destination search** (`apps/web/src/lib/geocode/search.ts`): deterministic scoring (exact 100, prefix 70, substring 60, all words 30 plus 10 per word, small kind bonus so a suburb outranks a road of the same name). Stops still win first; a confident place plans, anything else degrades to the picker, now with place rows labelled by kind. Never a guess presented as certainty.
3. **Plan to a point** (`packages/shared/src/plan-to-point.ts`): candidate alight stops are the nearest stops within 1500 m of the destination (capped at 5, origin excluded), each scored by plan minutes plus boarding penalties plus the walking tail (straight line times a 1.25 street factor, 75 m per minute, ceiling). Lowest score wins; ties fall to shorter tail, then lower fare, then stop id. Where no candidate in range is reachable the plan does not pretend: `connected` is false, the nearest reachable stop serves, and the UI says "No kombi reaches {place} yet" with the closest drop and its real walk. Transfers surface exactly as the planner found them (the Kuwadzana evidence shot shows a two kombi plan). Documented as rules in the file header and in AI-USAGE-MAP.md; not AI.
4. **The honest trade on screen**: the plan peek carries "Drop at {stop}, then a {N} m walk" (or the no service line), the walking tail renders as a leg row with minutes and metres, the total minutes include the tail, and the map draws the tail dashed in the walk tone ending on a walk tone place pin (spec gap recorded as DESIGN-DEVIATIONS.md deviation 5, awaiting ratification).
5. **Booking carries the tail** (`bookTrip`): a destination booking sends only the place name; the server re-resolves against the corpus and re-plans to the point (client coordinates are never trusted), books the ride legs through the normal ledger path, and records the tail in `trip_walk_tails` (migration 0031, additive, RLS from the migration that creates it, insert once, no update or delete even for the owner; eight new checks in the RLS suite).
6. **Alight guidance**: the existing geofence engine now arms the walk cue from the recorded tail, so a destination trip ends with "your stop is coming up", "chiburuka" at the stop, and the walking cue as the kombi moves on, on screen (aria-live captions) and in cached audio, both languages. `?voice=replay` compresses the last stretch through the same engine for tests and recordings; no product surface links to it.

## Gate proof

- **Unit tests**: 9 on candidate scoring (`packages/shared/test/plan-to-point.test.ts`) including the transfer case, the trade tie, the unserved island stop and the honest long walk, both no connection shapes; 10 on the geocode search including corpus round trips (`apps/web/test/geocode-search.test.ts`); 4 on the trace replay (`apps/web/test/alight-guidance.test.ts`) proving the cues fire in order, inside their documented bands, at every alightable corridor stop and in both directions, over the real recorded ride profile. Workspace total 335, all green.
- **E2e** (`apps/web/e2e/d1-destination.spec.ts`), 5 of 5 passing:
  - *Address to plan to code*: type "Heights" to "University of Zimbabwe" on the home search, land on a plan with the trade line ("Drop at Pa Muhammed Mussa, then a 1528 m walk"), the tail leg in metres and minutes, one tap wallet booking to a live 4 digit board code.
  - *No service said plainly*: Kuwadzana renders "No kombi reaches Kuwadzana yet. The closest drop is ..., then a ... m walk."
  - *Shona*: the trade line asserted in Shona under the sn cookie.
  - *Picker kinds*: an ambiguous query ("primary school") lands the picker with place rows labelled by kind.
  - *Alight guidance on the trace replay*: Takunda books the UZ trip through the UI, the hwindi clears the code through the real redeem RPC, and the replay fires approaching, chiburuka and the walk cue in order; the walk cue exists only because the recorded tail rode the ticket. Playwright video kept as the gate recording.
- **Evidence pack** (`docs/design-evidence/destination-plan/`): 8 screenshots (UZ trade and tail, Kuwadzana no service; both themes, both languages, 360px) plus two videos: `alight-guidance-replay.webm` (the cues firing) and `address-to-board-code.webm` (the search to code flow).
- **Validation**: `pnpm typecheck`, `pnpm lint`, `pnpm test` green (335 tests); `pnpm db:security-test` 108 passed including the eight new trip_walk_tails checks; regression e2e green (saved trip, V1 answer home suite, book; book's wallet test showed its known baseline flake in a shared run and passed 4 of 4 in isolation, same as recorded at the M0 gate).

## Gate rulings (Mhofu, 2026-07-23)

1. The D1 constants are **approved**: 1500 m service range, 1.25 street factor, 75 m per minute, documented where they live (`packages/shared/src/plan-to-point.ts`).
2. The walk tone destination pin is **ratified** as DESIGN-DEVIATIONS.md deviation 5.
3. No save form for place plans is **approved for now**; "saved trips to places" is logged in PRODUCTION-PUSH-PLAN.md under D1 as an additive follow up slice.
4. The Shona worksheet and the untracked docs folders stay exactly as they are.
5. Goal 3 signed off and closed together with the V1 rulings.

## Decisions taken, flagged for Mhofu (as submitted; rulings above)

1. **Service range 1500 m.** A stop within 1500 m straight line (about a twenty minute walk) "serves" a destination; beyond that the plan says no kombi reaches it. 1200 m was the first cut, but large places carry their centre point (the UZ campus centroid sits 1203 m from Pa Belgravia) and would have read as unserved while their gates are close. If 1500 feels wrong on the ground, it is one constant.
2. **Walking maths**: straight line times 1.25 for streets, 75 m per minute. Two constants, documented; tune with field truth whenever.
3. **Walk tone place pin** for destinations that are not stops: DESIGN-DEVIATIONS.md deviation 5, applied pending ratification, because signal is stops only by law and the spec has no destination marker.
4. **The tail is a recorded fact** (`trip_walk_tails`, insert once, no rewrite even by its owner). This is deliberately the seed for D2's planned versus actual comparison.
5. **Saved trips stay stop pairs**: a plan to a place offers no save form for now, since saved_trips is a stop pair table. If nicknamed place trips are wanted, that is a schema addition to rule on separately.
6. **`?voice=replay`** exists as an unlinked query switch so the guidance can be proven and recorded in seconds; the register row discloses it.

## Plain language summary

You can now type where you are actually going, not just a stop name. Ask for University of Zimbabwe and Svika says: ride the Heights kombi, get off at Pa Muhammed Mussa, then walk 1.5 km, fare $1.50. Ask for Kuwadzana and it tells you the truth: no kombi on our network goes there yet, here is the closest drop and the real walk. On board, the same voice that already guides corridor rides now knows your final destination: it tells you your stop is coming, tells you to get off at the right one, and tells you where the walking starts, in English or Shona, from audio already on the phone. All of it is plain arithmetic over OpenStreetMap data we host ourselves, and the docs say exactly that.
