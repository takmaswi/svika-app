# M3 gate report — Places layer: nicknames, shortcuts, suggested names

Date: 2026-07-26 · Branch: product · Status: **PASSED AND CLOSED** (rulings
recorded below, ruling 3 built and green)

## What shipped

The crowd mapping flywheel, personal first, promoted by consensus, and
deliberately not AI (AI-USAGE-MAP.md carries the row; every rule below is
counting and geometry with named constants).

- **Schema (0038, 0039, applied to the shared project, additive only):**
  `place_names` and `shortcut_paths` born personal under RLS, community
  rows (suggested, public) minted only by the promotion pass and carrying
  no author column; `place_events` (append only, forbid_mutation) records
  every promotion and hide as history; `place_reports` and an outcome-only
  `place_submission_attempts` log back the rails. Client writes go through
  five security definer doors: `submit_place_name`,
  `recommend_place_names`, `search_public_places`, `flag_journey_shortcut`,
  `report_place_name`. Postgis, pg_trgm and pg_cron were enabled
  (extensions schema; pg_cron runs `private.promote_places()` every 15
  minutes; `public.run_places_promotion()` is the service-role-only door
  the test suites use to trigger the same pass).
- **Promotion rule:** three independent established authors, trigram
  similarity >= 0.45 inside a 120 m radius, promote a name to suggested;
  five distinct established authors tapping the suggestion promote it to
  public. Shortcuts ride the same machinery with a Hausdorff distance
  bound of 120 m (UTM 36S metres). Independence rail: an author counts
  only when their account predates the submission by 48 hours.
- **Safety rails:** 20 names / 10 shortcuts / 10 reports per author per
  day plus the house burst rule (five rejections in ten minutes); a
  bilingual wordlist screens a name on the phone
  (`packages/shared/src/place-wordlist.ts`) and again in the server door
  before even a personal save; three distinct reporters hide a community
  name by an appended event; the attempt log stores outcomes only, never
  the typed name; `anonymise_me` deletes personal places and shortcuts.
- **Rider surface:** `/app/places` (door on the trips screen): drop or
  tap a pin, tap a recommended name (one indexed nearest neighbour query)
  or type one, four kind chips, one primary CTA. Nicknames render as the
  §7 map place chip; a rider's personal names use a quieter soft ink
  variant; shortcuts draw in the walk tone dash. Community names carry a
  report door. Guests read the community layer; the identity wall stands
  exactly at naming (`/login?why=name`). A completed walking trip flags
  as a shortcut from its detail screen. Public names join the D1
  destination search the moment they are public (`search_public_places`
  merged into the plan page corpus, deduped against OSM).
- Bilingual throughout from the dictionary; the new Shona strings are
  machine drafted and ride the standing external translator pass.

## Gate proofs

| Proof | Result |
|---|---|
| RLS matrix | `pnpm db:security-test` **199 passed, 0 failed, 0 skipped** (21 new PL checks: personal invisible to riders and guests on table AND live view, recommendations never leak personal rows, no direct writes, no client promotion, wordlist before personal save, outcome-only attempt log pinned by column names, guest live view community only) |
| Promotion rule tests | `pnpm db:places-test` **25 passed, 0 failed** (places.promotion.test.mjs, service role + real doors) including both adversarial independence cases: **three fresh accounts cannot promote (PR-A)** and **one established author submitting three times is one voice (PR-B)**; plus idempotency, counts-only events, acceptance to public, anon search the moment public, hide by three reporters, shortcut Hausdorff consensus with a 600 m different path staying out, and service role UPDATE/DELETE refused on place_events |
| E2e naming flow | `places.spec.ts` **2/2 green** (the second test arrived with ruling 3, below): rider names a stop (personal chip renders), second rider proves the personal wall then names it, third rider names it, the scheduled pass runs, the suggestion chip and recommended row appear, three reports through the product door hide the community name while the author's personal name survives |
| Nickname rendering screenshots | `docs/design-evidence/places/`: both themes x both languages (`places-nicknames-{light,dark}-{en,sn}.png`) plus `places-guest-community-only.png` (the personal wall on camera). Real basemap, §7 chips, walk tone shortcut dash, recommended row with mono metres. Ruling 3 added `places-home-names-{light,dark}-{en,sn}.png`: a public name standing on the home map |
| CI gate | `pnpm typecheck` + `pnpm lint` clean; unit tests **412 passed** (shared 77 incl. new wordlist suite, conductor 37, spine 89, web 209) |
| Docs law | AI-USAGE-MAP.md places row (rules, deliberately not AI); DISCLOSURE-REGISTER.md + in-app disclosure.ts row (Tier 1); DATASET-STATEMENT.md places section (what exists today is team test artifacts, named as such) |

