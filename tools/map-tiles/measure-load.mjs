// M0 gate proof harness. Loads a built app on a throttled 3G connection,
// times the map to ready, accounts every map byte, then proves offline
// rendering after a first visit. Run against a production `next start`:
//
//   node tools/map-tiles/measure-load.mjs <name> <url> [--offline]
//
// Outputs land in docs/map-evidence/m0/<name>/: video of the load, a
// ready screenshot, an offline reload screenshot (--offline), and
// metrics.json with load times and per category byte counts.
//
// Throttle: 3G profile, 750 kbps down / 250 kbps up / 300 ms RTT.

import { mkdirSync, writeFileSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const require = createRequire(path.join(REPO, "apps", "web", "package.json"));
const { chromium } = require("@playwright/test");

const THROTTLE = {
  offline: false,
  downloadThroughput: (750 * 1024) / 8,
  uploadThroughput: (250 * 1024) / 8,
  latency: 300,
};

const [name, url, ...flags] = process.argv.slice(2);
if (!name || !url) {
  console.error("usage: node measure-load.mjs <name> <url> [--offline]");
  process.exit(1);
}
const doOffline = flags.includes("--offline");
const outDir = path.join(REPO, "docs", "map-evidence", "m0", name);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

function categorize(reqUrl) {
  const u = new URL(reqUrl);
  if (u.hostname === "api.maptiler.com") {
    if (u.pathname.includes("style.json")) return "vendor-style";
    if (u.pathname.includes("tiles.json")) return "vendor-tilejson";
    if (u.pathname.includes("/fonts/")) return "vendor-glyphs";
    return "vendor-tiles";
  }
  if (u.pathname.endsWith(".pmtiles")) return "pmtiles-ranges";
  if (u.pathname.startsWith("/map/fonts/")) return "glyphs";
  if (u.pathname.startsWith("/map/sprite/")) return "sprite";
  if (u.pathname.startsWith("/map/")) return "map-static";
  return null;
}

async function measure(context, page, label) {
  const bytes = {};
  const counts = {};
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", THROTTLE);
  const byRequestId = new Map();
  session.on("Network.responseReceived", (e) => {
    byRequestId.set(e.requestId, e.response.url);
  });
  session.on("Network.loadingFinished", (e) => {
    const reqUrl = byRequestId.get(e.requestId);
    if (!reqUrl) return;
    const cat = categorize(reqUrl);
    if (!cat) return;
    bytes[cat] = (bytes[cat] ?? 0) + e.encodedDataLength;
    counts[cat] = (counts[cat] ?? 0) + 1;
  });

  const t0 = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForSelector('[data-map-ready="true"]', { timeout: 180_000 });
  const readyMs = Date.now() - t0;
  // let the entrance finish and stray tiles land so byte counts are honest
  await page.waitForTimeout(6_000);
  await page.screenshot({ path: path.join(outDir, `${label}-ready.png`) });
  return { readyMs, bytes, counts };
}

async function main() {
  const browser = await chromium.launch();

  // Byte accounting runs with the service worker BLOCKED: CDP reports
  // encodedDataLength 0 for SW handled responses, so a cold run behind the
  // worker undercounts. Cold bytes and cold timing come from this context;
  // the requests are identical to a first visit (an empty SW cache adds
  // nothing to a cold load).
  const bytesContext = await browser.newContext({
    viewport: { width: 360, height: 760 },
    recordVideo: { dir: path.join(outDir, "video-tmp"), size: { width: 360, height: 760 } },
    serviceWorkers: "block",
  });
  const cold = await measure(bytesContext, await bytesContext.newPage(), "cold");
  console.log(`[${name}] cold map-ready in ${cold.readyMs} ms`);
  await bytesContext.close();

  // Warm timing and the offline proof run with the service worker ALLOWED:
  // first visit primes the caches, the second view reads them.
  const context = await browser.newContext({
    viewport: { width: 360, height: 760 },
    serviceWorkers: "allow",
  });
  const primePage = await context.newPage();
  await measure(context, primePage, "prime");
  const warmPage = await context.newPage();
  const warm = await measure(context, warmPage, "warm");
  console.log(`[${name}] warm map-ready in ${warm.readyMs} ms (behind service worker)`);

  let offline = null;
  if (doOffline) {
    // Airplane mode: drop the network entirely (SW still serves).
    await context.setOffline(true);
    const offPage = await context.newPage();
    const t0 = Date.now();
    let offlineReady = false;
    try {
      await offPage.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await offPage.waitForSelector('[data-map-ready="true"]', { timeout: 60_000 });
      offlineReady = true;
    } catch {
      offlineReady = false;
    }
    await offPage.waitForTimeout(4_000);
    await offPage.screenshot({ path: path.join(outDir, "offline-reload.png") });
    offline = { ready: offlineReady, readyMs: Date.now() - t0 };
    console.log(`[${name}] offline reload ready=${offlineReady} in ${offline.readyMs} ms`);
    await context.setOffline(false);
  }

  await context.close();
  await browser.close();

  // keep the cold-load video only, named plainly
  const videoDir = path.join(outDir, "video-tmp");
  const clips = readdirSync(videoDir).filter((f) => f.endsWith(".webm"));
  clips.sort();
  if (clips[0]) copyFileSync(path.join(videoDir, clips[0]), path.join(outDir, "cold-load.webm"));
  rmSync(videoDir, { recursive: true, force: true });

  const metrics = { name, url, throttle: THROTTLE, cold, warm, offline };
  writeFileSync(path.join(outDir, "metrics.json"), JSON.stringify(metrics, null, 2));
  console.log(`[${name}] wrote ${path.relative(REPO, path.join(outDir, "metrics.json"))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
