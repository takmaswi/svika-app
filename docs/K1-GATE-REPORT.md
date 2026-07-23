# K1 gate report: kombi board

Status: PASSED (closed 2026-07-24). Mhofu's rulings recorded below; Goal 4
signed off.

Scope: docs/PRODUCT-FIRST-PLAN.md batch K1, ruled 2026-07-23. The rider
facing answer to "which kombi, and can I trust it": tappable kombi markers
opening a kombi card, a board view of every kombi on the corridor, a trust
profile derived by rules from what exists today, riding the simulated
VehicleFeed with the standing provenance grammar. N1 crew identity not
built; marker asset pipeline untouched; database additive only.

## What K1 delivered

- **Tappable kombi.** Every marker on the live map is now a real button
  (click, Enter, Space; `role="button"`, aria label) opening the kombi card
  in the browser top layer: plate (IBM Plex Mono), route direction line,
  live ETA to the rider's stop with the standing basis label grammar,
  declared seats, the trust record, the provenance line, and one section 5
  CTA to the board. The marker asset pipeline is untouched
  (`makeKombiElement` still ships the same SVG; only attributes and
  listeners were added). `apps/web/src/components/kombi/KombiCard.tsx`,
  `LiveMap.tsx`.
- **Board view.** `/app/kombis`: all four corridor kombis as the same facts
  block the card shows (one shared component, `KombiFacts.tsx`, so the two
  surfaces cannot drift), one tap from the map home via the Kombis header
  chip, plus the card CTA. Rows are section 8 cards with the section 12
  rise stagger.
- **Trust profile, rules only.** `apps/web/src/lib/kombi/trust.ts`: three
  states from ledger counts. Unverified is the default and needs no data;
  verified fares needs 10 redeemed fares across 3 distinct days in 30 days;
  drift (red, meaning unverified against facts) fires when any day's
  busiest hour cleared more fares than the declared seats, and drift
  outranks verified. The counts come from the additive `kombi_board` RPC
  (migration 0032): aggregates only, authenticated riders, no person or row
  ids, proven by four new RLS checks. Because the conductor flow does not
  stamp vehicles on redemptions yet, the fare ledger holds zero vehicle
  linked fares: every kombi truthfully shows unverified today, and the e2e
  asserts exactly that. The verified and drift states are exercised by the
  unit suite and light up as real data arrives; nothing is staged to look
  better than it is.
- **Feed honesty.** The card and board ride the existing simulated
  VehicleFeed. The per vehicle wait is the spine's number measured from the
  same simulated position the map draws; the fallback is the simulation's
  own clock (`sim-eta.ts`), labelled demo estimate like every mock number.
  A kombi heading the other way, or past the stop, says so instead of
  inventing a wait — except at the direction's origin rank, where a kombi
  finishing the opposite leg is the next departure and its arrival is the
  honest wait (the same terminus rule as the home estimate, eta-live.ts). Provenance is labelled on the card, the board and the
  register; real positions from conductor shift GPS are a roadmap note
  behind the same adapter, not built. N1 crew identity not built.
- **Both languages, both themes, 360 first.** All strings in
  `dict.ts` under `kombi.*` (Shona machine drafted, translator pass still
  owed); trust chips have day and night treatments; evidence pack at
  `docs/design-evidence/kombi-board/`.

## Gate proofs

- **e2e tap kombi → card → board:** `apps/web/e2e/kombi-board.spec.ts`,
  2/2. Card asserts the registry plate, the live wait row, the provenance
  line and the unverified default; the board asserts four rows and the one
  tap door from home. Full suite: see validation wall below.
- **Unit tests for trust derivation:** `apps/web/test/kombi-trust.test.ts`
  9/9 including the no facts and zero history defaults, threshold edges,
  drift precedence and the no declared capacity case. Plus
  `kombi-sim-eta.test.ts` 7/7 (the honest fallback clock),
  `kombi-fleet.test.ts` 4/4 (registry bridge, unverified on any miss) and
  `kombi-vehicle-eta.test.ts` 3/3 (the rank terminus rule): 23 new tests,
  suite total 188.
- **Screenshots day/night × EN/SN:** `docs/design-evidence/kombi-board/`
  (8 captures, card and board).
- **AI-USAGE-MAP row:** "Kombi trust states (K1)" under What is NOT AI at
  all — fixed rules and counts, file references, never a person.
- **Disclosure register row:** "Kombi card and board", Tier 2, in
  `docs/DISCLOSURE-REGISTER.md` and `apps/web/src/lib/disclosure.ts`
  (mirrored on /register): simulated position, staging registry, real rules
  over a ledger that holds no vehicle linked fares yet.
- **RLS proof:** `pnpm db:security-test` 114/114, including KB-1..KB-4
  (anon refused, rider reads aggregates only, no identifiers in rows, the
  vehicles table itself stays closed).

## Validation wall

| check | result |
| --- | --- |
| pnpm typecheck | clean |
| pnpm lint | clean |
| pnpm test | 188/188 (23 new K1 tests) |
| kombi-board e2e | 2/2 |
| pnpm db:security-test | 114/114 |
| full e2e suite | see the honest note below |

**Full e2e honesty note (run of 2026-07-24, 23:44–00:20 CAT).** The full
52 test suite first came back 43 passed / 9 failed. Every failure was then
rerun in one clean pass with fresh servers: 11 passed, 2 skipped by their
own clock guards, and exactly one stayed red — `share.spec.ts` "mint,
follow without an account, revoke", the share mint red already known on
this branch's opening baseline, predating K1. Of the transient eight, the
kombi board navigation timeout was hardened (route priming plus an honest
timeout; a console probe proved card, endpoint and navigation all serve),
and the rest were dev server stalls under suite load plus two clock staged
commute and answer home tests that ran exactly as the wall clock crossed
midnight — the failure screenshot shows the peek honestly answering "your
ride back" while the float carried the outbound trip, which is the staging
moment drifting past the mined window, not an engine bug. Those specs
passed in the clean rerun. No K1 change touches the commute, saved trip,
share or theme code paths.

## Rulings (Mhofu, 2026-07-24)

1. **Deviations 6–9 all RATIFIED** (docs/DESIGN-DEVIATIONS.md): card as
   top layer dialog over the map; board rows as section 8 cards; trust
   chip colours with signal red for drift — ruled a correct extension of
   the signal ONLY rule because red is against facts, never character; the
   Kombis header chip.
2. **CHECKS item 11 approved and CLOSED** as staging placeholders: the
   invented plates, 16 declared seats and the 10 fares / 3 days / 1 drift
   day thresholds stay as named constants. Real plates and per vehicle
   seats arrive with owner enrolment; threshold tuning waits for real
   vehicle linked fares (N1 substrate).
3. **Roadmap note, not built:** real positions and vehicle stamped
   redemptions arrive with conductor shift GPS (N1 substrate); when
   conductors start recording which kombi they work, the trust surface
   fills by itself with no further schema or UI change.

## Plain language summary

Tap any kombi on the map and a card tells you what it is: its plate, where
it is heading, how many minutes to your stop, how many seats it declares,
and an honest trust record. Today every kombi says "unverified" because no
conductor has cleared fares against a specific vehicle yet — that is the
truth, and the app refuses to pretend otherwise. When fares start being
recorded per kombi, good records show up as verified, and a kombi whose
busiest hour clears more fares than its declared seats gets flagged as a
pattern on that vehicle, never as an accusation against a person. A Kombis
button on the home screen lists all of them at once. The moving dots are
still the simulation, and every screen says so.