## Constants (all named in migration 0038, ratified 2026-07-26)

names: 120 m radius, 0.45 trigram similarity, 3 authors to suggested,
5 accepting authors to public, 48 h account age rail; shortcuts: 120 m
Hausdorff, 3 to suggested, 5 to public; caps: 20 names / 10 shortcuts /
10 reports per author per day, burst 5 rejections per 10 minutes; hide:
3 distinct reporters.

## Rulings from Mhofu (2026-07-26)

The open questions below were ruled on the same day. What each ruling did:

1. **Promotion constants approved** (3 authors, 48 h age rail, 120 m radius,
   0.45 similarity, 5 accepts, daily caps) as named constants in one place;
   tuning waits for real usage data. Honest note on "one place": the
   promotion constants are declared constants at the top of
   `private.promote_places()` (0038), and the caps live as literals with
   named comments inside the three door functions that enforce them
   (`submit_place_name`, `flag_journey_shortcut`, `report_place_name`).
   Lifting the caps into one accessor means rewriting three applied
   security definer functions, so it rides with the first real tuning pass
   rather than churning the doors for nothing today. Say the word if you
   want that refactor sooner.
2. **Personal chip fill ratified** as the next deviation: recorded as
   deviation 14 in `docs/DESIGN-DEVIATIONS.md` (§7 chip anatomy, quiet soft
   ink variant, spec gap).
3. **Community names join the home map: built.** See the section below.
4. **Places door on My trips approved**; it stays where it is.
5. **Resurrection shield approved as built.** Standing note: if real usage
   shows false positives blocking honest names at a spot, this becomes a
   review item, not a permanent rule. Nothing about it is silently frozen.
6. **Wordlist approved as an interim draft** and flagged in
   `docs/CHECKS-FOR-MHOFU.md` (item 13) as owing Mhofu's sign off plus the
   standing external translator pass. Deliberately not hand polished now.
7. **pg_cron on the shared project approved** and documented in
   `docs/DEPLOY.md` ("Scheduled jobs"), so nobody meets it by surprise.

The D2 ruling from the same session (early versus late as a documented v1
reference rule) is recorded in `docs/D2-GATE-REPORT.md`.

## Ruling 3 as built: the agreed names ride the home map

The flywheel closes: a name the city agreed on now shows on the map every
rider and every guest opens, not only on the naming screen.

- **Public only.** Suggestions are still being argued about and a personal
  name is one rider's own word, so neither travels to the home map; both
  keep rendering on `/app/places` where the scopes are explained
  (`apps/web/src/lib/places-live.ts`, `scope = public`, corridor box plus
  about 2 km, hard ceiling of 60 chips).
- **Same chip, no new grammar.** The home map draws the unmodified §7 map
  place chip the places screen draws, so this needs no deviation of its own
  (`makePlaceChipElement`, `apps/web/src/components/map/LiveMap.tsx`).
- **Quiet by rule.** Chips render from zoom 12.5 and step back above it, so
  the whole corridor view (about zoom 11 at 360px) stays clean and names
  never compete with the route. The boarding camera normally opens around
  zoom 13.6 to 14.2 (measured over ten cold opens), so the names are there
  when the rider lands; on the passes where the nearest kombi is far away
  the camera opens wide and the names correctly wait.
- **Riders and guests alike**, since community knowledge is the product:
  the rider home, the kombi tap home and the guest home all carry it
  (`apps/web/src/app/app/page.tsx`, `components/kombi/KombiMapHome.tsx`,
  `components/home/GuestHome.tsx`). The landing hero is untouched: it opens
  on the whole corridor, which is below the gate anyway.
- **Proofs.** `places.spec.ts` grew a second test, **2/2 green**: a seeded
  public name beside the rank is drawn on the rider home, shows when the
  camera holds a neighbourhood, hides on one tap out to the whole route,
  and stands on the guest map with no account. Regression 12/12 across
  map, guest, kombi board and answer home. Unit **420 passed**, typecheck
  and lint clean. Evidence shot again in `docs/design-evidence/places/`:
  `places-home-names-{light,dark}-{en,sn}.png` alongside the refreshed
  places screen and guest shots.
