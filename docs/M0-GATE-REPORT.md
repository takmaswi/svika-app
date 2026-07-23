# M0 gate report — self hosted map platform

Batch M0 of docs/PRODUCTION-PUSH-PLAN.md, executed on the product branch.
Evidence lives in `docs/map-evidence/m0/`. Every number below was measured,
not estimated; the harness is committed (`tools/map-tiles/measure-load.mjs`,
`tools/map-tiles/capture-shots.mjs`) so any figure can be reproduced.

## What shipped

1. **Harare PMTiles pipeline** (`tools/map-tiles/`, `pnpm map:tiles`):
   Geofabrik Zimbabwe → Planetiler (OpenMapTiles schema) → clipped to
   30.85,-18.12 → 31.25,-17.62 (all seeded corridors plus CBD, Mbare,
   Chitungwiza, Epworth, Ruwa margin). Output: **7.8 MB** single file in
   `apps/web/public/map/tiles/`, served locally with HTTP range requests;
   the app only ever downloads the ranges in view. OSM extract stamp
   2026-07-22T20:21:25Z recorded in `tools/map-tiles/OSM-DATE.txt` and
   `docs/DATASET-STATEMENT.md`.
2. **Native Mbare Sun style** per theme (`apps/web/src/lib/map/style.ts`):
   authored from the DESIGN.md §2/§11 tokens verbatim, checked in as code,
   unit tested as data. The MapTiler basic-v2 fetch and the runtime repaint
   are deleted. Same §11 layer order, casing + fill roads, water in the
   park family (existing recorded spec gap), IBM Plex Mono SemiBold street
   labels at 9px.
3. **Tile source adapter** (`apps/web/src/lib/map/tile-source.ts`):
   `selfhosted` (default) → `maptiler` (fallback, key stays in env) →
   `mock` (committed empty fixture tile). The chain advances at runtime if
   a provider cannot serve; an explicit `mock` stands alone for tests.
4. **Service worker v2** (`apps/web/public/sw.js`): precaches glyphs,
   sprites and marker/brand SVGs; PMTiles range requests cached stale
   while revalidate under range aware keys; visited map screens' documents
   network first with cache fallback; Next immutable chunks cached on use.
   Supabase and API traffic is never cached.
5. **3D as progressive enhancement**: fill-extrusion buildings from OSM
   `render_height` (8 m default), colours from the §2 building token, a
   toggle off by default, never offered under reduced motion or reported
   deviceMemory < 4 GB (`lib/map/three-d.ts`, unit tested).
6. **Self hosted glyphs and sprites** (`pnpm map:fonts`, `pnpm map:sprites`):
   IBM Plex Mono SemiBold + IBM Plex Sans Regular PBF ranges committed
   under `apps/web/public/map/fonts/` (~1.6 MB, OFL); attribution control
   always expanded, showing "© OpenMapTiles © OpenStreetMap contributors"
   (plus "© MapTiler" only when the fallback serves).

## Gate proof

Setup: production builds (`next start`), 360×760 viewport, throttled 3G via
CDP (750 kbps down / 250 kbps up / 300 ms RTT). "Old" is a worktree build
of commit 87673a7 (the MapTiler repaint map), not a simulation of it.

### Load times (map-ready, landing page)

| Run | Old (MapTiler repaint) | New (self hosted) |
| --- | --- | --- |
| Cold, first visit | 13,521 ms | 9,620 ms |
| Warm, behind the service worker | 4,658 ms | 3,474 ms |
| Airplane mode reload after first visit | fails (worker cached tiles only, the page itself needed network) | **ready in 6,139 ms, full map** |

Videos: `old-maptiler/cold-load.webm`, `new-selfhosted/cold-load.webm`.
Cold numbers vary ±1.5 s between runs (Next server warmth); the relative
gap held across every run. Both cold loads are dominated by the app bundle
on 3G; the map specific win is the four chained vendor round trips
(style → tilejson → tiles + glyphs, 300 ms RTT each) that no longer exist.

### Tile bytes transferred, cold load (encoded)

| Category | Old | New |
| --- | --- | --- |
| Vendor style JSON | 3,431 B | 0 |
| Vendor TileJSON | 4,547 B | 0 |
| Vector tiles | 97,340 B (MapTiler) | 46,437 B (2 PMTiles range requests) |
| Glyphs | 49,281 B (MapTiler, gzipped) | 74,599 B (self hosted, currently uncompressed) |
| Sprite | 0 | 668 B |
| Marker SVG | 1,734 B | 1,734 B |
| **Total map traffic** | **156,333 B** | **123,438 B** |
| Requests to a vendor | 5 | **0** |

