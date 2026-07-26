# V5 gate report: rank pulse (loading now)

Status: PASSED (built and proven 2026-07-26). One open question for Mhofu at
the bottom.

Scope: docs/PRODUCTION-PUSH-PLAN.md batch V5, ruled 2026-07-16. Counting
boarded fares against a vehicle's seat capacity gives a live fill state per
kombi at the rank. A count, not AI, documented as such.

## The blocker found before any code was written

The batch assumed fares are linked to vehicles. They were not. `p_vehicle`
has been a parameter of `redeem_board_code` since migration 0018, but the
hwindi surface never sent one, so every `ticket_events` row in the database
carried a null `vehicle_id`. That is the real reason the K1 board could only
ever show the unverified default, and it meant "fill state per kombi" had no
data to stand on at all.

Put to Mhofu as a product decision before building (CLAUDE.md rule 4). Ruled
2026-07-26: **add the kombi to the conductor shift.** One step, own fleet
only, skippable. Explicitly a shift declaration and nothing more: no crew
record, no roster, no assignment, no dispatch. N1 stays out of scope.

## What V5 delivered

- **Migration 0041.** `private.pulse_window()` holds the 20 minute window in
  one place. `public.conductor_vehicles()` is the picker's door: security
  definer, the calling conductor's own fleet only, and it returns id, plate
  and seats and nothing else, so riders still cannot read the vehicles table
  (owner scoped since 0001). `public.kombi_board()` v3 keeps the exact
  aggregate contract of 0032 and 0037 and adds two columns: `pulse_fares`,
  the redeemed fares stamped on that vehicle inside the window, and
  `pulse_window_minutes`, the window itself, so the app never hardcodes a
  number the database chose. No rider id, conductor id or ticket id leaves
  the function, which is why it can keep facing guests.
- **The kombi step (conductor).** After route and direction, the hwindi picks
  which kombi they are on. The shift, cached in IndexedDB like the route, now
  carries the vehicle, so an app killed mid shift reopens on the same kombi.
  The plate rides in the keypad header as a pill that taps back to the picker
  (hwindi do swap vehicles in a day). "Not saying today" skips it and clears
  fares exactly as before. A conductor whose fleet has no vehicles on record
  never sees the step.
- **Every clear is stamped.** Online redemptions pass the shift vehicle to
  `redeem_board_code`; queued offline redemptions carry `vehicleId` on the
  event and replay it to `sync_offline_redemption`, so a fare cleared in a
  dead zone lands on the kombi it was actually cleared on, not whichever one
  the phone is on hours later at sync time.
- **The rider card.** `apps/web/src/lib/kombi/pulse.ts` turns the count and
  the declared seats into one of four states with named thresholds: quiet,
  loading, filling (half the seats), almost (85 percent, "nearly full, leaves
  soon"). A vehicle with no declared seats is counted but not measured. The
  row sits in the shared `KombiFacts` block, so the marker card and every
  board row carry it and can never drift apart, and it prints its own basis
  line ("Counted from fares conductors cleared in the last 20 minutes"), so
  nothing on the card can be read as a departure time.
- **The count is never clamped.** A kombi that clears more fares than it
  declared seats shows the raw number. Hiding that would launder a real
  contradiction that belongs to the trust rail (drift), where K1 already
  surfaces it as a pattern on a ledger, never a person.

## Gate proof

| proof | result |
| --- | --- |
| unit: fill state from fare events | `apps/web/test/kombi-pulse.test.ts`, 12 tests green (four states, the silent default, both thresholds inclusive, no-seats case, raw over-capacity count, negative and fractional guards) |
| unit: the pulse survives the registry join | `apps/web/test/kombi-fleet.test.ts`, 6 tests green (2 new: pulse carried through, no registry row means no pulse rather than a quiet one) |
| e2e: conductor clears fares, rider card updates | `apps/web/e2e/v5-rank-pulse.spec.ts`, 2 tests green. Test 1 reads the rider's card for one plate, has the hwindi declare that exact kombi and clear a real fare, then asserts the card moved by exactly one and still states what it counted. Test 2 proves the step is skippable and the fare still clears with no kombi implied |
| e2e: K1 board did not regress | `apps/web/e2e/kombi-board.spec.ts`, 2 tests green, and rewritten to be honest: it used to assert a flat "unverified", which held only while no fare carried a vehicle. It now asserts the chip shows exactly the state each kombi's own ledger counts imply, plus the rule that must hold forever (no verified history means unverified, never a courtesy upgrade) |
| RLS | `pnpm db:security-test` 218 passed, 0 failed, 0 skipped (was 213). KB-5 pins the pulse pair as plain counts, KB-6 and KB-7 refuse the fleet door to a rider and to anon, KB-8 proves a conductor whose employer runs no vehicles gets nothing back even though the registry is full, KB-9 pins the fleet row to plate and seats. The GS guest column check learned the two new aggregate columns |
| unit suite | 434 tests green (223 web, 85 shared, 37 conductor, 89 spine) |
| typecheck, lint | clean |
| evidence | `docs/design-evidence/rank-pulse/`, board at 360px in both themes and both languages, showing a loading kombi beside quiet ones |

The evidence shots cost real fares. `apps/web/scripts/rank-pulse-evidence.mjs`
buys cash tickets through `purchase_ticket` as the demo rider and clears them
through `redeem_board_code` as the demo conductor with the vehicle stamped
the way the hwindi surface stamps it. Nothing writes `ticket_events`
directly, because the count on the card IS the fare ledger and seeding it
would be a lie. `ticket_events` is append only, so those fares cannot be
cleaned up afterwards; the script keeps the number to three per run and the
dataset statement names them as team test artifacts.

## M4 slice landed with this batch

Every `kombi_board` lateral scans `ticket_events` by vehicle over a time
window, and the only index on that table was `(ticket_id, created_at)`.
Migration 0041 adds `ticket_events_vehicle_recent_idx` on
`(vehicle_id, created_at desc) where event_type = 'redeemed'`, which matches
all four existing laterals and the new pulse count.

## Adversarial pass

- **What a judge pokes:** "is this AI?" No, and the card says what it counted
  and over how long, in both languages. The AI usage map has its own paragraph
  saying a model would add nothing because the ledger already knows.
- **What breaks on stage:** nothing new in the ride path. If the hwindi skips
  the step every card reads quiet, which is the truth. If the database is
  unreachable the board renders as it did before V5.
- **What a hostile user does:** a rider calling `conductor_vehicles` is
  refused (KB-6); a guest too (KB-7); a conductor cannot see another fleet's
  kombis (KB-8). Nothing about a person is on the card. A conductor cannot
  stamp a vehicle outside their own fleet either, because `redeem_board_code`
  has raised on that since 0018.
- **The honesty trap avoided:** clamping the count at the declared seats
  would have made every card tidy and quietly erased the drift signal.
- **The dignity check:** the copy names the kombi ("nearly full, leaves
  soon"), never the hwindi. The conductor's own why-line says it plainly:
  riders see how full it is getting, nobody sees who you are.

## Open question for Mhofu

1. **The 20 minute window and the two thresholds** (half the seats is
   filling, 85 percent is nearly full) are engineering defaults, named in one
   place each and easy to change. They have never been checked against a real
   rank. Worth one corridor observation on the P3 data day: how long does a
   kombi actually sit at Copacabana, and at what point do riders start
   walking to the next one? Until then the numbers are honest but untuned,
   and this report says so.
