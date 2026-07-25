# V3 gate report: guardian mode (travel with me, and family)

Status: PASSED AND CLOSED (built and proven 2026-07-25; all four open
questions ruled by Mhofu 2026-07-26, rulings recorded at the bottom).

Scope: docs/PRODUCTION-PUSH-PLAN.md batch V3, ruled 2026-07-16. Ties ride
shares (0026), the emergency next of kin (0023) and the ticket event
stream together: one tap on the ticket shares the live trip with the
guardian contact, safe arrival reaches whoever is watching, a trip that
runs long is flagged as a situation, and family accounts link with mutual
confirm under the dignity law: the child's app always shows a visible
chip, no silent tracking, ever.

## What V3 delivered

- **Schema (migrations 0035 + 0036).** 0035 adds the `arrived` ticket
  event value alone (the enum split law). 0036 builds `guardian_links`:
  a link starts as a guardian's invite (12 hex code, 7 day expiry) and
  becomes active ONLY when the child enters the code signed in as
  themselves, so mutual confirm is structural, not copy. Either side
  revokes instantly. Invite redemption is rate limited (5 misses in 10
  minutes) with every attempt logged in `guardian_link_attempts` (the
  board codes v2 law applied to family), and failures return outcome
  strings instead of raising so the log survives the transaction (the
  0004 redeem lesson, relearned). Clients have no write path: RPCs are
  the only doors. The guardian's whole window is `guardian_child_trips`:
  route, endpoints, status and timing of the linked child's recent fare
  trips. Deliberately excluded: board codes, fares, wallet, journeys,
  saved trips, coordinates. `mark_ticket_arrived` appends the rider's own
  arrival to the append only stream (never UPDATEs, one shot), and
  `ride_share_view` plus `create_ride_share` learn the arrived status so
  a shared link shows "arrived safely" instead of dying with the ride.
  `anonymise_me` now also revokes every live link touching the caller:
  "delete everything" must stop anyone watching.
- **The child visible chip (dignity law).** While any guardian link is
  active, the /app layout wears a park toned "Guardian sees your trips"
  chip on EVERY screen, both languages, both themes; tapping it opens the
  family page where the off switch lives. It stacks below the demo chip
  when both apply. The chip's data source is the child's own RLS read of
  `guardian_links`, so nothing the guardian does can hide it.
