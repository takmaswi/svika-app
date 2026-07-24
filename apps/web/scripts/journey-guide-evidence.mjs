// M2 gate evidence: a phone following a shared walking trace.
//
// Shares the saved REAL walk (the 2026-07-07 walking leg recorded through
// the app for the M1 evidence), opens the guide link in a logged out
// context, and walks the viewer's mocked position along the same real
// pings while recording video: the live dot follows the line, drifts off
// the path on purpose (the off path cue fires), comes back, and arrives.
// Also captures the viewer in both themes and both languages.
//
// Needs the dev server on :3000 started with E2E_AUTH=on.
// Usage: node scripts/journey-guide-evidence.mjs   (from apps/web)
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
for (const f of [".env.local", ".env"]) {
  const p = join(repoRoot, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const BASE = "http://localhost:3000";
const OUT = join(repoRoot, "docs", "design-evidence", "journey");
const MOBILE = { width: 360, height: 740 };

function realWalkPings() {
  const folder = join(
    repoRoot,
    "assets",
    "Takunda real kombi ride data",
    "Mount Pleasant Heights to Rezende",
  );
  const csv = readdirSync(folder).find((f) => f.endsWith(".pings.csv"));
  const lines = readFileSync(join(folder, csv), "utf8").trim().split("\n");
  const header = lines[0].split(",");
  const col = (name) => header.indexOf(name);
  const [iMode, iLat, iLng] = [col("mode"), col("lat"), col("lng")];
  return lines
    .slice(1)
    .map((l) => l.split(","))
    .filter((p) => p[iMode] === "walking")
    .map((p) => ({ latitude: Number(p[iLat]), longitude: Number(p[iLng]) }));
}

async function shareRealWalk(browser) {
  const context = await browser.newContext({ viewport: MOBILE, locale: "en-ZW" });
  await context.addCookies([
    { name: "svika_theme", value: "light", url: BASE },
    { name: "svika_lang", value: "en", url: BASE },
  ]);
  const page = await context.newPage();
  const res = await page.request.post(`${BASE}/e2e/login`, {
    data: {
      email: process.env.DEMO_RIDER_EMAIL,
      password: process.env.DEMO_RIDER_PASSWORD,
    },
  });
  if (!res.ok()) throw new Error(`rider login failed: ${res.status()}`);

  await page.goto(`${BASE}/app/journeys`, { waitUntil: "networkidle" });
  await page
    .locator('[data-testid="journeys-list"][data-loaded="true"]')
    .waitFor({ timeout: 20_000 });
  await page
    .locator('[data-testid="journey-card"]', { hasText: "Real walk to the kombi" })
    .first()
    .click();
  await page.getByTestId("journey-share-section").waitFor({ timeout: 20_000 });
  const create = page.getByTestId("journey-share-create");
  if (await create.isVisible().catch(() => false)) {
    await create.click();
  }
  await page.getByTestId("journey-share-url").waitFor({ timeout: 20_000 });
  const url = (await page.getByTestId("journey-share-url").innerText()).trim();
  await context.close();
  return url;
}

async function followVideo(browser, shareUrl, pings) {
  const context = await browser.newContext({
    viewport: MOBILE,
    locale: "en-ZW",
    permissions: ["geolocation"],
    geolocation: pings[0],
    recordVideo: { dir: OUT, size: MOBILE },
  });
  const page = await context.newPage();
  await page.goto(shareUrl, { waitUntil: "networkidle" });
  await page
    .locator('[data-testid="guide-trace-map"][data-map-ready="true"]')
    .waitFor({ timeout: 30_000 });
  await page.waitForTimeout(3000);
  await page.getByTestId("guide-locate").click();

  // follow the real walk; drift off the path around a third in, come back
  const driftAt = Math.floor(pings.length / 3);
  for (let i = 0; i < pings.length; i++) {
    await context.setGeolocation(pings[i]);
    await page.waitForTimeout(90);
    if (i === driftAt) {
      const off = {
        latitude: pings[i].latitude,
        longitude: pings[i].longitude + 0.0012,
      };
      await context.setGeolocation(off);
      await page.waitForTimeout(2400); // the off path cue on screen
      await context.setGeolocation(pings[i]);
      await page.waitForTimeout(900);
    }
  }
  await page.waitForTimeout(2500); // arrival cue holds the last frames
  await context.close(); // flushes the video file
  console.log("follow video recorded");
}

async function captureMatrix(browser, shareUrl) {
  for (const theme of ["light", "dark"]) {
    for (const lang of ["en", "sn"]) {
      const context = await browser.newContext({ viewport: MOBILE, locale: "en-ZW" });
      await context.addCookies([
        { name: "svika_theme", value: theme, url: BASE },
        { name: "svika_lang", value: lang, url: BASE },
      ]);
      const page = await context.newPage();
      await page.goto(shareUrl, { waitUntil: "networkidle" });
      await page
        .locator('[data-testid="guide-trace-map"][data-map-ready="true"]')
        .waitFor({ timeout: 30_000 });
      await page.waitForTimeout(3200);
      await page.screenshot({
        path: join(OUT, `guide-${theme}-${lang}.png`),
        fullPage: true,
      });
      console.log(`guide ${theme} ${lang} captured`);
      await context.close();
    }
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  await fetch(`${BASE}/`).catch(() => {});
  const browser = await chromium.launch({
    headless: false,
    args: ["--window-size=420,920"],
  });
  const shareUrl = await shareRealWalk(browser);
  console.log(`guide link: ${shareUrl}`);
  const pings = realWalkPings();
  await followVideo(browser, shareUrl, pings);
  await captureMatrix(browser, shareUrl);
  await browser.close();
  console.log(`journey guide evidence written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
