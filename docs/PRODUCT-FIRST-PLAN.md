# PRODUCT-FIRST-PLAN.md — from demo build to the real app

Ruled by Mhofu on 2026-07-23. The AI4I challenge did not accept Svika. The submission phase is closed; the product phase begins. This document supersedes the *ordering and deadlines* of `docs/PRODUCTION-PUSH-PLAN.md` but keeps its batch definitions as law — read both before building. The Mutare cut line is dead; there is no external deadline. Quality-first, no rushing, nothing half built.

## Standing rules for every session (paste-ready preamble)

> Read docs/PRODUCT-FIRST-PLAN.md and docs/PRODUCTION-PUSH-PLAN.md before writing any code. All work happens on the `product` branch, never on `main`. Never push to any remote. Never run `vercel` or any deploy command. `main` and the Vercel deployment are frozen as the challenge "second look" build. The live Supabase project is SHARED between main and this branch: never drop or alter demo tables, RPCs, personas or seeds (migrations 0022, 0028, 0029, 0030 and the demo pool machinery) — the deployed demo must keep working. All new migrations are additive only. CLAUDE.md and DESIGN.md remain law: RLS on every new table, event-sourced writes, tests with the feature, Mbare Sun grammar, bilingual strings, provenance labels, never-accuse copy. A batch is done only when its gate proof exists and `pnpm typecheck && pnpm lint && pnpm test` is green. Commit on the branch as you go; Mhofu decides when anything merges to main.

## The goal (for `/goal` in Claude Code)

> Transform Svika from a judge-facing demo into the real rider app, on the `product` branch, at localhost, without breaking the frozen main/Vercel demo build. Strip the demo theatre (story mode, vision scenes, demo doors) from the branch, keep the real engine (ledger, tickets, planner, spines, map, consent) untouched, then build the product batches in the ruled order: M0 self-hosted map → V1 answer-first home → D1 destination-first planning → K1 kombi board → M1 journey tracking → M2 guide links → V3 guardian → V2 guest mode → M3 places layer → D2 feedback → V5 → V7 → V6 → V8 → V4, with M4 speed/hygiene slices throughout. Each batch ends with its gate proof and a green suite before the next begins.

---

## State audit — 2026-07-23

### Product core (keep — this IS the app, all real and tested)

- Money engine: ledger with invariant proofs (8/8), tickets, board codes, change-to-credit, split-a-note, credit transfers, parcels, owner ledger/statement.
- Conductor offline PWA: IndexedDB cache, idempotent sync, route-assignment gating, anomaly flags, 34/34 offline proof.
- Planner: graph planner with transfers, 462 stop pairs reachable, real HEIGHTS–REZENDE corridor from field GPS.
- Three spines: Spine 1 arrival prediction (real segment times, honest baseline promotion), Spine 2 commute alerts (pattern miner), Spine 3 watchdog (forest vs threshold, never-accuse narratives).
- Map: MapLibre LiveMap, Mbare Sun repaint, sub-pixel kombi movement, boarding camera, saved trips, day/night themes.
- Rider surfaces: map-first home, plan/pay, ticket, wallet, profile-as-welcome-home, share-my-ride, voice guide, commute alerts.
- Trust & honesty machinery: consent gates, privacy/your-data, disclosure register page (/register), provenance basis labels, DATASET-STATEMENT.
- i18n EN/SN (389 reconciled Shona keys; human translator pass still owed), Ndebele coming-soon chip.
- Test wall: ~296 unit, 57 e2e, 102 RLS, ledger 8/8, offline 34/34.
- tools/gps-logger — keep; it is the network data engine, not demo kit.

### Demo-only layer (strip from `product` branch; lives on in main)