- **Family page (/app/family).** The child's side comes first: who sees
  your trips, since when, one tap to end it, and the code entry with the
  plain promise ("booked, on the kombi, arrived. Never where your phone
  is."). The guardian's side mints and hands over the code, then shows
  each linked person's latest trip as a state banner: booked / on the
  kombi (neutral), arrived safely (park), taking longer than usual
  (marigold, the deviation 12 grammar), ended without a check-in (soft).
  States are pure rules in `apps/web/src/lib/family/trip-state.ts`
  (typical duration + a named 15 minute buffer); every line of copy flags
  the trip, never a person, in both languages.
- **Travel with me on the ticket.** The 0023 next of kin fronts the 0026
  share: with a guardian contact saved, the share section becomes "Travel
  with me" naming them, one tap mints the link, and a share sheet button
  (Web Share API, clipboard fallback) carries it through the phone's own
  apps: no SMS vendor, no WhatsApp API (both stay cut). Without a contact
  the generic share stays, with a pointer to the profile.
- **Safe arrival.** A live or boarded ticket carries "I have arrived
  safely": one tap, rider only, appended to the event stream. The ticket
  stamps arrived, the shared link flips to "Arrived safely" (park tone)
  instead of dying, and the guardian's family page shows it.

## Gate proof

1. **e2e guardian link, child rides, guardian sees arrival**
   (`apps/web/e2e/family.spec.ts`, 1/1 passing, 39s): the owner account
   (guardian) mints a code; the rider (child) first enters a wrong code
   (named error, never silence), then the real one; the chip is asserted
   on the child's home AND wallet screens with the exact English and
   Shona texts; the child books a corridor fare through the real pay
   path; the guardian's family page shows `data-state="booked"` and the
   guardian's screen carries no dollar figure anywhere (asserted); the
   child taps arrived; the guardian sees `data-state="arrived"`; the
   child ends the link and both the guardian's window and the chip are
   asserted gone.
2. **RLS matrix**: `pnpm db:security-test` **164/164** (23 new GD
   checks): a guardian sees exactly the linked child's trips and nothing
   else (GD-11/12), no codes, fares or wallet fields in the window
   (GD-13), direct ticket and journey reads stay walled despite the link
   (GD-14/15), the child always sees the link and never the unredeemed
   code (GD-8/9), only the rider marks arrival and only once (GD-16/18),
   arrival reaches guardian and shared link (GD-19/20), revocation closes
   the window instantly (GD-22), no direct writes (GD-21), anon sees and
   mints nothing (GD-3/4), wrong codes are logged and rate limited with
   no oracle (GD-5/23).
3. **The chip in both languages**: e2e asserted ("Guardian sees your
   trips" / "Muchengeti anoona nzendo dzako") and captured at 360px in
   both themes: `docs/design-evidence/family/guardian-chip-{light,dark}-{en,sn}.png`,
   plus the family screens from both sides, the travel with me ticket
   section and the guardian's arrived state (9 shots,
   `scripts/family-evidence.mjs`, real doors only).

Checks: `pnpm typecheck` green, `pnpm lint` green, `pnpm test` green
(shared 73, web 208 incl. 6 new trip state tests, spine 89, conductor
37), `pnpm db:security-test` 164/164, e2e family + share + profile +
book 15/15.

## Decisions taken inside the ruled scope (flagged, not silent)

- **"Notifies on safe arrival" without a messaging vendor.** SMS and
  WhatsApp stay cut, so the notify moment is: the shared link flips to
  "Arrived safely" for whoever holds it, and a linked guardian sees the
  arrival on the family page. No push infrastructure was invented for
  this batch; if push notifications are wanted they are their own slice.
- **"Goes dark" reading.** A trip that ends without the rider's arrival
  tap shows "ended without a check-in" with reach-them-your-usual-way
  copy; a redeemed trip past typical duration + 15 minutes shows "taking
  longer than usual". Both flag situations; neither invents certainty
  the data does not carry.
- **Arrival is a rider tap, not a geofence.** Automatic arrival from GPS
  would silently track; the tap keeps the rider in charge and costs one
  touch. The alight guidance cues (D1) already prompt at the stop.

## Known limits, stated

- The family page reads at page load; a guardian watching live refreshes
  to update (no polling, no websockets this batch).
- `demo_reset_mine` does NOT clear guardian links (demo machinery frozen
  by branch law): a pooled judge persona could inherit a link from a
  previous judge. Flagged as an open question below.
- Guardian invite codes are typed, not tapped: a shareable invite LINK
  would be smoother but puts the code in a URL; typed entry keeps it out
  of messaging history. Revisit if fieldwork says typing 12 hex chars is
  too much.
- The rate limit lock (5 misses / 10 min) is per rider, so the RLS
  suite's own probe locks the test guardian for 10 minutes; the suite
  skips the self-accept check with a named SKIP when re-run inside the
  window (same pattern as the conductor redemption checks).

## Rulings (Mhofu, 2026-07-26)

1. **Chip tone RATIFIED as proposed.** The guardian chip is calm
   information in the park/char info grammar, never a warning colour.
   Recorded as deviation 13 in `docs/DESIGN-DEVIATIONS.md`.
2. **Demo-pool guardian-link gap accepted as a PERMANENT gap.** Pooled
   demo personas never guardian-link; `demo_reset_mine` stays frozen and
   nothing is built. This paragraph is the documentation.
3. **Arrival tap: YES, prompted.** When the alight guidance fires its
   at-the-stop cue, the app now offers the one tap arrival confirm as a
   skippable prompt (`voice-arrive` in `VoiceGuide.tsx`, positioned above
   the peeking sheet like the commute alert; `promptsArrival` in
   `lib/voice/triggers.ts`). Never auto confirmed: arrival stays the
   rider's word, the prompt just makes it easy, and dismissing it skips
   it for the whole ride. Proven in `e2e/d1-destination.spec.ts` (the
   alight guidance test now walks through prompt, dismiss door visible,
   confirm tap, ticket stamped arrived) plus a unit test on the cue rule.
4. **Relationship neutral copy: YES, everywhere.** Audit result: every
   family/guardian string already said "guardian" / "someone you trust" /
   "the person you will watch over"; the one violation was the profile's
   "Next of kin" labels, now "Guardian contact name/phone" in both
   languages (`profile.kinName`/`profile.kinPhone`; the 0023 column names
   are schema, not copy, and stay). The Rudo persona naming a mother
   remains story flavour only.
