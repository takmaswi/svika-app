# M1 gate report: journey tracking (record my trip)

Status: PASSED (built and proven 2026-07-24; all four rulings landed
2026-07-25, recorded at the bottom; the wake lock slice built and green
the same day; Goal 5 signed off and closed with M2).

Scope: docs/PRODUCTION-PUSH-PLAN.md batch M1, ruled 2026-07-16. Riders
record real journeys from their own phones: schema with RLS from birth,
consent gated upload on the 0021/0024 machinery, offline first capture
with adaptive sampling, record and finish UI per Mbare Sun in both
languages. Database additive only; demo machinery untouched; server side
is storage, nothing clever.

## What M1 delivered

- **Schema (migration 0033).** `rider_journeys` and `rider_journey_points`
  (named so because `public.journeys` already belongs to the 0019 field
  ingest pipeline; the new tables are the opposite animal: rider owned,
  client fed, no route required). RLS from birth, riders read only their
  own rows, clients have no direct write path: four security definer RPCs
  are the doors (upsert, append points, complete, discard). Upload
  requires an accepted `journey-v1` consent (same `consent_records` table,
  own stream); the server refuses without it. Points are first sync wins
  (`on conflict do nothing`) and the append RPC reports how many rows were
  new so a replayed batch is flagged, never trusted. Discarding deletes
  the unsaved trace: privacy over history for data the rider declined to
  keep. `anonymise_me` learned the new stream and the app stream pick now
  excludes journey consents (the 0024 emergency lesson applied again).
- **Capture engine.** `apps/web/src/lib/journey/`: a recorder over
  `navigator.geolocation` with the shared capture rules
  (`packages/shared/src/journey-trace.ts`): fixes worse than 50 m accuracy
  rejected, adaptive sampling by speed (3 s riding, 6 s walking, 20 s
  still), standing jitter dropped under an 8 m floor with a 45 s heartbeat,
  teleport glitches never count toward distance. Battery is a two phase
  policy (`policy.ts`): a streak of still fixes releases the GPS watch
  (nap) and a timer takes one fix per still delay until movement wakes the
  watch. Every accepted point lands in IndexedDB the moment it is accepted
  (the conductor cache pattern, hand rolled the same way), so a crash or
  reload never loses the trace; the record screen resumes an interrupted
  recording. Sync replays the unsynced tail in batches of 200 through the
  0033 RPCs.
- **UI per Mbare Sun, bilingual.** `/app/record`: idle (mode chips,
  marigold selected per the section 8 selected badge), recording (live
  trace in THE section 11 route ink on a light `TraceMap`, section 7 glass
  recording chip with elapsed and distance in Plex Mono, one primary
  action: stop), finish (named summary, save or discard), and the journey
  consent ask exactly at the save moment: agree uploads, decline keeps the
  trip on this phone. GPS permission denied, plain HTTP (the field gotcha:
  GPS fails silently without https) and unsupported browsers each get a
  named card. `/app/journeys` lists saved trips (server rows under RLS
  merged with on device trips, which wear an "on this device" chip);
  `/app/journeys/[id]` fits the whole trace with the named summary. Record
  links sit on the plan sheet and the live ticket. Every string ships in
  English and Shona in dict.ts (Shona machine drafted, riding the standing
  external translator pass).

## Gate proof

1. **e2e record, save, reload, see the trip** (`apps/web/e2e/journey.spec.ts`,
   2/2 passing): mocked geolocation walks a Harare line under
   `?gps=replay` (compressed delays, same rules, the D1 voice replay
   pattern), the chip shows real metres, the finish screen counts >= 10
   points, the consent ask is answered, and after a full reload the trip
   is found in the list and opens with the same point count the server
   stored (`data-trace-count` proves the drawn trace matches). Second
   test: without the geolocation permission the screen lands on the named
   denied card, never silence.
2. **RLS proof**: `pnpm db:security-test` 129/129, 15 new JN checks:
   rider A cannot read rider B's journey or points (JN-4, JN-5), cannot
   append to, complete or discard them (JN-6, JN-7), no direct table
   writes even for the owner (JN-8, JN-9), no consent means no upload
   (JN-1), replayed batches insert nothing (JN-3), discard deletes the
   trace (JN-12), anon sees and does nothing (JN-13 to 15).
3. **A real recorded walk on the map**: the walking leg of Mhofu's real
   2026-07-07 inbound field ride (240 raw pings) replayed through the
   shipping record screen and saved;
   `docs/design-evidence/journey/trip-real-walk-light-en.png` shows the
   real walk drawn in route ink, 332 m, 22 points kept by the capture
   rules. Honesty note: the replay compresses the clock, so the saved
   duration reads as replay time (about 1 minute), not the walk's original
   4.7 minutes; the geometry and accuracy values are the real field data
   untouched. Evidence pack: recording state and saved trip in both
   themes and both languages (9 shots), plus the e2e flow video in
   test-results.