- Story mode: `lib/stories.ts`, `lib/demo-actions.ts`, `components/story/*` (StoryStage, StoryAnimation, StoryBar, StoryNextButton, SimStamp), two-layer stories tino-town / rudo-night / takunda, presentation stage chrome (watch-only lock, caption band, phone frame).
- Vision scenes: `app/vision/*` + `lib/vision` — tinashe crash flow, gogo USSD phone (+ `lib/ussd` and the USSD machine), capacity badges scene, sandbox shelf.
- Demo front door: landing demo doors, `/api/demo` route, pooled demo_sim persona claim/reset UI paths, demo movement chip copy where it is door-dependent.
- Demo-bound e2e specs: demo, stories, vision, exits/stage suites.
- NOT stripped: the `/register` disclosure page (honesty is product), provenance labels ("demo estimate" on the simulated feed stays until real data replaces it), consent machinery, `alertPattern` demo waiver (harmless, real riders unaffected).

### Isolated — leave alone on the branch

- `deck/` (already fenced from lint/workspace), `docs/proposal/`, challenge docs. No deletions; they simply stop being worked on.

### Database constraint (critical)

One live Supabase project (`xbsawnsdvibarhjobvrm`) serves BOTH the frozen Vercel demo and the branch. The strip is **code-level only**: demo tables, RPCs (`demo_reset_all`, `demo_watchdog_set_day`, pool claims), personas and seeds stay in the DB untouched. If a batch ever needs destructive schema change, stop and flag — that is a merge-to-main decision, not a branch decision.

### Unpushed-work warning

`main` is **41 commits ahead of origin/main** (all deck, proposal and Phase B work exists only on this laptop). Before branching, push main once so the frozen build is actually preserved off-disk. The push is Mhofu's action, as always.

### Parked-items ledger (disposition ruled today)

| Parked item | Disposition |
| --- | --- |
| Tappable kombi map card + trust chooser | Promoted to product: batch **K1** below |
| Kombi dashboard ("see all kombis, click for info") | Batch **K1** (rider board) + N2 Work Station (internal ops, later) |
| Transfer-trip story (awaiting map screenshot) | Dead as a story; the real geography feeds **D1** planning instead |
| Login blocker (no SMS sender) | Fold into **V2**: Supabase test phone numbers now, real SMS vendor at pilot |
| Map changes (3D toggle, self-host, style JSON) | **M0**, as planned |
| Shona human pass, Shona model, Ndebele | Roadmap, unchanged |
| Kombi charter, diaspora gifting, N3 change points, N4 buses | Slides/context only, unchanged |

---

## Batch order (re-ruled 2026-07-23, no deadline)

**P0 → P1 → M0 → V1 → D1 → K1 → M1 → M2 → V3 → V2 → M3 → D2 → V5 → V7 → V6 → V8 → V4**, with M4 slices attached throughout. N batches stay after everything. No cut line — the order is simply the order; a batch takes the time it takes.

P0/P1/K1 are defined here; every M/V/D batch keeps its full definition and gate proof in PRODUCTION-PUSH-PLAN.md.

### P0 — Branch, freeze, verify (half a day)

1. Push `main` to origin (Mhofu). Confirm Vercel still serves the demo.
2. `git checkout -b product` from main. All future work here.
3. Verification sweep: `pnpm typecheck && pnpm lint && pnpm test`, full e2e, RLS suite — commit the green baseline numbers to `docs/BUILD-LOG.md` as the branch's opening entry.
4. Audit confirmation: generate the definitive demo-code inventory (every file/import under story, vision, ussd, demo-actions, /api/demo, landing doors) and commit it as `docs/DEMO-STRIP-INVENTORY.md` so P1 removes exactly that list and nothing else.

**Gate proof:** branch exists, baseline suite green, inventory doc committed.

### P1 — Demo strip (the app becomes an app)

1. Remove, per the P0 inventory: story mode engine and components, vision pages and libs, USSD machine, sandbox shelf, `/api/demo`, demo-door landing paths, stage chrome. Delete the demo-bound e2e specs.
2. Rebuild the landing as a real front door: the live map is the hero, one clear sign-in path, the register/privacy/repo footer stays. No marketing theatre — Mbare Sun, one primary action.
3. Rework e2e auth: specs that entered through demo doors now authenticate via seeded test users (existing E2E_AUTH pattern), not the landing. Core-flow e2e (book, redeem, wallet, share, profile, commute, offline, consent) must all survive.
4. Keep DB untouched (see constraint). Demo personas remain seeded; they are simply unreachable from this branch's UI except where tests use them directly.
5. Sweep for orphans: unused dict keys, dead testids, story CSS, demo-only assets. Bundle size should drop — record before/after first-load numbers.

