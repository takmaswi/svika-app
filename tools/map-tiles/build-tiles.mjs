// Harare vector tile pipeline (M0). One command rebuilds the whole extract:
//
//   pnpm map:tiles          (from the repo root)
//
// Pipeline: Geofabrik Zimbabwe OSM extract -> Planetiler (OpenMapTiles
// schema, so the app's layer names keep working) -> clipped to the Harare
// bounding box below -> single PMTiles file served from the web app's
// static dir. Planetiler runs in Docker (ghcr.io/onthegomap/planetiler) so
// no local Java install is needed; Docker Desktop must be running.
//
// OSM data date: read from Geofabrik's state file at build time and written
// to tools/map-tiles/OSM-DATE.txt in the same run. The date recorded there
// and in docs/DATASET-STATEMENT.md must move together; update the statement
// whenever this pipeline is rerun with fresh data.
//
// The bounding box covers every seeded corridor with wide margin: the
// Heights <-> Rezende corridor spans lng 31.028..31.051, lat -17.831..
// -17.714, and the box below also holds the CBD, Mbare, Chitungwiza,
// Epworth and Ruwa so future corridors land inside it without a re-clip.
//
// OSM is real third party data (ODbL). Attribution is rendered on the map
// itself; licensing is recorded in docs/DATASET-STATEMENT.md.

import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");

/** Harare clip: minLng,minLat,maxLng,maxLat. See header for why this box. */
export const HARARE_BBOX = "30.85,-18.12,31.25,-17.62";

const PLANETILER_IMAGE = "ghcr.io/onthegomap/planetiler:latest";
const GEOFABRIK_STATE_URL =
  "https://download.geofabrik.de/africa/zimbabwe-updates/state.txt";

const DATA_DIR = process.env.SVIKA_MAP_DATA_DIR ?? path.join(HERE, "data");
const OUT_FILE = path.join(REPO, "apps", "web", "public", "map", "tiles", "harare.pmtiles");
const DATE_FILE = path.join(HERE, "OSM-DATE.txt");

function log(msg) {
  process.stdout.write(`[map-tiles] ${msg}\n`);
}

async function fetchOsmDate() {
  // Geofabrik's state.txt carries the timestamp of the extract currently
  // being served; recorded so the dataset statement can cite the data date.
  try {
    const res = await fetch(GEOFABRIK_STATE_URL);
    if (!res.ok) throw new Error(`state.txt ${res.status}`);
    const text = await res.text();
    const stamp = /timestamp=(\S+)/.exec(text)?.[1]?.replace(/\\/g, "");
    return stamp ?? null;
  } catch (err) {
    log(`warning: could not read Geofabrik state.txt (${err.message})`);
    return null;
  }
}

function dockerReady() {
  const probe = spawnSync("docker", ["info", "--format", "ok"], { encoding: "utf8" });
  return probe.status === 0;
}

async function main() {
  if (!dockerReady()) {
    log("Docker is not running. Start Docker Desktop and rerun: pnpm map:tiles");
    process.exit(1);
  }

  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  const osmDate = await fetchOsmDate();
  if (osmDate) log(`Geofabrik Zimbabwe extract timestamp: ${osmDate}`);

  // Planetiler downloads the Zimbabwe extract plus its global helper
  // sources (natural earth, water polygons, lake centerlines) into
  // data/sources on the first run and reuses them afterwards.
  const args = [
    "run",
    "--rm",
    "-v",
    `${DATA_DIR}:/data`,
    PLANETILER_IMAGE,
    "--area=zimbabwe",
    "--download",
    `--bounds=${HARARE_BBOX}`,
    "--output=/data/harare.pmtiles",
    "--force",
  ];
  log(`docker ${args.join(" ")}`);
  execFileSync("docker", args, { stdio: "inherit" });

  const built = path.join(DATA_DIR, "harare.pmtiles");
  if (!existsSync(built)) {
    log("Planetiler finished but /data/harare.pmtiles is missing");
    process.exit(1);
  }
  copyFileSync(built, OUT_FILE);
  const mb = (statSync(OUT_FILE).size / (1024 * 1024)).toFixed(1);
  log(`wrote ${path.relative(REPO, OUT_FILE)} (${mb} MB)`);

  if (osmDate) {
    writeFileSync(
      DATE_FILE,
      `Geofabrik Zimbabwe OSM extract timestamp: ${osmDate}\n` +
        `Built: ${new Date().toISOString()}\n` +
        `Bounds: ${HARARE_BBOX}\n` +
        `Keep docs/DATASET-STATEMENT.md's OSM date in step with this file.\n`,
    );
    log(`recorded OSM data date in ${path.relative(REPO, DATE_FILE)}`);
  }
}

main().catch((err) => {
  log(err.stack ?? String(err));
  process.exit(1);
});
