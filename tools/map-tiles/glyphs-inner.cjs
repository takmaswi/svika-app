// Runs INSIDE the Linux container started by build-glyphs.mjs. Renders each
// TTF in /work/fonts-src into 256 codepoint SDF glyph ranges under
// /out/<fontstack>/<start>-<end>.pbf. Every range is written, including the
// empty ones, so the glyph endpoint never 404s mid pan.
const fs = require("node:fs");
const path = require("node:path");
const fontnik = require("fontnik");

const FONTS = [
  { file: "IBMPlexMono-SemiBold.ttf", stack: "IBM Plex Mono SemiBold" },
  { file: "IBMPlexSans-Regular.ttf", stack: "IBM Plex Sans Regular" },
];

function range(font, start, end) {
  return new Promise((resolve, reject) => {
    fontnik.range({ font, start, end }, (err, buf) => {
      if (err) reject(err);
      else resolve(buf);
    });
  });
}

async function main() {
  for (const { file, stack } of FONTS) {
    const font = fs.readFileSync(path.join("/work/fonts-src", file));
    const dir = path.join("/out", stack);
    fs.mkdirSync(dir, { recursive: true });
    let written = 0;
    for (let start = 0; start < 65536; start += 256) {
      const end = start + 255;
      const buf = await range(font, start, end);
      fs.writeFileSync(path.join(dir, `${start}-${end}.pbf`), buf);
      written += 1;
    }
    process.stdout.write(`${stack}: ${written} ranges\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`${err.stack ?? err}\n`);
  process.exit(1);
});
