# LAUNCH-CROWD-PLAN.md: Svika full public launch (v3, final, ruled 13 Nov 2026)

Agent facing build plan. This version replaces v1 and v2 entirely. CLAUDE.md governs everything here (non negotiables, Mbare Sun, honesty tiers, writing style, validation wall). Where this plan and CLAUDE.md disagree, stop and ask Mhofu.

## Goal

Svika is live at https://svika-web.vercel.app (main = fae9a67). Ship ONE full public launch: a free rider app that is useful from the first minute, honest (no fake data anywhere public), personal, and crowd powered. Every feature below ships in this launch (Mhofu's ruling). Build in the order below, each step behind its own flag so main stays deployable after every commit; flip the public switch at Step 12.

## Mhofu's rulings (13 Nov 2026)

1. Everything in one launch. Order of build is for safety, not for separate releases.
2. Live kombi map is "coming soon". The trip planner is the front door. Static maps appear only inside rank pages, trip results and shared directions (real data).
3. No demo or mock data in the public app. Simulated kombis, demo estimates, "Demo movement", generated histories: all hidden from the public. Kept reachable only on a private pitch route (/pitch, flag gated, not linked anywhere).
4. Username and password sign up only. No phone, no email, no name. One time recovery code.
5. Signed out: action first. The account ask comes only after a first win.
6. Signed in: a personal home (greeting, Home and Work chips, Go again trips, recent trips, map card slot, impact and reward progress).
7. Home and Work are stored ON THE PHONE by default. Syncing them to the server is opt in, behind a consent screen that states the risk in plain words. Never synced silently.
8. Weekly reward pays for contributions, never by random draw. No random mode in code.
9. Send directions to a friend, with live "your stop is next" guidance on the friend's phone.
10. Find a place: verified crowd places plus ranks.
11. OpenRouter AI layer for understanding requests and explaining answers. The planner decides routes, fares and minutes, never the model.
12. Rank directory pre filled from data/ranks/ranks-seed-osm.csv, riders fix it, Mhofu verifies every fix.
13. Never scrape Google Maps or copy another app's data. OpenStreetMap (ODbL, attribution) is the allowed source.
14. Paid and operator features hidden, not deleted: kombi board, tickets, wallet, gift a ride, owner, intelligence, parcel, demand beacon, last kombi. Code, migrations and tests stay; CI keeps running them.
15. Steer riders to wins, never with dark patterns: no fake urgency, no forced sign up, cash riders always respected.

## Working rules