Honest notes: tile bytes halved; self hosted glyphs are served uncompressed
by `next start` today (74.6 KB vs MapTiler's 49.3 KB gzipped), which is a
hosting header, not a data difference, and the two most used ranges are
precached by the worker anyway. The 7.8 MB PMTiles file is never fetched
whole: the cold landing view pulled 46 KB, 0.6% of it.

### Provider fallback (the demo never dies)

`fallback-maptiler/`: with `harare.pmtiles` deliberately removed, the same
build painted the identical Mbare Sun map over MapTiler tiles (cold
11,726 ms; attribution gains "© MapTiler"). With no key present the chain
ends at the committed mock fixture, which still renders ground, corridor,
stops and kombis. Chain logic unit tested (`test/tile-source.test.ts`).

### Native style parity and 3D

`native-style/`: `landing-day.png`, `landing-night.png` (char ground,
night beams, white dotted route), `landing-3d.png` (pitched camera, label
flips to "Flat map"), `home-boarding-day.png` / `home-boarding-night.png`
(boarding zoom: casing + fill roads, IBM Plex Mono stop labels, §5 chrome
clear of the sheet). Offline render: `new-selfhosted/offline-reload.png`
shows the full map, markers and both attribution credits in airplane mode.

### Tests

- `pnpm typecheck && pnpm lint && pnpm test`: green.
  Unit totals: shared 35, conductor 37, spine 89, web 139 (**300**), of
  which map style 12, tile source adapter 10, 3D gate 4.
- e2e: **39/41**. The two reds: the share mint spec is the documented
  known baseline red (local spine env, pre M0, recorded at P0 and P1); the
  book wallet ticket spec passed on an isolated rerun straight after
  (suite order flake on the shared demo users, output kept in the session
  log). No map bearing spec failed: live map, mobile QA at 360px, theme,
  intelligence, saved trips all green.
- Environment note for future e2e runs: with Docker Desktop up, the
  `taku-dzidza-ui` container squats host port 3000 and Playwright reuses
  it as if it were the dev server; stop that container first.

## Rulings (Mhofu, 2026-07-23)

1. 3D toggle on landing + app home only: **approved**.
2. Worker caching page shells (never API data): **approved**.
3. Attribution always expanded: **approved** (license law).
4. IBM Plex Sans for place and suburb labels: **approved** as a spec gap
   deviation, recorded as deviation 4 in `docs/DESIGN-DEVIATIONS.md`.
5. 3D frame rate on the real 360px Android: **OPEN** — Mhofu tests it
   himself and rules then; tracked as check 10 in
   `docs/CHECKS-FOR-MHOFU.md`. The demote to roadmap rule stays armed.

The uncompressed glyph asterisk (75 KB raw vs 49 KB gzipped) is logged as
an M4 bundle discipline slice in `docs/PRODUCTION-PUSH-PLAN.md` so it is
not forgotten. Goal 2 (batch M0) signed off and closed with these rulings.

## Decisions flagged for Mhofu (rule 4, as raised at the gate)

1. **3D toggle placement**: offered on the landing hero and the app home
   map only; the plan and share screens keep their trip framed camera and
   sheet, no toggle. Say the word and it joins them.
2. **Worker now caches page shells**: extension of the old "worker touches
   map traffic only" rule, needed for the airplane mode requirement. The
   network always wins while online; Supabase and API calls are never
   cached. The conductor PWA's explicit offline logic is untouched.
3. **Attribution always expanded**: ODbL/CC-BY want visible credit, so the
   collapse behaviour of the old ⓘ control is gone. It is the only chrome
   this batch adds to the map.
4. **Place and suburb labels** use IBM Plex Sans Regular (the brand body
   font): §11 specifies street labels only; this is the recorded spec gap
   proposal for the rest of the cartographic type. Street labels stay
   IBM Plex Mono SemiBold 9px per spec.
5. **Reference device frame rate check owed**: 3D holds frame rate on the
   dev machine, but the ruling device is a cheap 360px Android. The check
   runs at the next rehearsal on your phone; if it stutters there, 3D
   demotes to roadmap without argument, per the batch order. The gate
   (deviceMemory, reduced motion) already errs toward staying flat.

## Disclosure

Tier 1. Map data is OpenStreetMap, self hosted; register and dataset
statement updated in the same batch (`docs/DISCLOSURE-REGISTER.md`,
`docs/DATASET-STATEMENT.md`).
