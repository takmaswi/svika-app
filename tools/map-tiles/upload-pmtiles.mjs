// Uploads the built Harare extract to the public "map" bucket (0049) so the
// live site serves its own tiles (CHECKS 15). Service role key from the root
// .env.local, the same way the seed reads it; never commit the key.
//
//   node tools/map-tiles/upload-pmtiles.mjs
//
// Prints the public URL to set as NEXT_PUBLIC_MAP_PMTILES_URL.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const f of [".env.local", ".env"]) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const file = join(root, "apps", "web", "public", "map", "tiles", "harare.pmtiles");
if (!existsSync(file)) throw new Error(`missing ${file}; run pnpm map:tiles first`);
const body = readFileSync(file);

const res = await fetch(`${url}/storage/v1/object/map/harare.pmtiles`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/octet-stream",
    "x-upsert": "true",
    // Storage turns this into the served Cache-Control; the bare number
    // form came back as "public, 86400", which browsers do not cache
    "cache-control": "max-age=604800",
  },
  body,
});
if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
console.log(`uploaded ${body.length} bytes`);
console.log(`NEXT_PUBLIC_MAP_PMTILES_URL=${url}/storage/v1/object/public/map/harare.pmtiles`);
