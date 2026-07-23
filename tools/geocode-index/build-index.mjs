// D1 geocoding corpus builder. One command:
//
//   pnpm geocode:index      (from the repo root)
//
// Reads the committed self hosted Harare PMTiles (the M0 pipeline output,
// OSM data, ODbL) and extracts every named place, POI and road inside the
// same bbox the tiles were clipped to, from the OpenMapTiles layers:
//
//   place                suburbs, neighbourhoods, quarters, towns
//   poi                  named points of interest (campus, mall, clinic...)
//   transportation_name  named roads (one entry per name, longest run wins)
//
// Output is a committed JSON corpus (apps/web/src/lib/geocode/places.json)
// the destination search queries locally: no Google, no vendor, nothing in
// the ride path. Rerun after `pnpm map:tiles` refreshes the extract; the
// OSM data date rides tools/map-tiles/OSM-DATE.txt either way.
import { readFileSync, openSync, readSync, closeSync, mkdirSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PMTiles } from "pmtiles";
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const TILES = path.join(REPO, "apps", "web", "public", "map", "tiles", "harare.pmtiles");
const OUT = path.join(REPO, "apps", "web", "src", "lib", "geocode", "places.json");

// the M0 clip bbox (tools/map-tiles/build-tiles.mjs), verbatim
const BBOX = { west: 30.85, south: -18.12, east: 31.25, north: -17.62 };
const ZOOM = 14; // the extract's max zoom: every named feature is present

class FileSource {
  getKey() {
    return TILES;
  }
  async getBytes(offset, length) {
    const fd = openSync(TILES, "r");
    const buf = Buffer.alloc(length);
    readSync(fd, buf, 0, length, offset);
    closeSync(fd);
    return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + length) };
  }
}

function lngToTileX(lng, z) {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}
function latToTileY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z,
  );
}

/** A vector tile feature's geometry, projected to lng/lat. */
function projectGeometry(feature, x, y, z) {
  const extent = feature.extent;
  const size = extent * 2 ** z;
  const x0 = extent * x;
  const y0 = extent * y;
  return feature.loadGeometry().map((ring) =>
    ring.map((p) => {
      const lng = ((p.x + x0) * 360) / size - 180;
      const n = Math.PI - (2 * Math.PI * (p.y + y0)) / size;
      const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
      return [lng, lat];
    }),
  );
}

function round5(v) {
  return Math.round(v * 1e5) / 1e5;
}

const KINDS = {
  place: (props) =>
    ["suburb", "neighbourhood", "quarter"].includes(props.class) ? "suburb" : "place",
  poi: () => "poi",
  transportation_name: () => "road",
};

async function main() {
  const pm = new PMTiles(new FileSource());
  const header = await pm.getHeader();
  if (header.maxZoom < ZOOM) {
    throw new Error(`tiles stop at z${header.maxZoom}, need z${ZOOM}`);
  }

  const x0 = lngToTileX(BBOX.west, ZOOM);
  const x1 = lngToTileX(BBOX.east, ZOOM);
  const y0 = latToTileY(BBOX.north, ZOOM);
  const y1 = latToTileY(BBOX.south, ZOOM);

  /** name|kind -> { entry, weight } (weight: vertices seen, longest run wins) */
  const best = new Map();
  let tiles = 0;

  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const t = await pm.getZxy(ZOOM, x, y);
      if (!t?.data) continue;
      tiles++;
      let bytes = Buffer.from(t.data);
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
      const tile = new VectorTile(new Pbf(bytes));

      for (const [layerName, kindOf] of Object.entries(KINDS)) {
        const layer = tile.layers[layerName];
        if (!layer) continue;
        for (let i = 0; i < layer.length; i++) {
          const feature = layer.feature(i);
          const name = (feature.properties.name ?? "").toString().trim();
          if (!name) continue;
          const rings = projectGeometry(feature, x, y, ZOOM);
          const points = rings.flat();
          if (points.length === 0) continue;
          const mid = points[Math.floor(points.length / 2)];
          const kind = kindOf(feature.properties);
          const key = `${name.toLowerCase()}|${kind}`;
          const weight = points.length;
          const existing = best.get(key);
          if (existing && existing.weight >= weight) continue;
          best.set(key, {
            weight,
            entry: {
              name,
              kind,
              lng: round5(mid[0]),
              lat: round5(mid[1]),
            },
          });
        }
      }
    }
  }

  const order = { suburb: 0, place: 1, poi: 2, road: 3 };
  const entries = [...best.values()]
    .map((b) => b.entry)
    .sort(
      (a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name, "en"),
    );

  const osmDate = readFileSync(
    path.join(REPO, "tools", "map-tiles", "OSM-DATE.txt"),
    "utf8",
  ).trim();
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        source: "OpenStreetMap via the M0 self hosted Harare extract (ODbL)",
        osmDataDate: osmDate,
        bbox: BBOX,
        zoom: ZOOM,
        counts: entries.reduce((acc, e) => {
          acc[e.kind] = (acc[e.kind] ?? 0) + 1;
          return acc;
        }, {}),
        entries,
      },
      null,
      1,
    ),
  );
  console.log(
    `geocode corpus: ${entries.length} named entries from ${tiles} tiles -> ${OUT}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
