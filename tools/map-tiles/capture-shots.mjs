// M0 gate proof: parity and feature screenshots of the native Mbare Sun map.
//
//   node tools/map-tiles/capture-shots.mjs <url> [--app]
//
// Captures day, night and (where offered) 3D shots of the landing map into
// docs/map-evidence/m0/native-style/. With --app it also signs in through
// the e2e login endpoint (server must run with E2E_AUTH=on and the demo
// rider seeded) and captures the boarding-zoom home map where street labels
// and road casings are visible.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const require = createRequire(path.join(REPO, "apps", "web", "package.json"));
const { chromium } = require("@playwright/test");

const [url, ...flags] = process.argv.slice(2);
if (!url) {
  console.error("usage: node capture-shots.mjs <url> [--app]");
  process.exit(1);
}
const doApp = flags.includes("--app");
const outDir = path.join(REPO, "docs", "map-evidence", "m0", "native-style");
mkdirSync(outDir, { recursive: true });

// .env.local for the demo rider credentials (only needed with --app)
function envLocal() {
  const { readFileSync, existsSync } = require("node:fs");
  const out = {};
  for (const f of [".env.local", ".env"]) {
    const p = path.join(REPO, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && out[m[1]] === undefined) out[m[1]] = m[2];
    }
  }
  return out;
}

async function settle(page, ms) {
  await page.waitForSelector('[data-map-ready="true"]', { timeout: 120_000 });
  await page.waitForTimeout(ms);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 360, height: 760 } });
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await settle(page, 6_000);
  await page.screenshot({ path: path.join(outDir, "landing-day.png") });
  console.log("landing-day.png");

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await page.waitForTimeout(3_500);
  await page.screenshot({ path: path.join(outDir, "landing-night.png") });
  console.log("landing-night.png");

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await page.waitForTimeout(2_000);
  const threeD = page.getByTestId("map-3d-toggle");
  if (await threeD.count()) {
    await threeD.click();
    await page.waitForTimeout(3_000);
    await page.screenshot({ path: path.join(outDir, "landing-3d.png") });
    console.log("landing-3d.png");
  } else {
    console.log("3D toggle not offered in this environment");
  }

  if (doApp) {
    const env = envLocal();
    const res = await page.request.post(new URL("/e2e/login", url).toString(), {
      data: { email: env.DEMO_RIDER_EMAIL, password: env.DEMO_RIDER_PASSWORD },
    });
    if (!res.ok()) {
      console.log(`app shots skipped: e2e login ${res.status()}`);
    } else {
      await page.goto(new URL("/app", url).toString(), { waitUntil: "domcontentloaded" });
      await settle(page, 6_000);
      await page.screenshot({ path: path.join(outDir, "home-boarding-day.png") });
      console.log("home-boarding-day.png");
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
      });
      await page.waitForTimeout(3_500);
      await page.screenshot({ path: path.join(outDir, "home-boarding-night.png") });
      console.log("home-boarding-night.png");
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
