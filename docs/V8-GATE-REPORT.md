# V8 gate report: demand beacon (signal, never dispatch)

Status: PASSED (built and proven 2026-07-26). No open questions; one standing
guard note at the bottom.

Scope: docs/PRODUCTION-PUSH-PLAN.md batch V8, ruled 2026-07-16. A waiting rider
taps "I'm at the turn-off heading to town"; conductors on that route see
anonymous rider counts ahead. Hard boundary from Mhofu's cut list: a glanceable
signal, never an assignment or dispatch system. No rider identity reaches the
conductor, counts expire quickly, and the conductor surface stays one action
per screen.

## How the boundary is enforced

Not by copy, and not by discipline. By schema, so it cannot drift:

1. **Nothing to identify.** `beacon_counts` returns `(stop_id, stop_name, seq,
   waiting)`. There is no rider id, no name, no phone, no timestamp, no
   destination and no beacon id in its result type, so a conductor cannot learn
   who is waiting, when they arrived or where they are going. The RLS suite
   pins that exact column set (DB-6).
2. **Nothing to read around it.** Conductors have no select policy on
   `demand_beacons` at all. Their only door is the counts function, which is
   itself assignment gated exactly like the offline code cache (0018): demand
   for a route you do not work is not yours to see.
3. **Nothing to answer with.** No table in migration 0044 can record a
   conductor responding to a beacon. There is no accept, no claim, no assign,
   no acknowledge and no "on my way", so a dispatch feature cannot be added by
   wiring up a button: it would need a new table and a new ruling. The e2e
   asserts there is no control on that screen and no row is a button, and
   fails if one appears.
4. **Nothing stale.** Twenty minutes, then the beacon stops counting itself. A
   rider who boarded and went home cannot send a kombi to an empty stop.
5. **Nothing accumulated.** No history table, no archive, no rollup. Expired
   beacons simply stop mattering, so this cannot quietly become a demand
   dataset.

The conductor's screen says the same thing in words, in both languages: "A
count, not an instruction. Nobody is assigned to you and you answer to nobody
here." The rider's card says its half before they tap: "Hwindi on this route
see how many people are waiting, never who. Nobody can be sent to you, and
nobody can answer this."

## What V8 delivered

- **Migration 0044.** `demand_beacons` (rider, route, direction, stop, twenty
  minute expiry), `raise_beacon` (validates the stop is on that route
  direction, caps raises per rider per hour, and ends the rider's previous
  beacon because a person is in one place), `withdraw_beacon`, `my_beacon` and
  `beacon_counts`.
- **`my_beacon` exists for a reason worth stating.** The rider's own row is
  readable under RLS, but "is it still live" must be answered by the
  database's clock, not by whichever machine renders the screen. A web server a
  few seconds behind Supabase would otherwise keep showing a withdrawn beacon
  as live, which is a small lie about something a rider explicitly asked to
  stop. The test suite found this before the product did.
- **Rider surface.** On the kombi board, which is the screen a rider opens
  while standing at a rank. One tap, then the live state with the minutes left
  and one way out ("I have gone"). Plain full width button rather than the
  section 5 CTA anatomy, deliberately: the one primary action on that screen
  is still the board itself.
- **Conductor surface.** A "3 waiting" pill in the keypad header, tapping into
  a read only list of every stop on the route with its count, ordered along the
  route. Stops with nobody waiting are dimmed rather than hidden, so the shape
  of the route stays readable at a glance in sunlight. One back button.

## Gate proof

| proof | result |
| --- | --- |
| RLS: counts only, no identities | `pnpm db:security-test` 240 passed, 0 failed (3 pre-existing rate limit self skips from back to back runs). DB-1 to DB-15: a rider sees only their own beacon, another rider and anon see none, the conductor's counts carry exactly four columns and none of them is a person, the conductor cannot read the beacon table, no client can write one, riders and guests cannot read demand at all, one rider holds one beacon, and withdrawing drops the count |
| expiry | `pnpm db:beacon-test` 6 passed, 0 failed. A raised beacon counts; its life is between five and thirty minutes; aged past its expiry it stops counting with nobody withdrawing it; the rider's own screen agrees; and expiry is not a lockout |
| e2e: the whole chain and the boundary | `apps/web/e2e/v8-demand-beacon.spec.ts`, 2 tests green. A rider raises, the hwindi's pill appears, the list shows the count, the law line reads in Shona and then in English, no row is a button and no control offers to accept, assign, claim, dispatch, pick up or say on my way. Second test: withdrawing drops the count on both sides |
| conductor surface screenshot | `docs/design-evidence/beacon/beacon-hwindi-sn.png` and `-en.png`, 360px, light mode on purpose because that surface is built for sunlight |
| rider card | `docs/design-evidence/beacon/beacon-rider-{light,dark}-{en,sn}.png` |
| unit suite, typecheck, lint | 457 tests green, clean |

## Adversarial pass

- **What a judge pokes:** "isn't this just Uber for kombis?" No, and the
  difference is structural rather than rhetorical: there is no way to accept a
  rider, no way to be assigned one, and no record of a conductor having
  responded. A hwindi looks at a number and decides for themselves, exactly as
  they do now by looking out of the window.
- **What a hostile conductor does:** try to see who is waiting. There is
  nothing to see: the counts function cannot return it and the table is closed
  to them (DB-6, DB-8). Try another fleet's route: refused by the assignment
  gate.
- **What a hostile rider does:** inflate a stop by tapping. One rider holds one
  live beacon, so tapping repeatedly moves their own beacon rather than adding
  to a count, and raises are capped per hour.
- **What breaks on stage:** nothing. With no beacons the pill is absent and the
  conductor surface is exactly what it was.
- **The thing I watched for while building:** every convenience that would have
  drifted toward dispatch. Showing the conductor how long someone had been
  waiting (a queue). Ordering stops by demand rather than by route (a
  worklist). Letting a hwindi mark a stop as covered (an assignment). None of
  them shipped, and the schema makes each of them a visible change rather than
  a quiet one.

## Standing guard note

If a future batch proposes that a conductor respond to a beacon in any way,
including something as mild as "seen", that is dispatch arriving through the
side door. It needs Mhofu's ruling before a line of it is written. This report
and the migration header both say so, and the e2e will fail loudly.