- **Honest note.** The chips are DOM markers, so they do not take part in
  MapLibre's label collision: a chip can overlap a stop label at some zooms
  (visible in the light shot, where the name sits beside "2nd boom gate").
  Same behaviour as the places screen. If it starts to read badly with more
  names on the corridor, the fix is a real symbol layer with collision, and
  that is a slice, not a patch.

## Original open rulings (answered above)

1. **The 48 h independence rail is a cost raiser, not a fraud ender.** A
   patient attacker holding three SIMs for two days still passes. Options
   if that worries us later: raise N, raise the age, or require ride
   history per author. Shipped as is, honestly documented.
2. **Personal chip variant is a spec gap.** DESIGN.md §7 has one map
   place chip; personal names ship the same anatomy with a soft ink fill
   (day) and a muted night stroke so they read quieter than agreed names.
   Proposal: add this variant to DESIGN.md; screenshots above show it.
3. **Where the layer renders.** Nicknames and shortcuts render on the
   dedicated places screen; the home LiveMap is untouched (demo safety
   first). Ruling wanted: should community names also join the home map,
   and if so at which zoom?
4. **Entry door placement.** The door into /app/places sits on the My
   trips screen (trips feed shortcuts and names). Say the word if it
   should live elsewhere (home sheet, profile).
5. **Resurrection shield.** A hidden community name keeps blocking
   similar names at that spot forever (prevents a hidden slur from being
   re-promoted by the same trio). Cost: the spot needs a genuinely
   different name to be named again. Shipped as the safer default.
6. **Wordlist draft.** The bilingual blocklist (server 0038 + shared
   twin) is machine drafted and needs your and the translator's
   ratification before submission, like every Shona string this batch.
7. **pg_cron now runs on the shared project** (one job, every 15
   minutes, promotion pass only). Flagging because the project serves
   frozen main too; the pass only reads and appends places rows.

## Honest notes

- The naming e2e self limits: the safety rails are per author per day, so
  after about six full runs on the same demo accounts in one day the report
  door starts answering rate_limited and the last step of the naming test
  goes red. Seen today after six runs: `place_reports` held exactly 10 rows
  in 24 hours for each of the three demo accounts, and the attempt log reads
  `name success` three times followed by `report rate_limited`, which is the
  cap doing its job on a test rather than a defect. Green twice on this same
  code before the cap filled, and green again the next day. Worth knowing
  before anyone reads that red as a regression.
- The evidence shots show a **seeded** name beside the rank (the evidence
  script writes it, shoots, and deletes it). Nobody in Harare has named that
  spot; it proves the rendering, nothing more. Recorded in
  DATASET-STATEMENT.md.
- Test residue: the promotion suite and the e2e write uniquely named
  rows at random spots away from the corridor, delete their personal
  rows, and hide their community rows through the report rail; hidden
  community rows are append only history and stay in the table,
  invisible on every surface. Recorded in DATASET-STATEMENT.md.
- The types regeneration slip (raw JSON envelope written into
  database.types.ts by a subagent) was caught by lint and fixed; the db
  package has no typecheck script, which is why tsc missed it. Worth a
  future chore: give @svika/db a typecheck script.

## Plain language summary

Riders can now name the city. Whatever you type stays on your own map
until three different riders, each with a real account older than two
days, call the same spot the same thing; then it becomes a suggestion
everyone can tap, and if enough people keep tapping it, it becomes a
public name that shows up in search. Walking shortcuts work the same
way from your recorded trips. Bad words never save, spam is capped per
day, and three reports from different people hide a public name. None
of this is AI and the docs say so plainly. All the proofs are green:
security tests, rule tests including the fake-accounts attack, a full
end to end run, and screenshots in both themes and languages.

You then ruled that the agreed names belong on the home map too, and they
now are. Once a name is public it shows on the map everyone opens, riders
and guests alike, in the same small black label the naming screen uses. It
only shows when the map is close enough to be looking at a neighbourhood;
pull back to the whole route and the names step aside so the road stays
clean. A test proves all of that, and the screenshots were taken again.
