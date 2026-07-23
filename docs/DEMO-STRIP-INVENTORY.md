# DEMO-STRIP-INVENTORY.md

P0 audit artefact, generated 2026-07-23 on the `product` branch. This is the definitive list of demo theatre to remove in P1. The strip removes exactly this list and nothing else. Scope ruled by docs/PRODUCT-FIRST-PLAN.md (state audit and batch P1). The database is out of scope entirely: demo tables, RPCs, personas and seeds stay untouched because the live Supabase project also serves the frozen Vercel demo on main.

All paths below are under `apps/web/` unless stated. Line counts from the P0 sweep.

## 1. Files deleted outright

### Story mode engine and chrome

| File | Lines | Role |
| --- | --- | --- |
| `src/lib/stories.ts` | 238 | Story scripts, step resolution, share path sentinel |
| `src/lib/demo-actions.ts` | 446 | Demo persona claim, story server actions, pooled sign in |
| `src/components/story/StoryStage.tsx` | 58 | Presentation stage: watch only lock, caption band, desktop frame |
| `src/components/story/StoryBar.tsx` | 103 | Caption band and story controls |
| `src/components/story/StoryAnimation.tsx` | 207 | Preview beats (simulated animation layer) |
| `src/components/story/StoryNextButton.tsx` | 32 | Live tail step button with pending spinner |
| `src/components/story/SimStamp.tsx` | 12 | Simulation stamp chip for staged scenes |

### Vision scenes

| File | Lines | Role |
| --- | --- | --- |
| `src/app/vision/tinashe/page.tsx` | 135 | Crash flow scene |
| `src/app/vision/gogo/page.tsx` | 70 | Gogo USSD scene |
| `src/app/vision/capacity/page.tsx` | 72 | Capacity badges scene |
| `src/components/vision/FeaturePhone.tsx` | 191 | Feature phone shell for the USSD scene |
| `src/lib/vision/capacity-fixtures.ts` | 28 | Capacity fixture data |
| `src/lib/vision/gogo-eta.ts` | 25 | Scene ETA helper |
| `src/lib/ussd/machine.ts` | 100 | USSD state machine |

### Demo front door

| File | Lines | Role |
| --- | --- | --- |
| `src/app/api/demo/route.ts` | 13 | POST handler for the pooled persona doors |

### Demo bound e2e specs (deleted, not reworked)

| File | Lines | Covers |
| --- | --- | --- |
| `e2e/demo.spec.ts` | 204 | Demo doors, pooled claim, demo chip |
| `e2e/stories.spec.ts` | 166 | Story runs (tino town, rudo night, takunda) |
| `e2e/vision.spec.ts` | 143 | The three vision scenes |
| `e2e/exits.spec.ts` | 85 | Story exit and stage lock behaviour |

### Demo bound unit tests

| File | Lines | Covers |
| --- | --- | --- |
| `test/ussd-machine.test.ts` | 165 | The deleted USSD machine (13 tests) |

## 2. Files edited (demo imports and blocks removed, file kept)

| File | Change |
| --- | --- |
| `src/app/page.tsx` | Rebuilt as the real front door. Demo doors, sandbox shelf, intelligence doors, vision links and the `demoerr` handling all go. Live map hero, one sign in path, register/privacy/repo footer stay. |
| `src/app/app/page.tsx` | Unwrap `StoryStage`, drop its import. Also drop the `voicedemo=1` replay switch on the voice guide: only the takunda story used it, so the guide always runs live |
| `src/app/app/plan/page.tsx` | Unwrap `StoryStage`, drop its import |
| `src/app/app/wallet/page.tsx` | Unwrap `StoryStage`, drop its import |
| `src/app/app/owner/page.tsx` | Unwrap `StoryStage`; drop `resolveStoryParams` and the `watchdogFirst` card ordering (card keeps its normal position). `searchParams` becomes unused and goes too |
| `src/app/share/[token]/page.tsx` | Unwrap `StoryStage`, drop its import. `searchParams`/`query` only fed the stage and go too |
| `src/app/app/intelligence/page.tsx` | Unwrap `StoryStage`, drop its import. The page itself is product (honest metrics ladder) and stays |
| `src/components/map/LiveMap.tsx` | Remove the `vehicleBadges` prop and badge marker code (only consumer was the capacity scene) and the story stage sizing accommodation. The `demo-chip` provenance label on simulated movement stays |
| `src/components/map/LiveMapLazy.tsx` | Drop the `vehicleBadges` pass through |
| `src/app/globals.css` | Remove the story stage, story preview, vision scene, feature phone and landing demo door blocks. The demo account chip block stays |
| `src/lib/dict.ts` | Remove the door and scene keys listed in section 4. Bilingual product keys stay |
| `src/lib/disclosure.ts` | Remove register rows for surfaces that no longer exist on this branch (demo door, story mode, story preview layer, the three vision scenes). All provenance and product rows stay. Flagged for Mhofu review since the register is the honesty ledger |
| `e2e/intelligence.spec.ts` | Rework: enter via `loginAs` seeded auth and direct navigation instead of landing story doors |
| `e2e/mobile-qa.spec.ts` | Rework: the sign out test asserts return to the front door landing instead of the demo door |

