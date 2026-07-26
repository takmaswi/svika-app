// M4 (raised on the M0 gate by Mhofu, 2026-07-23): the self hosted glyph
// PBFs were shipping raw. Measured on `next start`: a 78,323 byte range went
// over the wire at 78,323 bytes, against roughly 49 KB for MapTiler's
// equivalent, because Next serves anything it does not recognise as
// application/octet-stream and its compressor skips that. Naming the media
// type does not help: application/x-protobuf is not on the compressible list
// either (both measured, both unchanged at 78,323).
//
// So the bytes on disk become the compressed bytes, and next.config declares
// Content-Encoding: gzip for that path. The browser decodes transparently,
// MapLibre reads an arrayBuffer and never looks at the media type, and the
// repo gets smaller instead of carrying two copies of every range.
//
// This script is idempotent: a file that is already gzip (magic 1f 8b) is
// left alone, so running it twice cannot double compress. Rerun it after
// build-glyphs.mjs, which writes raw output from fontnik.
//
// Usage: pnpm map:glyphs:gz
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FONTS = join(HERE, "..", "..", "apps", "web", "public", "map", "fonts");

const GZIP_MAGIC = [0x1f, 0x8b];

function isGzip(buf) {
  return buf.length > 2 && buf[0] === GZIP_MAGIC[0] && buf[1] === GZIP_MAGIC[1];
}

let raw = 0;
let packed = 0;
let already = 0;
let files = 0;

for (const stack of readdirSync(FONTS)) {
  const dir = join(FONTS, stack);
  if (!statSync(dir).isDirectory()) continue;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".pbf")) continue;
    const file = join(dir, name);
    const buf = readFileSync(file);
    files += 1;
    if (isGzip(buf)) {
      already += 1;
      packed += buf.length;
      raw += buf.length; // unknown original; counted flat so the ratio stays honest
      continue;
    }
    const gz = gzipSync(buf, { level: 9 });
    writeFileSync(file, gz);
    raw += buf.length;
    packed += gz.length;
  }
}

const pct = raw > 0 ? Math.round((1 - packed / raw) * 100) : 0;
console.log(
  `glyphs: ${files} ranges, ${already} already compressed, ${(raw / 1024).toFixed(0)} KB -> ${(packed / 1024).toFixed(0)} KB (${pct}% smaller)`,
);