4. **Battery and payload numbers** (`node scripts/journey-profile.mjs`,
   replaying the full real rides through the exact capture rules):

   | Recording | Raw fixes | Kept | Payload | Radio duty |
   |---|---|---|---|---|
   | Inbound run, first 20 min | 1040 | 163 (16%) | 18.8 KB, 1 batch | 100% |
   | Return run, first 20 min | 207 | 36 (17%) | 4.2 KB, 1 batch | 100% |
   | Inbound full (47.5 min, incl. rank wait) | 2564 | 442 (17%) | 51.0 KB, 3 batches | 98% (4 naps) |
   | Return full (39.2 min) | 825 | 125 (15%) | 14.4 KB, 1 batch | 100% |

   Read plainly: a 20 minute recording uploads under 20 KB. The capture
   rules keep about one fix in six, which is the storage and payload win;
   the GPS radio itself stays on while the vehicle moves (it must), and
   the nap phase only pays during real stillness, as the rank wait on the
   inbound run shows. The duty figure is a model (watch time plus 3 s per
   nap fix), not a measured mAh number, and no claim beyond that is made.

Checks: `pnpm typecheck` green, `pnpm lint` green, `pnpm test` green
(shared 73 incl. 29 new geometry tests, web 195 incl. 7 policy tests),
`pnpm db:security-test` 129/129, journey e2e 2/2.

## Spec gaps flagged (never improvised silently)

- **Self position dot** (DESIGN-DEVIATIONS.md 10, proposed): the spec has
  no marker for the rider's own position; the section 7 live dot grown to
  a 16 px marker with the stop pin's white stroke.
- **Recording chip** (DESIGN-DEVIATIONS.md 11, proposed): no recording
  grammar in the spec; the section 7 live pill anatomy carries the state.

## Known limits, stated

- Backgrounding the browser tab can suspend GPS delivery; the recorder
  resumes on return and loses nothing already captured. A screen wake lock
  now holds the screen awake while recording (ruled on this gate, built
  2026-07-25; see the rulings below), but a rider who backgrounds the app
  anyway still pauses GPS delivery until they return.
- Withdrawing the journey consent alone has no dedicated control yet; the
  privacy page's delete everything removes journeys and appends the
  journey withdrawal (proven in 0033). A per stream withdrawal toggle is a
  follow up slice.
- A recording only continues on the record screen; there is no app wide
  "still recording" indicator if the rider navigates away.
- The journey e2e's consent branch depends on database state: the first
  run against a fresh stream exercises the consent ask, later runs (append
  only history) skip straight to save. The test handles both honestly.

## Open questions for Mhofu (M1 rulings)

1. Deviations 10 and 11 (self position dot, recording chip): ratify?
2. The replayed real walk carries replay timestamps (geometry real,
   duration compressed). Fine for the evidence pack, or do you want a
   real time recorded walk on a phone before the bootcamp?
3. Wake lock while recording: build now or roadmap?
4. Per stream consent withdrawal control on the privacy page: follow up
   slice or before submission?

## Rulings (Mhofu, 2026-07-25)

1. **Deviations 10 and 11: RATIFIED.** Self position dot and recording
   chip recorded as ratified in DESIGN-DEVIATIONS.md.
2. **Real time phone walk: wanted, no deadline.** The replay evidence
   stands for the pack. The challenge phase is over, so there is no
   bootcamp date to beat; Mhofu will record a real walk on his own phone
   as a field test whenever he next walks the corridor. Logged as
   CHECKS-FOR-MHOFU item 12.
3. **Wake lock: build now.** Built the same day as the closing M1 slice:
   `apps/web/src/lib/journey/wake-lock.ts` holds a Screen Wake Lock while
   the recording state is on screen, releases it the moment recording
   stops or the screen unmounts, re-requests it when a hidden tab returns
   (the browser auto releases on hide), and a browser without the API or
   a denied request (low battery) is a clean no-op: the recording never
   depends on the lock. Proof: 7 unit tests
   (`apps/web/test/journey-wake-lock.test.ts`, web suite 202/202) and the
   journey e2e now asserts `data-wake="held"` on the recording screen
   (lock granted to the test's browser context over CDP because Playwright
   1.49 has no screen-wake-lock permission name). Commit 5206ba4.
4. **Per stream consent withdrawal: approved as built.** The conservative
   reading stands; delete everything on the privacy page covers journeys,
   and a dedicated per stream toggle stays a follow up slice.

With the wake lock slice green, Goal 5 (M1 + M2) is signed off and
closed.
