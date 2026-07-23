// Self hosted glyphs for the Mbare Sun map (M0). One command:
//
//   pnpm map:fonts          (from the repo root)
//
// Downloads the IBM Plex TTFs (OFL licensed) and renders them into MapLibre
// SDF glyph PBF ranges with fontnik, running inside a Linux Node container
// so the native fontnik binary never has to build on Windows. Output lands
// in apps/web/public/map/fonts/<fontstack>/<range>.pbf and is committed:
// deploys and CI serve glyphs without rerunning this pipeline.
//
// Stacks produced (single font stacks only, so the glyph URL fontstack
// always matches a directory):
//   - "IBM Plex Mono SemiBold"  street labels, DESIGN.md section 11
//   - "IBM Plex Sans Regular"   place and suburb labels (brand body font)

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SRC_DIR = path.join(HERE, "fonts-src");
const OUT_DIR = path.join(REPO, "apps", "web", "public", "map", "fonts");

const FONTS = [
  {
    file: "IBMPlexMono-SemiBold.ttf",
    stack: "IBM Plex Mono SemiBold",
    urls: [
      "https://cdn.jsdelivr.net/npm/@ibm/plex-mono@1.1.0/fonts/complete/ttf/IBMPlexMono-SemiBold.ttf",
      "https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/IBMPlexMono-SemiBold.ttf",
    ],
  },
  {
    file: "IBMPlexSans-Regular.ttf",
    stack: "IBM Plex Sans Regular",
    urls: [
      "https://raw.githubusercontent.com/IBM/plex/master/packages/plex-sans/fonts/complete/ttf/IBMPlexSans-Regular.ttf",
      "https://cdn.jsdelivr.net/gh/IBM/plex@master/packages/plex-sans/fonts/complete/ttf/IBMPlexSans-Regular.ttf",
    ],
  },
];

function log(msg) {
  process.stdout.write(`[map-fonts] ${msg}\n`);
}

async function download(font) {
  const dest = path.join(SRC_DIR, font.file);
  if (existsSync(dest)) {
    log(`${font.file} already downloaded`);
    return;
  }
  for (const url of font.urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      log(`downloaded ${font.file} from ${new URL(url).hostname}`);
      return;
    } catch (err) {
      log(`warning: ${url} failed (${err.message})`);
    }
  }
  throw new Error(`could not download ${font.file} from any source`);
}

function dockerReady() {
  return spawnSync("docker", ["info", "--format", "ok"], { encoding: "utf8" }).status === 0;
}

async function main() {
  if (!dockerReady()) {
    log("Docker is not running. Start Docker Desktop and rerun: pnpm map:fonts");
    process.exit(1);
  }
  mkdirSync(SRC_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });
  for (const font of FONTS) await download(font);

  // fontnik ships prebuilt Linux binaries for Node 16; the container exists
  // only to run it. npm work happens in the container's /tmp so no
  // node_modules ever lands in this repo directory.
  const inner = [
    "set -e",
    "mkdir -p /tmp/g && cd /tmp/g",
    "npm install --no-save --no-audit --no-fund fontnik@0.7.2 >/dev/null 2>&1",
    "NODE_PATH=/tmp/g/node_modules node /work/glyphs-inner.cjs",
  ].join(" && ");
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "-v",
      `${HERE}:/work`,
      "-v",
      `${OUT_DIR}:/out`,
      "node:16-bullseye",
      "bash",
      "-lc",
      inner,
    ],
    { stdio: "inherit" },
  );
  log(`glyphs written to ${path.relative(REPO, OUT_DIR)}`);
}

main().catch((err) => {
  log(err.stack ?? String(err));
  process.exit(1);
});
