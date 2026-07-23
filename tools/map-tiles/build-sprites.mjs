// Self hosted sprite sheet for the Mbare Sun map (M0). One command:
//
//   pnpm map:sprites        (from the repo root)
//
// The Mbare Sun style draws no sprite icons today (stops, kombis and the
// route are runtime layers and DOM markers, per DESIGN.md section 11), so
// the sheet is a valid empty sprite: the style's sprite pointer resolves
// locally, the service worker can precache it, and adding icons later is a
// drop in. Output is committed under apps/web/public/map/sprite/.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const OUT_DIR = path.join(REPO, "apps", "web", "public", "map", "sprite");

// A 1x1 transparent PNG; the smallest valid sprite image.
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(path.join(OUT_DIR, "sprite.json"), "{}\n");
writeFileSync(path.join(OUT_DIR, "sprite.png"), TRANSPARENT_PNG);
writeFileSync(path.join(OUT_DIR, "sprite@2x.json"), "{}\n");
writeFileSync(path.join(OUT_DIR, "sprite@2x.png"), TRANSPARENT_PNG);
process.stdout.write("[map-sprites] wrote empty sprite sheet to apps/web/public/map/sprite\n");
