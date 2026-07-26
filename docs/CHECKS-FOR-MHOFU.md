# Checks parked for Mhofu

Open questions and numbers that need your eyes. None of them block the build.
Work continues on documented assumptions; you review this list when phase 1
is done. Each item says what was assumed and what changes if you disagree.

Last updated: 2026-07-25.

## 1. Watchdog simulator numbers (task 5)

Every number in `services/spine/src/watchdog/config.ts` except the fare is my
invention and needs your smell test. The committed metrics regenerate in one
command (`pnpm watchdog:eval`) if any change.

- 4 kombis per owner, 90 days of history
- 20 one way legs per weekday (about 10 round trips), 14 on weekends
- 16 seats, average load 72% weekday and 58% weekend, jitter 10%
- 35% of fares digital, 45% of fares in the two rush windows
- Fare 150 cents, the measured flat corridor fare (the one real number)
- Leakage on 8% of days, usually one kombi: a 30 to 50% skim of its cash
  fares, or a 45 to 65% skim of rush hour fares, or recording stopping mid
  afternoon

## 2. Return leg of the recorded rides (task 3) — CLOSED 2026-07-10

Mhofu confirmed: the kombis use the same road both ways, taking off from the
front of the Rezende rank and parking at its end. The return therefore stays
its own direction with its own segment times on the shared geometry, which is
exactly what the pipeline and the map simulation do: one base line, and each
direction replays its own recorded ride clock (outbound ~39 riding minutes
with touting, return ~26 clean minutes; apps/web/src/lib/map/sim-profile.json).

## 3. Ride upload attribution (task 3)

Ingested ride files are attributed to the maintainer account that runs
`pnpm spine:ingest`, since the script runs at seed trust on a maintainer
machine. If rides should carry the name of whoever rode and recorded them,
say so and the ingest gains a recorded_by field.

## 4. The demo estimate window (task 4) — CLOSED 2026-07-10

Mhofu's call: run four kombis so both directions always show a live arrival
number. Done. The simulated fleet is four kombis, two per direction at any
instant, staggered unevenly around the loop; a unit test samples a full cycle
and proves each direction always has at least one kombi on the road, so the
"demo estimate" window from two kombis bunching one way is gone.

## 5. Shona strings (all tasks)

Every Shona string in the app is machine drafted placeholder text. An
external translator pass happens before submission. New strings keep landing
in both languages but the Shona stays draft quality until then.

## 6. Forms need JavaScript loaded (found 2026-07-10, pre-existing)

Every form in the app (pay, save, send credit, demo door) breaks if tapped
in the first moments before React finishes loading: the browser falls back
to a plain POST and Next.js 15.1 answers it with a 500 (a framework bug in
its no JavaScript form path, reproduced on the untouched wallet page too,
so it predates Phase A and is not something we wrote). After load, all
forms work normally, and production builds load much faster than the dev
server where this was caught. Risk on stage: a judge would have to tap pay
within roughly a second of first paint. Parked: revisit with a Next.js
upgrade after the demo freeze; not worth a major version jump now.

## 7. Account deletion design (task 6)

You asked for a delete action on the "what Svika knows about you" page. The
ledger and tickets are append only, so deletion anonymises instead of
erasing. Implemented design, built on your go but check the shape:

- Deleting removes your name and phone from the profile, deletes saved
  trips, and appends a consent withdrawal, all in one database function
- Ticket and money history stays (append only law) but no longer carries a
  name or phone; rows key to an opaque id
- The sign in email stays in the auth system until an operator removes the
  login; the page says this plainly rather than pretending full erasure
- After deletion the consent gate blocks the app again, so a returning user
  must consent afresh

If you want the login removed in the same action, that needs a service tier
job; flag it and it gets designed.

## 8. Home top bar language toggle clips at 360 (found 2026-07-14, pre-existing)

On the rider home map, the top bar packs the wordmark, theme toggle, the full
language toggle (EN / SN / ND) and the profile chip into one 360 wide row. The
ND option's "coming soon" (Shona "zvichauya") badge runs off the right edge and
is clipped. EN and SN stay fully visible and tappable, so switching language in
the demo works; only the disabled ND hint is cut. Left as is for now because
the toggle is a shared component (landing and home) and reflowing the home top
bar risks the landing. Flag it and it gets a compact home variant.

