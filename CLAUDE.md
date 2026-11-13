# CLAUDE.md — Svika

# Drop this at the root of the new repo. It governs every agent session on this codebase.

## What Svika is

Trip intelligence and a safety net for Harare's informal kombi network. The promise is safety, trust, predictability and dignity; tickets, codes and the wallet are mechanisms, never the pitch. Riders plan trips in Shona or English, board with a short code, share a trip with family, and unreturned change becomes USD wallet credit. Conductors clear fares offline on their own phones. Owners see every kombi live with trips and earnings by route. The ticket record becomes the passenger manifest a crash alarm needs inside the golden hour (safety layer is roadmap). Server side AI does three load bearing jobs: arrival prediction with no timetable, learned commute alerts, and revenue anomaly detection (flags unusual days, never a person). A Zimbabwean voice guides riders in ride ("Wakusvika pa turn off, chiburuka"). Current target: 2026 POTRAZ Innovation Expo and Conference, Seed Level, ZIEC Bulawayo, 29 Sep to 2 Oct 2026. The AI4I challenge is closed; this repo is svika-app on GitHub.

## Money model and Road Memory (final rulings by Mhofu, 18 Sep 2026, as submitted to the POTRAZ Expo)

Safety is free. Intelligence and peace of mind pay. Every pitch, doc and screen must match this. Retired: the six line stack, wallet float, records as collateral, the leakage watchdog as a pitch, the ZIMRA presumptive tax angle, fleet management as the first line.

- Free for every rider, always: trip planning, board code, voice guidance, share my ride, safety warnings, the family arrival link. Cash always boards and never loses its place in the queue.
- Family plan: $2 a month for a parent or guardian to follow up to five dependants (children or elderly parents).
- Rider premium: smart routing, arrival predictions, commute alerts, saved routines, in small daily or weekly bundles.
- In app ads for free riders (Mhofu wants in app ads specifically), by route and time of day; consented and aggregated, never during ride guidance. POTRAZ is the Data Protection Authority.
- Commute plans for employers and schools.
- Fleet safety management for owners (kept, but never the front page): kombis live, drivers' safety scores, crash risk on their routes.
- Later: insurers and medical aids (accident cover at boarding, lower premiums for safer kombis).
- Not Svika's concern: who funds conductor commission.

Road Memory (building next, the headline AI story): AI that learns from every crash and near miss (where, when, light, weather, water crossings, speed before impact, reported cause, joined with trip data and rider flags of reckless driving) and prevents the next: safest route shown beside the fastest, flood and night warnings, rider flags for reckless driving, kombi safety badges riders can see, driver safety scores, a monthly why crashes happened report for TSCZ, ZRP and road authorities, responders placed where crashes cluster. Baseline: plain crash counts per stretch; the model must beat it using trips taken. Flags patterns, never names a driver. First data: docs/KOMBI-SAFETY-EVIDENCE-2026.md. Pitch labels are Live today / Simulated / Building next / Vision; Mhofu pitches the full vision, labelled, never limited to what is built.

Reference documents live in the owner's planning folder: PHASE-3-STRATEGY.md (product decisions), PHASE-4-BUILD-PLAN.md (phases P0-P6 with gates), COMBINED-EVIDENCE-BASE.md (verified facts), AI4I-RUBRIC-NOTES.md (scoring). When in doubt, those win over improvisation.

## How to work (Fable 5 operating rules)

