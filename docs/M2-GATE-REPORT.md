# M2 gate report: share a trip to a friend (guide mode)

Status: PASSED (built and proven 2026-07-24; all three rulings landed
2026-07-25, recorded at the bottom; Goal 5 signed off and closed with
M1).

Scope: docs/PRODUCTION-PUSH-PLAN.md batch M2, ruled 2026-07-16. A saved
journey becomes a guide link: token scoped, expiring, revocable, viewable
with no account. Walking directions v1 are trace replay, NOT routing; the
recorded points are the directions, non road shortcuts included. No
routing engines, no new vendor calls; voice from the cached library only.

## What M2 delivered

- **Guide links (migration 0034).** `journey_shares` on the 0026 ride
  share capability pattern: 128 bit hex tokens minted server side for the
  rider's own SAVED journey only, idempotent while live, revocation
  instant, seven day expiry (a guide link outlives a ride share on
  purpose: the friend visits on Saturday, the link went out on Wednesday).
  The anonymous viewer's whole world is one RPC returning the trip name,
  declared mode, distance and the trace as `[lng, lat, offset_ms]` rows.
  Deliberately excluded: who recorded it, any row id, absolute timestamps
  (when a person walks somewhere is theirs; offsets are relative to the
  trace start), and GPS accuracy values.
- **Trace replay guidance.** `/share/journey/[token]`: the trace draws in
  route ink on the same `TraceMap` the recorder uses; one primary action
  ("Show me on the path") asks for the viewer's location, and their own
  live dot joins the map. Cues are computed CLIENT SIDE from distance to
  the polyline (`packages/shared/src/trace-guide.ts`): off path past 50 m
  with return hysteresis at 30 m so the cue never flaps, approaching at
  120 m remaining, arrived at 25 m and terminal. The off path banner
  wears marigold with char text (signal stays live dots and stops only);
  the approaching cue also plays from the pre generated cached voice
  library, the one phrase that fits it; the other cues are screen only
  until the phrase library grows. No vendor call anywhere.
- **Derived steps, documented as not AI.** Steps are not typed by anyone:
  the trace is simplified (Douglas Peucker, 12 m tolerance) and split
  where the bearing swings past 40 degrees or the mode changes; each step
  renders as "Walk 169 m along the path", "Turn left and continue 148 m"
  in both languages. A trip the sharer declared walk or kombi keeps that
  mode on every step; only a mixed trip lets segment speed decide. The
  viewer page says on screen: recorded path replayed, plain geometry, no
  routing engine, no AI. Same statement in AI-USAGE-MAP.md and the
  disclosure register.
- **The share door.** The saved trip detail grows a "Guide a friend"
  section: create the link, see it, stop sharing. Trips kept on this
  phone only (no upload consent) cannot be shared, honestly: there is
  nothing on the server to share.

## Gate proof

1. **e2e share, open logged out, see route and steps**
   (`apps/web/e2e/journey-share.spec.ts`, 2/2 passing): record and save a
   walk, mint the guide link, open it in a context with no session at
   all; the viewer sees the trip name, the trace on the map
   (`data-trace-count` asserted), two derived steps ("Walk N m", "turn
   left"), and the not AI line; nothing on the page names the rider. The
   viewer's mocked position then walks the path: the live dot appears,
   drifting 125 m off raises the off path cue, reaching the end lands on
   arrived (terminal). Wrong tokens get the quiet dead state.
2. **Token revocation test**: in the same e2e (revoke from the trip, the
   viewer's reload lands on the dead state) and in the RLS suite:
   `pnpm db:security-test` 141/141 with 12 new JS checks: only saved
   journeys mint (JS-1), owner only minting and revoking (JS-4, JS-10),
   idempotent live links (JS-3), the view carries no identity, ids or
   wall clock times (JS-8, offsets proven to start at zero), revocation
   kills the link (JS-11), no direct writes even for the owner (JS-12).
3. **Video of a phone following a shared walking trace**:
   `docs/design-evidence/journey/guide-follow-real-walk.webm`: the real
   2026-07-07 walking leg shared as a guide link and followed by a
   mocked viewer position walking the same real pings, drifting off the
   path (marigold cue fires) and returning, then arriving. Viewer
   screenshots in both themes and both languages
   (`guide-{theme}-{lang}.png`); the light/en shot shows the derived
   steps from the real walk: "Walk 169 m along the path", "Turn left and
   continue 148 m", 332 m total.

Checks: `pnpm typecheck` green, `pnpm lint` green, `pnpm test` green,
`pnpm db:security-test` 141/141, journey + journey share e2e 4/4.

## Spec gaps flagged

- **Guide cue banner** (DESIGN-DEVIATIONS.md 12, proposed): no warning or
  turn by turn grammar in the spec; marigold warn with char text, park
  tone for good news, signal untouched.

## Known limits, stated

- The follow video's viewer is a mocked position replaying the real
  pings; a hand held phone walk on a real street is owed when a body is
  on the corridor (the engine is the same either way).
- Voice covers the approaching cue only: it is the one phrase in the
  cached library that fits guide mode. Off path and arrived speak on
  screen only until the phrase set grows (a P5 voice session item).
- Stops and nicknames on the shared view wait for M3 (the places layer);
  the plan's "nicknames the sharer chose" has nothing to draw from yet.
- The guide link inherits the viewer's browser language via the standard
  toggle; the sharer cannot pin a language for the friend.

## Open questions for Mhofu (M2 rulings)

1. Deviation 12 (guide cue banner grammar): ratify?
2. Seven day guide link expiry: right default, or should the sharer pick?
3. The two extra guide phrases (off path, arrived) for the P5 voice
   recording list: approve the copy in dict.ts (`guide.cue.*`) as the
   phrases to record?

## Rulings (Mhofu, 2026-07-25)

1. **Deviation 12: RATIFIED.** Guide cue banner grammar recorded as
   ratified in DESIGN-DEVIATIONS.md.
2. **Seven day expiry: APPROVED** as the default; no sharer picker.
3. **The two extra guide phrases: APPROVED.** The `guide.cue.off-path`
   and `guide.cue.arrived` copy in dict.ts is the text to record; both
   added to the P5 recording list in `apps/web/public/voice/README.md`
   (Shona lines still ride the standing external translator pass before
   any studio session).

Note on the follow video's mocked viewer (known limits above): the real
hand held walk is now CHECKS-FOR-MHOFU item 12, Mhofu's own field test
with no deadline; the challenge phase is over, so nothing waits on it.

With the M1 wake lock slice green the same day, Goal 5 (M1 + M2) is
signed off and closed.
