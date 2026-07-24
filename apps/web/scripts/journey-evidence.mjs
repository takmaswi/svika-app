// M1 gate evidence: record my trip screens at the 360px reference viewport.
//
// Part A replays Mhofu's REAL recorded walk (the walking leg of the
// 2026-07-07 inbound field ride, 240 raw pings) through the live record
// screen with ?gps=replay, saves it, and captures the saved trace on the
// map: a real recorded walk, drawn by the shipping engine.
// Part B captures the recording state and the saved trip in both themes
// and both languages (the recording state walks a short synthetic line and
// discards it afterwards; the shots say which is which by filename).
//
// Needs the dev server on :3000 started with E2E_AUTH=on.
// Usage: node scripts/journey-evidence.mjs   (from apps/web)
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
  const [iMode, iLat, iLng, iAcc] = [
    col("mode"),
    col("lat"),
    col("lng"),
    col("accuracy_m"),
  ];
  return lines
    .slice(1)
    .map((l) => l.split(","))
    .filter((p) => p[iMode] === "walking")
    .map((p) => ({
      latitude: Number(p[iLat]),
      longitude: Number(p[iLng]),
      accuracy: Number(p[iAcc]) || 10,
    }));
}

const SYNTHETIC_WALK = Array.from({ length: 8 }, (_, i) => ({
  latitude: -17.8292 - i * 0.00036,
  longitude: 31.0522,
  accuracy: 8,
}));

async function riderContext(browser, theme, lang, geolocation) {
  const context = await browser.newContext({
    viewport: MOBILE,
    locale: "en-ZW",
    permissions: ["geolocation"],
    geolocation,
  });
  await context.addCookies([
    { name: "svika_theme", value: theme, url: BASE },
    { name: "svika_lang", value: lang, url: BASE },
  ]);
  const page = await context.newPage();
  const res = await page.request.post(`${BASE}/e2e/login`, {
    data: {
      email: process.env.DEMO_RIDER_EMAIL,
      password: process.env.DEMO_RIDER_PASSWORD,
    },
  });
  if (!res.ok()) throw new Error(`rider login failed: ${res.status()}`);
  return { context, page };
}

async function startRecording(page) {
  await page.goto(`${BASE}/app/record?gps=replay`, { waitUntil: "networkidle" });
  await page.getByTestId("record-start").click();
  await page
    .getByTestId("record-chip")
    .waitFor({ state: "visible", timeout: 20_000 });
}

async function walk(context, page, pings, everyMs) {
  for (const p of pings) {
    await context.setGeolocation(p);
    await page.waitForTimeout(everyMs);
  }
}

// Part A: the real recorded walk, saved and drawn
async function captureRealWalk(browser) {
  const pings = realWalkPings();
  const { context, page } = await riderContext(browser, "light", "en", pings[0]);
  await startRecording(page);
  await walk(context, page, pings.slice(0, 120), 70);
  await page.waitForTimeout(2500); // tiles under the live trace
  await page.screenshot({ path: join(OUT, "record-live-real-light-en.png") });
  await walk(context, page, pings.slice(120), 70);
  await page.getByTestId("record-stop").click();
  await page.getByTestId("journey-name").waitFor({ state: "visible" });
  await page.screenshot({ path: join(OUT, "finish-light-en.png") });
  await page.getByTestId("journey-name").fill("Real walk to the kombi, 7 Jul");
  await page.getByTestId("journey-save").click();
  const agree = page.getByTestId("journey-consent-agree");
  try {
    await agree.waitFor({ state: "visible", timeout: 4000 });
    await agree.click();
  } catch {
    // consent already held from an earlier run: straight to the saved trip
  }
  await page.getByTestId("journey-saved-note").waitFor({ timeout: 20_000 });
  await page.waitForURL(/\/app\/journeys\//);
  const journeyId = page.url().match(/journeys\/([0-9a-f-]+)/)[1];
  await page
    .locator('[data-testid="journey-trace-map"][data-map-ready="true"]')
    .waitFor({ timeout: 30_000 });
  await page.waitForTimeout(3200);
  await page.screenshot({ path: join(OUT, "trip-real-walk-light-en.png") });
  console.log("real walk recorded and captured");
  await context.close();
  return journeyId;
}

// Part B: the theme and language matrix
async function captureMatrix(browser, journeyId) {
  for (const theme of ["light", "dark"]) {
    for (const lang of ["en", "sn"]) {
      const { context, page } = await riderContext(
        browser,
        theme,
        lang,
        SYNTHETIC_WALK[0],
      );
      // recording state: a short synthetic walk, discarded after the shot
      await startRecording(page);
      await walk(context, page, SYNTHETIC_WALK, 180);
      await page.waitForTimeout(2600);
      await page.screenshot({ path: join(OUT, `record-${theme}-${lang}.png`) });
      await page.getByTestId("record-stop").click();
      await page.getByTestId("journey-discard").click();
      await page.waitForURL(/\/app$/, { timeout: 15_000 }).catch(() => {});

      // the saved real trip
      await page.goto(`${BASE}/app/journeys/${journeyId}`, {
        waitUntil: "networkidle",
      });
      await page
        .locator('[data-testid="journey-trace-map"][data-map-ready="true"]')
        .waitFor({ timeout: 30_000 });
      await page.waitForTimeout(3200);
      await page.screenshot({ path: join(OUT, `trip-${theme}-${lang}.png`) });
      console.log(`${theme} ${lang} captured`);
      await context.close();
    }
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  await fetch(`${BASE}/`).catch(() => {});
  const browser = await chromium.launch({ headless: false, args: ["--window-size=420,920"] });
  const journeyId = await captureRealWalk(browser);
  await captureMatrix(browser, journeyId);
  await browser.close();
  console.log(`journey evidence written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