1. **Phases with gates, no calendar.** Work P0→P6 from PHASE-4-BUILD-PLAN.md. A phase is done when its named proof exists (test output, video, metrics table), never when it feels done. Stop at every gate and show the proof before moving on.
2. **Evidence over assertion.** Claims about the code cite file and line. Claims about the world cite the evidence base or get web verified. Never invent statistics, fees, fares, place names, or kombi practices. Mhofu is the only source of truth for Harare geography and informal network behaviour.
3. **Adversarial self review.** After building anything, attack it: what breaks on stage, what a judge pokes, what a hostile user does. Fix or log before declaring done.
4. **Consult before product decisions.** Feature, scope, or architecture changes get flagged and explained to Mhofu first. Never silently choose on irreversible or product shaping calls.
5. **Honesty tiers everywhere.** Tier 1 real and working. Tier 2 clickable with fixed backend. Tier 3 slides only, never in code. The README and the demo disclosure register label every feature. We never overclaim to judges; the on device Gemma lesson is not repeated.
6. **Plain language summaries.** After any technical document or gate report, give Mhofu a short plain English summary. No jargon walls.
7. **Writing style, hard rules:** no em dashes, no hyphenated compound words, run the humanizer pass on prose deliverables (README, proposal text, deck copy).

## Non negotiables (rubric: C1 code quality is 30%)

