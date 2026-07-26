# V6 gate report: send a ride, not money

Status: PASSED (built and proven 2026-07-26). One open question for Mhofu at
the bottom.

Scope: docs/PRODUCTION-PUSH-PLAN.md batch V6, ruled 2026-07-16. Buy a board
code for someone else from your wallet, extending credit transfers (0011) to
ticket gifting: the recipient needs no wallet, just the code, delivered
through the phone's own share sheet. Redemption stays code scoped and rate
limited per board codes v2. Diaspora fare gifting stays a slide.

## What V6 delivered

- **Migration 0043, one row and one refund.** `ticket_gifts` marks a ticket as
  bought for somebody else. It exists because the sender is the ticket's
  `rider_id` (they paid, and the ledger must say who paid) while not being its
  rider in any real sense. `gift_ticket` delegates to `purchase_ticket` rather
  than copying it, so fare lookup, stop validation, the plausible fare rail,
  the balance check, the board code allocation and the issued event stay one
  implementation and a gift can never drift away from a purchase.
- **Nothing changed at the kombi door.** A gifted code is a board code. The
  hwindi clears it through the same route and direction scoped, rate limited
  RPC, with the same attempt logging. Not one line of the redemption path was
  touched for this feature, which is the strongest thing this report can say
  about it.
- **The first refund in Svika's history.** Until now money only ever moved
  forward. `revoke_gift` takes the same ticket lock `private.apply_redemption`
  takes, checks the status under it, appends a `cancelled` event and posts a
  two sided transaction returning exactly the fare from escrow to the wallet
  it came from. Revoke twice and the second call finds a cancelled ticket and
  refuses. Revoke a boarded ride and it refuses. Revoke somebody else's gift
  and it answers `not_your_gift`, the same answer a ticket that does not exist
  gets: no oracle.
- **The recipient does not exist.** Svika never asks who the ride is for and
  stores nothing about them. The share payload is TEXT, not a link, because
  the recipient has no app to open: "I have paid your kombi fare. 2nd boom
  gate to Rezende Rank. Show the hwindi this code: 9000. It works until
  20:47." The card says so on screen: "Svika never learns who you sent it to.
  Your own phone carries the message."
- **A gifted ride is not the sender's trip.** It is filtered out of the home
  rides list (they must never be offered to board it) and out of the commute
  pattern miner's raw material (it must never learn a habit nobody has). It
  lives on the wallet screen beside credit transfers, which is where the
  street moment it answers already lives, and drops off that list on its own
  once somebody boards.
- **Cash gifts are impossible by construction.** `gift_ticket` allows only the
  wallet path: an unpaid reservation is not a gift, and there would be nothing
  to take back.
- **Transfers are refused plainly.** A trip that changes kombi cannot be one
  code, so the plan screen says that in both languages rather than gifting
  half a journey the recipient cannot finish.

## Gate proof

| proof | result |
| --- | --- |
| ledger invariants extended to gifted tickets | `pnpm db:ledger-test` 18 passed, 0 failed (was 8). I6 buys a gift and proves the wallet drops by exactly the fare, takes it back and proves the wallet returns to exactly where it started (no money made or lost), proves a second take-back refunds nothing and moves nothing, proves another rider can neither take it back nor learn it exists, proves a gifted code clears at the kombi like any other, and proves a boarded ride cannot be taken back |
| e2e: gift, share card, recipient boards | `apps/web/e2e/v6-gift-ride.spec.ts` test 1. Gifts from the plan screen, reads the code off the share card, proves the fare left the wallet, forces the clipboard path and asserts the message that would travel carries the trip, the code and the hwindi instruction, proves the ride is absent from the sender's own rides list and present on the wallet, then has the hwindi clear it and watches it drop off the wallet |
| e2e: revocation before redemption | same file test 2. Takes the gift back, proves the wallet is exactly back to its starting cents, then proves the code is dead at the keypad |
| RLS | `pnpm db:security-test` 231 passed, 0 failed, 0 skipped (was 224). GF-1 to GF-7: the sender sees their own gift, another rider cannot see that a ticket was gifted at all, anon sees zero, no client writes the table, another rider's revoke learns nothing, and a guest cannot buy a ride for anyone |
| unit suite, typecheck, lint | 457 tests green, clean |
| evidence | `docs/design-evidence/gift/`, the share card at 360px in both themes and both languages |

The evidence script buys a real gift through the app's own RPC and takes it
back at the end, so the demo wallet finishes where it started and no fare is
stranded on a code nobody will use.

## Adversarial pass

- **What a judge pokes:** "so you built a WhatsApp integration?" No. There is
  no messaging vendor anywhere. The phone's own share sheet carries text the
  sender wrote nothing into; Svika is not in the delivery path and cannot be.
- **What breaks on stage:** desktop Chromium has no `navigator.share`, so the
  button copies instead, which is exactly the fallback a laptop demo needs.
  The e2e pins that path deliberately.
- **What a hostile user does:** guess a gift code? It is a four digit board
  code with the same v2 scoping and rate limiting as every other, and nothing
  about gifting widens that. Take back somebody else's gift? Refused, with no
  information leaked. Read who a gift was for? There is nothing to read.
- **The money question I went looking for:** double spend. A revoke racing a
  conductor's clear takes the same advisory lock the redemption takes, so one
  wins and the other finds a status it refuses to act on. I6 proves both
  orders end with the ledger summing to zero.
- **The honesty trap avoided:** it would have been easy to store a recipient
  name "for the sender's convenience" and quietly build a contact graph. The
  feature is better without it and the register says so.

## Open question for Mhofu

1. **Validity window for a gifted ride.** A gift is valid for four hours,
   against two for a rider's own ticket, on the reasoning that the recipient
   has to see the message, read it and get to a rank. That number is a guess.
   Too short strands the fare in escrow and forces the sender to take it back
   and start again; too long leaves live codes drifting around. Your call, one
   named default.