## 9. E2E viewport is not the reference device (found 2026-07-14, pre-existing)

`apps/web/playwright.config.ts` sets `viewport: 360x740` (the cheap Android)
at the top level, but the chromium project spreads `devices["Desktop Chrome"]`,
whose 1280x720 viewport wins. So the suite has been running desktop width, not
the reference phone. The new mobile QA spec pins 360x740 on its own block so its
proofs are honest. Fixing it globally would put every existing spec on 360 wide
at once, which may surface unrelated layout failures, so that call is left to
you: say the word and the project override gets the reference viewport back.

## 10. 3D map frame rate on the reference device (opened 2026-07-23, OPEN)

M0 shipped 3D buildings as a toggle, off by default, never offered under
reduced motion or reported deviceMemory under 4 GB. It holds frame rate on
the dev machine, but the ruling device is your real 360px Android. You
ruled on the M0 gate that you will test it yourself: open the landing or
home map, tap "3D buildings", pan and zoom around the CBD (buildings
appear from zoom 13), and feel for stutter. If it stutters, say the word
and 3D demotes to roadmap without argument (the toggle comes out, the
style keeps the layer for later). Ruling lands back in M0-GATE-REPORT.md.

## 11. Kombi board staging registry (batch K1) — CLOSED 2026-07-24

Mhofu approved the numbers below as staging placeholders on the K1 gate:
the invented plates, the 16 declared seats and the trust thresholds stay
as named constants. Real plates and per vehicle seats arrive with owner
enrolment; threshold tuning waits for real vehicle linked fares (the N1
substrate). Original items for the record:

- Plates AEZ 4821, AFK 2903, AGT 1157, ADR 7346: invented in the Zimbabwean
  three letter four digit shape, not real kombis. Real plates arrive from
  fieldwork.
- 16 declared seats each, mirroring the watchdog simulator assumption in
  item 1 above. If real corridor kombis differ, the seed and the watchdog
  config change together.
- Trust thresholds (`apps/web/src/lib/kombi/trust.ts`): 10 verified fares
  across 3 distinct days in 30 days before "verified fares" shows; 1 day of
  hourly load above declared seats flips the drift state. All my invention;
  the rules are named constants and change in one place.

## 12. Real time recorded walk on your own phone (M1/M2 rulings, OPEN)

Your own field test, ruled on the M1 and M2 gates (2026-07-25). The M1
evidence walk is the real 2026-07-07 pings replayed through the shipping
record screen, so its geometry is real but its clock is compressed; the
M2 follow video's viewer is a mocked position on the same pings. You
want a walk recorded live on a phone, and there is no deadline: the
challenge phase is over, so this happens whenever you next walk the
corridor. What to do when you are there:

- Open /app/record on your phone (https, signed in), start a walking
  recording, walk a few hundred metres, stop, name it and save with the
  journey consent. The screen should stay awake the whole walk (the wake
  lock built on this ruling).
- Optionally share the saved trip as a guide link and have a second
  phone follow it on the same street.

That gives the evidence pack a real time recording (true duration, true
clock) and a real hand held guide follow. The engine is identical to the
replay either way, so nothing blocks on this; it upgrades the evidence,
it does not gate a feature.

## 13. Place name wordlist draft (batch M3, OPEN)

Approved on the M3 gate as an interim draft, and parked here because it
owes two signatures before submission. The bilingual blocklist that screens
a place name before it can even be saved personally lives in two places
that must stay in step: `private.place_name_is_clean()` in migration 0038
(the server side word, which has the last word) and
`packages/shared/src/place-wordlist.ts` (the phone side twin that fails
fast). Both lists are machine drafted. They need:

- your own sign off on the Shona entries, since a wrong word here either
  blocks an honest name or lets a slur through, and
- the standing external translator pass every Shona string in this batch is
  waiting on (see item 5).

Deliberately not hand polished in the meantime: guessing at this list is
exactly the failure mode the pass exists to catch. Growing the list is a
migration by design, so its history stays reviewable.
