# Step 3 report: front door and planner

Plan: docs/LAUNCH-CROWD-PLAN.md, Step 3. Flag: `front_door` (the Save link also reads `accounts`, the reward wording reads `weekly_reward`, the planner's AI hint reads `ai_router`). Status: wall green, shipped behind the flag.

## What a signed out rider sees

Open the app, tap the search card, type two letters, tap a suggestion: the step card. Three interactions, no account, no permission asked until the rider picks a destination.

| plan item | what shipped |
| --- | --- |
| 1. home | the approved Home-Final: greeting by Harare time, "Where to today?", one search card ("From my location"), four quick places that plan from where you are in one tap, the Record a trip tile, and the map card "Live kombis on the map: coming soon. Record your trips to help us get there." |
| 2. planner | the approved Planner: From and To labelled, From is "My location" until you type, swap, suggestions from two letters (kombi stops first, then the committed OSM place index and the public crowd names), the last five destinations kept on the phone. Location is asked only when a trip is chosen and the reason is shown while it waits. Refused or unavailable: one line says so and From becomes a field with the cursor in it |
| 3. trip result | the approved Trip-Result: a small map of the real path, then the step card (walk to the stop with minutes, board the route, get off at the stop, walk to the place), one primary action "Start trip", and Save trip as the secondary |
| 4. first win | under the step card for guests: "Save your trips" (with the reward wording only when `weekly_reward` is on), "Create an account", and "Not now", which is remembered on the phone. Never blocks the result |
| 5. bottom bar | dark floating bar with Plan and Me |

Your location leaves the phone only rounded to three decimals (about 110 m) in the plan link, and is never written to the database (the host's request logs do see the link, as they see every page address).

## Held for later steps, on purpose

- **Ranks near you, the Ranks tab, the rank fare and "I boarded here"** need the rank directory, which is Step 4's data. Today the bar has two tabs and Ranks joins in Step 4. Home-Final's search card says "Search a place or rank"; ours says "Search a place or stop" until ranks exist, so the copy never offers something the planner cannot find.
- **Denied location falls back to the nearest rank** (plan 3.2) becomes "choose a rank" in Step 4. Until then From is typed, with the same suggestions.
- **Send directions to a friend** and the Home-Final "Guide a friend" tile arrive with directions in Step 8; the tile is in the code behind a prop and not rendered.
- **Fare on the trip result** reads "Not yet" with the note "No rider has reported this fare yet. Time is a typical trip." The network's fare table is not shown: fares are riders reported, with count and window, or nothing (Step 4 collects them).

## Honesty fix found on the way

The database still holds the test route `TEST-01` "Synthetic Test Route (not a real corridor)" with "Synthetic Stop 1" and "Synthetic Stop 2". The planner and the suggestions would have offered them. Both now read a public network that leaves out `TEST-*` routes and the stops only they serve (`apps/web/src/lib/public-network.ts`). The rows stay in the database for the test suites and the pitch build.

## Design gaps logged

G4 (asking for location and the refusal) and G5 (a fare stat with no reports) in `docs/launch/DESIGN-GAPS.md`, each copied from the nearest approved pattern.

## Proof

- Unit: `packages/shared/test/plan-between.test.ts` (6, plan between any two ends with walking at both), `test/suggest-places.test.ts` (3), `test/door-ends.test.ts` (7, the rounded location, recent list), `test/door-greeting.test.ts` (3, Harare time of day), `test/public-network.test.ts` (1, no synthetic route or stop).
- e2e `e2e/front-door.spec.ts` (6): open, search, pick, step card in three interactions signed out from Market Square Rank to Avondale Shops; a quick place in one tap; location refused; the synthetic route never offered (screen and endpoint); the first win card stays dismissed; flag off leaves the old home and the suggest endpoint answers 404. `e2e/launch-v2.spec.ts` follows the map to the trip result and the inline error to sign up.
- The launch honesty crawler (`e2e/launch-honesty.spec.ts`) passes with the new screens.
- Screenshots, 360px, both themes, both languages: `docs/design-evidence/launch/step-3/` (home, planner typing, planner with location off, trip result, trip result full page). The full page captures show the map band empty: headless WebGL does not survive a full page capture; the plain `trip-*` captures show the map.
- The preview cookie turns every flag on, so the planner captures include the `ai_router` hint ("type it how you say it"). That hint stays off for the public until Step 9 makes it true.

## Wall

On 0a847b5 (13 Nov 2026):

- typecheck clean, lint clean
- unit 567 (shared 120, conductor 37, spine 101, web 309)
- e2e 100 passed, 1 skipped, one worker against one production build. The skip is `v7-last-kombi` "hours before the last kombi", which skips itself when the Harare clock is too late in the day to stage a quiet hour (the run ended after 22:00)
- RLS 292 passed, 0 failed, 0 skipped

## Live check

LIVE