- Work on main. Small conventional commits. One BUILD-LOG line per task. Report per step in docs/launch/STEP-<n>-REPORT.md with proof.
- OneDrive mount: use the /tmp GIT_DIR workaround (docs/WHERE-EVERYTHING-LIVES.md). pnpm in /tmp on a copy.
- After each step: full wall green, push to origin main (if git needs Mhofu's credentials, stop and ask him to run git push), deploy to Vercel production from a clean clone of main with his existing Vercel login, verify live at phone size, five plain English lines to Mhofu.
- Migrations from 0049, additive, RLS on every new table from birth, a named db:security-test check per table. Supabase via the connected MCP (project svika, ref xbsawnsdvibarhjobvrm).
- Every screen: 360px reference device, slow 3G, both themes, English and Shona, screenshots in docs/design-evidence/launch/.
- VISUAL TRUTH FOR THIS LAUNCH: the 16 approved screens in "Svika Mbare Sun/launch-v2/*.dc.html" (designed 13 Nov 2026, approved by Mhofu; live canvas https://claude.ai/artifact/LGobYM25B1xeYVVhg7LmBu). They SUPERSEDE DESIGN.md wherever they differ: Tiles home with the marigold hero band and drawn kombi, borderless surfaces with char tinted depth (no 1.5px char outlines), dark floating bottom nav with a marigold active pill, ticket stub dashes for money moments, 44px plus targets. Copy their exact values (colours, radii, spacing, type sizes, motion keyframes) into packages/ui tokens and components; do not approximate. Night versions of screens that only exist in day follow Home-Final-Night.dc.html (char canvas, dark hero, marigold primary). Sample values in them (walk minutes, counts, rudo23) are illustrative; the app shows real data. Real kombi photography arrives later as assets. Any screen the canvas does not cover: copy the nearest launch-v2 pattern and log it in docs/launch/DESIGN-GAPS.md. Update DESIGN.md with a "launch v2" section once Step 1 lands. Mhofu ruled this override on 13 Nov 2026, so it is NOT a conflict with CLAUDE.md's design section: in Step 1, edit CLAUDE.md's "Design and UX best practices" to name launch-v2 as the visual truth and remove the outline rules it replaces. Step 1's UI work is to implement these screens' system, Step 3 onward implements each screen.
- No emoji. All strings from the translation file. Fares always "riders reported" with count and window.

## Step 0. Launch profile and honesty sweep

1. `launch` profile flag (server side env). Applies rulings 3 and 14. Hidden routes return not found, not just hidden from navigation.
2. Find every surface that can show simulated or generated data (demo movement, demo estimate, synthetic histories, demo personas, staged watchdog) and prove each is unreachable under the profile. Move the story and demo to /pitch behind a flag.
3. Close CHECKS 14 (recording queue cap as proposed), 15 (PMTiles hosting or confirm MapTiler quota), 16 (reseed the e2e fixture).
Proof: a crawler e2e that visits every public route signed out and signed in and fails on any text matching demo|mock|simulat|generated|sample.

## Step 1. UI foundation upgrade (from the 13 Nov audit)

1. Surfaces: replace heavy dark outlines on pills, cards, fields and sheets with borderless surfaces and the spec's char tinted depth. Hairline only where contrast requires it.
2. Spacing on one grid: 20px screen edge, 16px card padding, 12px between cards, 24px between sections. Body text 16px minimum. Instructions two lines maximum. Lists show 3 then "See all".
3. Tap targets 48px minimum (top bar chips are far smaller today). One primary action per screen using the 58px CTA pill; secondary actions are text links.
4. Fields have visible labels, not "e.g." placeholders only. Validation inline in Svika copy, never the browser's native bubble.
5. Motion: press scale 0.99 with spring back; sheets 220 to 260ms; screen transitions about 320ms; svk-rise stagger for step lists; skeleton placeholders instead of spinners or black boxes; optimistic updates (counts tick the instant you tap); short vibration on confirm where supported; everything off under reduced motion.
6. Empty and zero states say what they mean and what the rider can do. No "0 of 16" style dead ends.
7. Remove the "ND coming soon" chip from the language switch. Map attribution moves to a small info button bottom left.
8. Fix pluralisation everywhere ("1 kombis") with the i18n plural rules.
Proof: before and after screenshots of every changed screen, Lighthouse accessibility score before and after (target 95 plus).

## Step 2. Username and password accounts

1. Sign up: username and password only; then show a one time recovery code once ("save this, it is the only way back in if you forget your password").
2. Implementation: Supabase Auth needs email or phone, so use anonymous sign in converted to a username identity, or a synthetic internal address per user on a domain we control (confirmation off, never shown, never sent to). Justify the choice in the report. Usernames screened by the wordlist, case insensitive unique. Rate limited sign up and sign in with attempt logging. Password minimum 8, leaked password check on.
3. Recovery: username plus recovery code resets the password; code stored hashed, single use, reissued after each reset.
4. Phone OTP stays only for test and owner accounts, hidden from public sign up.
5. Delete my account in one tap through the existing anonymise path (0021, 0024).
6. Privacy page: what we store, what we never ask for, how long we keep it.
Proof: unit and e2e for sign up, sign in, lockout, recovery, delete; RLS checks; security-review.

## Step 3. Front door and planner (signed out, action first)

1. Home signed out shows exactly three things: "Where are you going?" (focused, From prefilled "My location"), "Ranks near you" (closest 3 with fare riders reported and "I boarded here"), and a card "Live kombis on the map: coming soon. Record your trips to help us get there."
2. Planner: From defaults to My location (permission asked in context; denied falls back to choosing the nearest rank), labelled From and To, suggestions after 2 letters from places, ranks and the existing geocode index.
3. Trip result is a step card: walk to rank (minutes, rank name), board (route, fare riders reported), get off (stop), walk to destination. A small static map shows the path. One primary action: "Start trip". Secondary links: Save trip, Send directions to a friend.
4. After the first win (first plan used or first confirmation), one gentle card: "Save your trips and join this week's reward" leading to sign up. Dismissable, never blocking.
5. Bottom bar with three tabs: Plan, Ranks, Me.
Proof: e2e signed out from open to step card in under 4 interactions; screenshots both themes and languages.

## Step 4. Rank directory, pre filled

Data (migration 0049+):
- `ranks`: kind (kombi_rank, bus_rank, mushika_pickup, roadside_pickup), name, town, location point (nullable for "needs location"), status (unverified, verified, retired), source, osm_ref.
- `rank_destinations`: rank, destination (link to places where possible, else screened text).
- `rank_confirmations`: "I boarded here", one per rider per rank per local day, rate limited.
- `rank_fare_reports`: rank, destination, USD cents, reported_at; shown as median and range over 30 days with count, tie leans LOW (fare-board.ts rule).
- Verified is computed (propose threshold, for example 5 distinct riders in 14 days, or Mhofu verified) for his ruling in the report.
- Dedupe on every write: within 60 m of an existing rank becomes "is it this one?".
Seed: `pnpm ranks:seed -- data/ranks/ranks-seed-osm.csv`, dry run first. 94 rows: 92 OpenStreetMap with coordinates, 2 Harare ranks with no location yet (Rezende North, Coventry Road Rank) loading as "needs location". All unverified. Show "Rank data © OpenStreetMap contributors" wherever ranks appear; record in docs/DATASET-STATEMENT.md that the rank table (not trips, not rider data) is offered openly under ODbL.
Surfaces: Ranks tab with list and static map, filter by kind and town, search by destination. Rank card: kind, name, town, destinations, riders reported fare, confirmations this week, Directions, "I boarded here", "Something wrong? Fix it". Rank page shareable signed out with an Open Graph card for WhatsApp via the share sheet. Plan results link to the boarding rank.
Proof: unit for verified rule, dedupe, fare median; RLS (guests read aggregates only, no client writes status); e2e search, confirm, report fare, share page signed out.

## Step 5. Fix it and Mhofu's verify queue

1. Fix it corrects name, spelling, location (drag pin), kind, destinations, fare; or adds a missing rank or place.
2. Similar suggestions grouped by pg_trgm similarity into one item with the count of agreeing riders and the closest existing names ("Copa Cabana", "Copacabana", "Coppa Cabana" become one).
3. /app/admin/verify, Mhofu only (role enforced in RLS): current value, suggested value, agree count, map, Approve, Reject, Edit and approve. Approval writes the change plus an audit row. Nothing changes live without approval.
4. Riders see "12 of your fixes are live" in Me. No badges, no leaderboards.
Proof: e2e three variants grouped, approve, card updates; non admin blocked by RLS.

## Step 6. Start trip, confirm, share my ride

1. Start trip reuses the Svika Partner recorder (board, get off, mark a stop). Traces stay on the phone unless the rider saves, shares or contributes them (partner consent unchanged).
2. On start: "Let family follow you?" one tap to a live link (existing 0026, 0034, 0036; audit first, fill gaps only) sent via the share sheet, opens without install, visible while on, stoppable in one tap, expires on arrival or after 3 hours.
3. At trip end one sheet: "Did you board at <nearest rank>? What did you pay?" Two taps, Skip always visible, then "You just helped riders going to <destination>".
Proof: e2e start, share link opened signed out in a second browser, end, confirm, rank count moves by exactly one, stop kills the link.

## Step 7. Signed in personal home

1. Greeting by time of day in the rider's language with their username.
2. Quick places: Home, Work, Add a place. One tap plans from the current location to that place.
3. Go again cards for saved trips ("Town trip: Mt Pleasant Heights to Rezende, $1.50 riders reported") with one button. Rename trips. Existing saved trips (0017, 0046) power this.
4. "Where are you going?" below the saved trips. Recent trips (last 3) each repeatable in one tap.
5. Map card slot reading "Live kombis: coming soon". Build it as a slot that later swaps to a live preview with "Open map" without relayout.
6. Impact and reward progress: "You helped 14 riders this week", "1 more contribution to qualify for this week's reward".
7. First sign in: three optional skippable steps (set Home, set Work, name your usual trip).
8. HOME AND WORK PRIVACY (ruling 7): saved on the device (IndexedDB) by default and used locally to plan. A "Sync my places to my account" switch, off by default, opens a consent screen in both languages that says plainly: syncing lets you use your places on another phone; it means Svika stores where your home and work are; if Svika's systems were ever breached that could be exposed; you can unsync and delete them at any time. Consent stored as a versioned consent stream row (same pattern as partner-v1). Unsync deletes the server copy immediately. Synced places are readable only by their owner (RLS), never used in aggregates, never in exports, never shown to admin views.
Proof: e2e home works with sync off (nothing in the database), sync on with consent row, unsync deletes; RLS check that no other role can read synced places; screenshots of the consent screen both languages.

## Step 8. Send directions to a friend, and Find a place

1. Any saved or planned trip gets "Send directions to a friend": a link via the share sheet that opens without install and shows the step card (walk, board, get off, walk) on a static map.
2. On the friend's phone, their own GPS drives "Your stop is next, chiburuka", off path and arrived cues using the existing guide link engine (M2, trace replay and distance to polyline). It works for planned trips too, built from the planned path and walking tails. The friend's position is never uploaded.
3. The sender sees exactly what the friend will see before sending, and the link reveals only the destination the sender chose.
4. Find a place: search verified crowd places (places layer 0038, 0039 public tier only) and ranks; one tap plans a trip there; "Add this place" feeds the existing places door.
Proof: e2e send, open signed out in a second context with mocked geolocation walking the route, cues fire in order; no position rows written for the viewer.

## Step 9. OpenRouter AI layer (Mhofu's pattern)

1. Load the openrouter-ai-layer skill and port its shape into apps/web server code: router.ts (only file that calls OpenRouter), models.ts (tiers from env), tools.ts, prompts/ (stable prefix from disk), budget.ts, verify.ts. Replace the current Gemini adapter in lib/ai behind the same interface; keep the mock twin. OPENROUTER_API_KEY comes from Mhofu in the terminal when asked; never committed.
2. Job: understand free text Shona or English ("ndiri kuenda kwaTendai pedyo neSam Levy"), call tools in layers (find_place, find_rank, plan_trip, get_fares), and phrase the answer. The model never invents a route, fare, stop or minute: every number in a reply is checked against tool output (verify.ts); one regenerate, then the template answer.
3. Speed and resilience: deterministic geocode search answers first; the AI path runs only when the deterministic search is not confident, with a 2.5 second budget, then falls back silently to the deterministic result. No AI call in the ride path.
4. Models (live OpenRouter prices pulled 12 Nov 2026, per million tokens in/out): FAST qwen/qwen3.7-flash 0.03/0.13; MAIN deepseek/deepseek-v4-flash 0.09/0.18; FALLBACK google/gemini-2.5-flash-lite 0.10/0.40; CANDIDATE anthropic/claude-haiku-5.5 0.10/0.50. provider.data_collection "deny", sort "price", fallback list on every call. Recheck prices at build time.
5. Eval gate: build docs/launch/ai-eval/phrases.csv with 50 real trip requests (Shona, English, mixed; sources: docs/Shona AI training, docs/Shona Translations, plus Mhofu's phrases). Run all four models; choose the cheapest that resolves every phrase to the right place and plan; record the table. If no model beats the deterministic search on the set, ship the layer switched off and say so.
6. Cost log table, per user daily budget, global monthly cap, admin cost query. Write docs/AI-ROUTER.md and update AI-USAGE-MAP.md honestly (language only; routes are plain code).
Proof: eval table, grounding unit tests, timeout fallback e2e, cost log rows from a real run.

## Step 10. Weekly contribution reward

1. No random mode anywhere. Winner = the rider with the most approved fixes plus rank confirmations plus fare reports that week (Monday to Sunday, Harare time); tie broken by earliest qualifying action. Minimum to qualify: 3 contributions. Rules page in both languages: who can enter, what counts, prize US$5, when the winner is announced, how payment works, Mhofu may refuse duplicate accounts.
2. Winner claim: winner types an EcoCash number only when claiming, with consent text; stored encrypted, visible only to Mhofu's admin view, deleted 90 days after payment.
3. Payment is manual: Mhofu sends US$5 by EcoCash and marks it paid with the reference in admin. Payout log, not the wallet ledger. No payment API.
4. Flag `weekly_reward` on at launch (contribution based, not chance).
Proof: unit for scoring, ties and minimum; e2e claim; RLS check only admin reads claim numbers; deletion job tested.

## Step 11. Growth and safety plumbing

1. Install prompt after a rider's second useful action. Page weight on slow 3G checked (M4 method).
2. Counts only metrics page for Mhofu: new accounts, weekly returning riders, plans, trips started, confirmations, fare reports, fixes submitted and approved, directions shared and opened, AI calls and cost. No third party trackers.
3. Report a problem on every rank and place card into the existing feedback path.

## Step 12. Ship

1. Full wall, then security-review on auth, location, places sync, admin, reward and the AI layer.
2. Update disclosure register, dataset statement (OpenStreetMap seed, rider reports, crowd places), AI usage map.
3. Flip the launch profile on in production. Deploy from a clean clone of main. Verify live at phone size signed out and signed in, both themes and languages.
4. Final report plus a plain English launch summary for Mhofu listing what he must do himself: POTRAZ data controller licence and DPO course, confirm Harare rank pins and fares, supply AI phrases, pay weekly winners.

## Out of scope

Pricing, ads, family plan paywall, premium bundles, Road Memory, operator and conductor features, native app, any payment API, any vendor API in the ride path, live kombi map.
