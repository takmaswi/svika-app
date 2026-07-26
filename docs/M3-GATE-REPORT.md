# M3 gate report — Places layer: nicknames, shortcuts, suggested names

Date: 2026-07-26 · Branch: product · Status: **PASSED, rulings below open**

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
| E2e naming flow | `places.spec.ts` **1/1 green**: rider names a stop (personal chip renders), second rider proves the personal wall then names it, third rider names it, the scheduled pass runs, the suggestion chip and recommended row appear, three reports through the product door hide the community name while the author's personal name survives |
| Nickname rendering screenshots | `docs/design-evidence/places/`: both themes x both languages (`places-nicknames-{light,dark}-{en,sn}.png`) plus `places-guest-community-only.png` (the personal wall on camera). Real basemap, §7 chips, walk tone shortcut dash, recommended row with mono metres |
| CI gate | `pnpm typecheck` + `pnpm lint` clean; unit tests **412 passed** (shared 77 incl. new wordlist suite, conductor 37, spine 89, web 209) |
| Docs law | AI-USAGE-MAP.md places row (rules, deliberately not AI); DISCLOSURE-REGISTER.md + in-app disclosure.ts row (Tier 1); DATASET-STATEMENT.md places section (what exists today is team test artifacts, named as such) |

## Constants for ratification (all named in migration 0038)

names: 120 m radius, 0.45 trigram similarity, 3 authors to suggested,
5 accepting authors to public, 48 h account age rail; shortcuts: 120 m
Hausdorff, 3 to suggested, 5 to public; caps: 20 names / 10 shortcuts /
10 reports per author per day, burst 5 rejections per 10 minutes; hide:
3 distinct reporters.

## Open rulings for Mhofu

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