- **RLS on every table from the first migration.** The service role key exists only in the seed script and CI secrets. An automated test proves one rider cannot read another's tickets or wallet. Any PR weakening RLS is rejected.
- **Money is a double entry, append only ledger.** No mutable balance columns. Ledger invariant unit tests (money cannot be created, lost, or double spent) must pass before any wallet feature merges.
- **Tickets are event sourced.** State changes append ticket_events rows. Never UPDATE history.
- **Unit tests ship WITH the feature**, not after: ledger, fares, planner, code redemption, anomaly logic. Playwright e2e per user flow. CI (typecheck, lint, test) green before every merge.
- **Small conventional commits** (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Judges read the git history. No single commit dumps.
- **Lockfile committed, dependencies pinned.** The rubric names unlocked manifests as a mark down.
- **Secrets never in the repo.** `.env.local` only, `.env.example` documents every key. No key from any chat or doc gets pasted into code.
- **Board codes v2:** 4 digits, scoped to route + direction + time window, rate limited redemption with attempt logging. Never regress to global 3 digit codes.

## AI layer rules (rubric: C2 AI justification is 30%)

- Three spines only: ETA prediction, commute alerts, revenue anomaly. Each keeps a named baseline (naive average, alarm clock, fixed threshold) and a metrics table proving the model beats it on held out data. If a feature can be done with a query or a rule, do it with a query or a rule and say so; forced AI is heavily penalised.
- All inference server side (deployable to ZCHPC CCE). No model inference on rider phones.
- Every external AI or service call goes through an adapter with a mock twin: providers are swappable, the demo never dies because a vendor is down, and no live vendor call sits in the ride path. Voice audio is pre generated and cached (ElevenLabs is a studio tool, not a runtime dependency).
- Anomaly outputs flag patterns, never accuse a named person. This is a product rule, not a tone suggestion.
- Dataset statement (rubric C3, 20%) is a maintained file: what data is real (corridor fieldwork), what is synthetic (simulator, generation method documented), and the statistical validation of synthetic against real. Update it whenever data changes.

## Design and UX best practices

- **"Mbare Sun" is the only visual truth.** The spec is `Svika Mbare Sun/DESIGN.md` in this repo plus the seven numbered reference screens beside it; every visual value comes from there verbatim. The extract only rule applies: if a screen needs a pattern the spec does not cover, copy it from the numbered screen that has it, and if none has it, flag the gap and propose a spec addition. Never improvise a variant.
- **The old palettes are dead.** Forest/Bone/Signal (bone `#FFFCEF`, linen, pine, moss, amber) and the older teal/rust/Geist palette must never be reintroduced. No bone, no cream, no beige, no gradients. Day surfaces are pure white; warmth comes from marigold, light and layer depth. Night canvas is char `#161D18`.
- Core tokens (DESIGN.md §2): paper `#FFFFFF`, marigold `#F5B301` (never as text on white; char text on marigold is the pair), char `#161D18`, forest `#1F4D2E` (day CTA, links, wordmark; hover `#143D22`), signal `#E84C30` for live dots and stops ONLY, park `#D9E8CC`, soft ink `#575F53`. Night: overlay cards `rgba(255,255,255,.06)`, surface dark `#10150F`, marigold CTA (hover `#E3A600`). Shadows always char or umber tinted, never grey.
- Type: DM Sans 700 display, IBM Plex Sans body and UI, IBM Plex Mono 600 for EVERY code, fare, plate, time, count and street label. Baloo 2 700 only inside the wordmark lockup. Use the exported `logo.svg` and `wordmark.svg` as-is; never rebuild or recolor the mark.
- Exactly one arrow glyph in the product: THE arrow paths from DESIGN.md §3 (forward, plus its mirrored back path). No chevrons, no other arrow shapes. Bespoke chunky rounded SVG only; no icon fonts, no icon libraries, no emoji anywhere in the product.
- One primary action per screen, with the exact §5 CTA anatomy: 58px row pill, label left, 40px round arrow chip right; forest with white label and marigold chip by day, marigold with char label and char chip by night (600 day / 700 night label weight, intentional).
- Motion (§12): svk-rise entrances (.6s ease-out, staggered .05–.95s), route draw then pins then kombis on map screens, kombi bob 2.4s, night headlight beam, press feedback `scale(0.99)` never a colour flash, everything respects reduced motion.
- Kombi map marker: the marigold rounded square box with bob and night glow is law; the glyph inside is the client's kombi asset. Never redesign the marker.
- Copy: second person and direct, short and concrete, sentence case (uppercase only for tiny meta labels), audit language flags patterns and never accuses a person.
- Agreed deviations from the reference files (recorded in `docs/DESIGN-DEVIATIONS.md`): the status bar in the references represents device chrome, so the web app never renders a fake one; and the app stays bilingual English/Shona from the translation file even though the references are English only. Every screen must look right in both languages and both themes.
- Mobile first always; reference device is a cheap Android at 360px on a slow connection. Bundle discipline: no heavy libraries for small jobs.
- Conductor surface: fat finger first. Big targets, high contrast, one action per screen, works in sunlight, works offline, survives a moving kombi.
- Offline first is architecture, not a feature: conductor PWA syncs a local ticket cache; queued writes reconcile with first sync wins and conflicts flagged.
- Accessibility is in scope: screen reader labels, large text mode, the voice guidance doubles as the accessibility channel (free tier for blind and low literacy riders).
- Language: every rider facing string exists in English and Shona from the start (Ndebele is roadmap). No hardcoded English in components; strings live in a translation file.
- No dark patterns, no queue privileges for digital riders, cash always accepted. These are product law from the ZUPCO post mortem.

## Skills to invoke

`frontend-design` for rider, conductor, and owner surfaces · `security-review` on anything touching money, codes, tickets, or auth · `systematic-debugging` when stuck · `verification-before-completion` at every phase gate · `humanizer` on all prose · `pptx`/`pdf` for the deck and proposal export · `docx` only for intermediate drafts (final proposal is PDF per rules).

## Validation before any "done"

```bash
pnpm typecheck && pnpm lint && pnpm test        # every task
pnpm test:e2e                                    # phase gates
pnpm db:security-test                            # RLS proof, phase gates and any auth/RLS change
```

A failure means not done. Append one line per completed task to `docs/BUILD-LOG.md`: `<phase> | <task> | <commit> | <proof>`.

## Cut from code (slides only, do not implement)

Native app with crash detection and speed scoring · voice INPUT in Shona (waits for the phrase dataset) · real EcoCash/InnBucks API money movement (adapters + mock only) · USSD aggregator · WhatsApp Business API · ZUPCO integration · dynamic pricing · dispatch. If asked to build any of these, flag the conflict instead of building.

## The five inputs owed by Mhofu (blocking P0)

1. AI4I proposal submission deadline from the portal.
2. New empty GitHub repo + fresh Supabase project, access shared; old chat exposed PAT revoked.
3. Public repo yes/no (recommended: yes, judges score history).
4. A corridor ride slot for the real data day (P3) and any association contact.
5. One or two Zimbabwean voice artists willing to sign consent (P5); placeholder voice ships if not.
