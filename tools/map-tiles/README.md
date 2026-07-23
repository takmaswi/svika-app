# tools/map-tiles — the self hosted Harare map pipeline (M0)

Everything the map serves itself is built here. Three commands, all run
from the repo root, all requiring only Node 20+ and Docker Desktop:

| Command | What it builds | Where it lands |
| --- | --- | --- |
| `pnpm map:tiles` | Harare PMTiles extract (Geofabrik Zimbabwe -> Planetiler, OpenMapTiles schema, clipped to the Harare bbox) | `apps/web/public/map/tiles/harare.pmtiles` (gitignored, regenerate at will) |
| `pnpm map:fonts` | SDF glyph ranges for IBM Plex Mono SemiBold (street labels) and IBM Plex Sans Regular (place labels) | `apps/web/public/map/fonts/` (committed) |
| `pnpm map:sprites` | The (currently empty) sprite sheet | `apps/web/public/map/sprite/` (committed) |

`pnpm map:assets` runs all three.

## Data and licensing

- Map data is OpenStreetMap, ODbL. Attribution is rendered on the map.
  The OSM extract date is recorded in `OSM-DATE.txt` by every tile build
  and mirrored in `docs/DATASET-STATEMENT.md`; keep the two in step.
- IBM Plex fonts are SIL OFL 1.1.
- Planetiler downloads its helper sources (natural earth, water polygons,
  lake centerlines) into `data/sources/` on the first run (~1 GB, cached
  afterwards). `data/` and `fonts-src/` are gitignored intermediates.

## Serving

The PMTiles file is served as a plain static file from the web app's
public dir; the `pmtiles` protocol in MapLibre issues HTTP range requests
so the app only ever downloads the tile bytes in view, never the whole
file. Cloud hosting of the same file is a deploy decision, not a code
change: point `NEXT_PUBLIC_MAP_PMTILES_URL` at the hosted copy.