**Gate proof:** no route or component under vision/story/demo remains; landing renders as front door in both themes and languages at 360px; full suite green with the reworked e2e; bundle table before vs after.

### K1 — Kombi board (the parked idea, now product)

The rider-facing answer to "which kombi, and can I trust it".

1. **Tappable kombi:** every kombi marker on the live map opens a kombi card — route, plate, direction, live ETA to the rider's stop, declared capacity, and the trust profile surface. Card grammar per DESIGN.md §7 place-chip and card patterns; flag any spec gap, never improvise.
2. **Board view:** a "kombis" view listing all vehicles on the rider's route/corridor with the same card data — the glanceable dashboard. One tap from the map home.
3. **Trust profile:** the Kombi Trust Value surface, built on what exists today: verified-fare history, capacity declared-vs-proven drift shown as a pattern never a person, and explicit "unverified" states. Red means unverified-against-facts, not a character score. Never-accuse law throughout.
4. **Feed honesty:** rides the existing VehicleFeed adapter — simulated fleet now, labelled with the standing provenance grammar; real positions arrive later from conductor-shift GPS (roadmap note, not built). N1 crew identity remains the future substrate for per-crew trust; do not build N1 here.
5. Bilingual, both themes, 360px first.

**Gate proof:** e2e of tap kombi → card → board view; unit tests for trust-state derivation incl. the unverified default; screenshots day/night × EN/SN; AI-USAGE-MAP row (rules and counts, not AI); disclosure register row for the simulated feed label.

---

## Prompts for Claude Code (run in order, one per session, preamble first)

Always paste the **Standing rules** block above at the top, then:

- **P0:** "Read docs/PRODUCT-FIRST-PLAN.md batch P0. Create the `product` branch from main, run the full validation wall and commit the green baseline to BUILD-LOG, then produce docs/DEMO-STRIP-INVENTORY.md listing every demo-only file, import and e2e spec exactly as scoped in the plan's audit. Do not remove anything yet. Show the gate proof."
- **P1:** "Read batch P1 and docs/DEMO-STRIP-INVENTORY.md. Strip the demo layer exactly per the inventory, rebuild the landing as the real front door, rework demo-door e2e auth to seeded test users, keep the database and the /register page untouched. Show the gate proof including the bundle before/after table."
- **M0 through V4:** use the prompts already written in PRODUCTION-PUSH-PLAN.md verbatim, in this document's order (M0 → V1 → D1 → K1 → M1 → M2 → V3 → V2 → M3 → D2 → V5 → V7 → V6 → V8 → V4).
- **K1:** "Read docs/PRODUCT-FIRST-PLAN.md batch K1. Tappable kombi markers opening a kombi card with route, ETA, capacity and the trust profile; a board view of all kombis on the corridor; trust states derived by rules from fare history and capacity drift, unverified by default, never-accuse copy, provenance label on the simulated feed. Do not touch the marker asset pipeline or build N1. Show the gate proof."
- **M4 slices:** attach to any batch when natural; always produce the before/after metrics table.

## Explicitly out (unchanged)

Valhalla/routing engines, Mapillary, MLT tiles, map matching, on-device inference, WhatsApp Business API, dispatch of any kind (V8 boundary), N3 before RBZ review, bus features beyond slides (N4). Flag the conflict if asked.

## Why this document exists

The demo won a hackathon (GDG Harare, 4.93/5) and carried a full submission; the challenge said no. The market has not. The engine under the demo was always real — ledger proofs, RLS walls, field GPS, honest metrics. This plan removes the theatre and keeps the truth.
