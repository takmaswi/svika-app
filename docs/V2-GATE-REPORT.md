# V2 gate report: guest mode

Status: AWAITING RULINGS (built and proven 2026-07-25; open questions for
Mhofu at the bottom).

Scope: docs/PRODUCTION-PUSH-PLAN.md batch V2, ruled 2026-07-16. The map,
live ETAs, trip planning and fares work logged out and read only. The OTP
wall moves to the moments that need identity: paying, saving a trip,
recording a journey (naming a place waits for M3, which is not built).
The sign in prompt says exactly why an account exists. The consent gate
stays where it was, at account creation. Shared trip and guide links open
in guest mode and carry a door into the app.

## What V2 delivered

- **Zero migrations.** The entire guest surface is the anon role exactly
  as it has stood since migration 0002, whose own comment says "the
  network is world readable (anon + authenticated)" so planning can work
  before login. V2 finally cashes that cheque. No policy touched, no
  grant added: the no widening proof is that there is nothing to diff.
- **The guest home** (`components/home/GuestHome.tsx`): the same live
  map, search and corridor fare/arrival peek a rider sees, fed by anon
  reads of route_stops and route_fares plus the ETA provider. No wallet,
  no tickets, no personal panel exists to fake. The sheet carries "Why an
  account exists" with the plain promise (remember you, your trips, your
  wallet) and the sign in CTA. A "Sign in" chip leads the header row (at
  360 the disabled ND hint clips, CHECKS item 8, never the sign in door).
- **The layout gate** admits logged out visitors: the consent gate now
  guards ACCOUNTS (unchanged for anyone signed in); a guest holds no data
  to consent over. The old middleware blanket redirect on /app is gone;
  every personal page keeps its own `redirect("/login")` (audited: all
  sixteen /app pages self gate), so nothing personal ever renders for a
  guest even if a page were reached directly.
- **The wall at the exact moments.** On the plan screen a guest sees the
  route, the time, the fare and the leg list: identical planning to a
  rider. Where the pay buttons stood, one CTA reads "Sign in to pay" with
  the reason under it, linking `/login?why=pay&next=<the same plan>`.
  Saving a trip and recording a journey wall the same way with their own
  reasons (`why=save`, `why=record`). The login screen renders the exact
  reason above the phone form; `next` returns the rider to the plan they
  were on after OTP (same site paths only, no open redirect).
- **Shares are doors.** The ride share viewer and the journey guide
  viewer (both already public) now carry "Plan your own trip on Svika"
  into the guest home, and the landing offers "Look around first" beside
  sign in.

## Gate proof

1. **e2e plan a trip logged out, wall only at pay**
   (`apps/web/e2e/guest.spec.ts`, 3/3 passing): entering through the
   landing guest door, the guest home renders map, search and the
   corridor fare with no wallet text anywhere; free text heights to
   rezende plans a real trip showing total fare and the leg list; zero
   pay buttons exist (`.plan-pay button` count 0) while the sign in wall
   and save wall render; tapping the wall lands on `/login?why=pay` with
   the pay reason on screen. Second test: /app/record walls with the
   record reason; wallet, profile and family never render logged out.
   Third: the guest home speaks Shona.
2. **RLS no widening**: V2 shipped no migration (nothing to diff), and
   the suite now pins the guest surface: `pnpm db:security-test`
   **178/178** with 14 new GS checks proving anon reads exactly the five
   planning tables (stops, route_stops, route_fares, fare_segments,
   transfer_points) and zero rows of everything personal (saved trips,
   prefs, emergency details, ride shares, consent records, walk tails,
   journeys, guardian links), and cannot call purchase_ticket. Any
   future widening fails these checks loudly.
3. **Evidence**: guest home in both themes and both languages, the plan
   pay wall, and the login why screen at 360px
   (`docs/design-evidence/guest/`, `scripts/guest-evidence.mjs`).

Checks: `pnpm typecheck` green, `pnpm lint` green, `pnpm test` green
(shared 73, web 208, spine 89, conductor 37), `pnpm db:security-test`
178/178, guest e2e 3/3, full e2e suite: see the honesty note below.

## Decisions taken inside the ruled scope (flagged, not silent)

- **The middleware blanket guard came out.** Guest mode cannot exist with
  a blanket redirect, so authorisation now lives where it always really
  was: RLS underneath, and each page's own gate. The audit that every
  /app page self gates is in the e2e (personal pages redirect logged
  out) and in the GS checks (anon reads nothing personal even by hand).
- **Guests keep the theme and language toggles**: a cheap Android user
  evaluating the app deserves night mode and Shona before an account.
- **Naming a place** is listed in the plan as a wall moment but the
  places layer is M3, unbuilt; the wall will stand there when M3 lands.

## Known limits, stated

- The guest home's kombi board chip is absent: `kombi_board` is an
  authenticated RPC and widening it to anon was not ruled. The moving
  kombis on the map are visible to guests; the per vehicle card is not.
  Flagged as an open question below.
- A guest who plans a transfer trip sees the whole plan; the wall only
  stands at pay. This is the ruled behaviour (read only planning).
- `next` return after OTP is page level (back to the same plan); the
  chosen payment method is not carried through the wall.

## Open questions for Mhofu (V2 rulings)

1. Kombi board for guests: leave authenticated only (as shipped), or
   rule a public read of the aggregates (would need a 0037 grant, a
   deliberate widening with its own RLS checks)?
2. The landing keeps "Enter Svika" as the primary CTA with "Look around
   first" as a quiet second door. Right emphasis, or should the guest
   door be louder?
3. The guest home hides the Kombis header chip entirely. Alternative: show
   it walling to sign in. Preference?

## Honesty note: full e2e suite

Final full runs land at **59 passed, 1 failed (9 min)**: the one red is
the share mint spec under full parallel load, the SAME documented known
baseline red carried since the product branch opened (it passed green in
isolation twice today, including inside the V3 touched-suite run). Goal 6
also surfaced and fixed three pre-existing suite defects, each proven
pre-existing by reproducing on a baseline worktree at the pre-Goal-6
commit before touching anything:

- **Takunda fixture pollution** (v1 answer home cold open + commute
  alert home): every e2e run books a REAL wallet ticket as Takunda that
  can never be deleted (ledger FK, append only law), and those strays
  finally outnumbered the 14 fixture rides, dragging the mined median
  window off "now" (probed live: 57 tickets, median 56 minutes adrift).
  Fix in the spec helper only: the rebuild now stages 56 fixture rides
  (two per day across the miner's whole 28 day lookback, RPC cap 60), so
  the median stays pinned against any realistic stray mass. No product
  or demo machinery code touched.
- **Sign out test** expected logged out /app to bounce to /login; guest
  mode makes /app serve the guest home by design. The test now asserts
  the guest home with the sign in chip AND that a personal page (wallet)
  still bounces: a stronger assertion of the actual V2 contract.
- **"No recognised context" test** used DEMO_RIDER, whose suite made
  bookings have become a minable pattern; once profile.spec's pref
  toggle ran earlier in the same suite (the runner is single worker,
  specs share demo users by design) the peek legitimately answered. The
  test now uses the owner account (zero fare history), which is the
  premise it always meant.
- **Journey share vs journey recording**: both specs recorded as
  DEMO_RIDER, and the second run inherited the first's server side
  journey rows and consent stream state (a wandering full-suite red).
  The guide link spec now records as the owner: distinct profile, zero
  shared state between the two specs.