## 3. Explicitly kept (not demo, do not touch)

- `/register` disclosure page and its machinery: honesty is product.
- Provenance labels everywhere: the map `demo-chip` (simulated fleet), `eta-provenance` demo estimate basis labels, `owner.watchdogSimulated`, saved trip demo estimate label. They stay until real data replaces the simulated feed.
- Demo account chip in `src/app/app/layout.tsx` plus `demo.chip` dict key: DB tied honesty for pooled personas, still correct because e2e signs in seeded demo accounts.
- Profile page `my_demo_since` windowing and `profile.statsDemo` note, and the `ride-stats` cutoff logic: DB tied, harmless for real riders.
- Commute `alertPattern` demo waiver in `src/lib/commute/patterns.ts`: ruled harmless, real riders unaffected.
- `e2e/global-setup.ts` seeding and the `DEMO_*` seeded credentials with the `E2E_AUTH` gated `/e2e/login` route: this IS the reworked auth path.
- All core e2e specs (book, change, commute, consent, map, mobile-qa, offline, owner, parcel, profile, redeem, saved-trip, share, split, theme, transfer): they already authenticate with seeded users.
- `src/lib/map/vehicle-feed.ts`, `sim-config.ts`, `sim-profile.json`, `scripts/derive-sim-profile.mjs`: the labelled simulated fleet is the current feed adapter, swapped for real positions later behind the same interface.
- `packages/db` in full: migrations 0022, 0028, 0029, 0030, demo reset scripts, seeds, personas. Shared live database.
- `tools/gps-logger`, `deck/`, `docs/proposal/`: isolated, untouched.
- `apps/conductor` and `packages/*`: the P0 sweep found no demo layer code there (comments only).

## 4. Dictionary keys removed (from `src/lib/dict.ts`)

Door and shelf labels: `landing.demoLead`, `landing.demoEnter`, `landing.demoOwner`, `landing.demoErr`, `landing.shelfReal`, `landing.shelfIntel`, `landing.shelfVision`, `landing.intelEta`, `landing.intelTakunda`, `landing.intelWatchdog`, `landing.demoStory1`, `landing.demoStory2`, `landing.demoStory4`.

Story chrome and captions: every `story.*` key (next, back, stay, shelf, live, liveVision, exit, err, preview, working, the beat keys, and the caption sets town/transfer/tk/ru/eta/wd/tin/gogo/cap).

Vision scenes: `vision.stamp` and every `vision.tin.*`, `vision.gogo.*`, `vision.cap.*` key.

Kept deliberately: `demo.chip` (account chip), `map.demoChip` (provenance), `profile.statsDemo`, all `intel.*` keys (the intelligence page is product).

## 5. Database objects deliberately NOT touched

`demo_pool` machinery, `demo_reset_all`, `demo_watchdog_set_day`, `my_demo_since`, pooled personas (Tino, Rudo, Takunda, the demo owner and conductor), `profiles.demo_sim`, all seeds and fixture generators. They serve the frozen Vercel demo and the e2e suite. Code level strip only.
