// D1 gate evidence: destination first planning screens at the 360px
// reference viewport, both themes and both languages. Two moments:
//   uz        plan to University of Zimbabwe: alight stop trade line and
//             the walking tail leg (sheet opened so the tail is on screen)
//   noservice Kuwadzana: the plain no kombi line with closest drop + walk
// Needs the dev server on :3000 started with E2E_AUTH=on.
//
// Usage: node scripts/destination-plan-evidence.mjs   (from apps/web)
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
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
const OUT = join(repoRoot, "docs", "design-evidence", "destination-plan");
const MOBILE = { width: 360, height: 740 };

const MOMENTS = [
  {
    state: "uz",
    to: "University of Zimbabwe",
    openSheet: true,
  },
  {
    state: "noservice",
    to: "Kuwadzana",
    openSheet: false,
  },
];

async function capture(browser, moment, lang, theme) {
  const context = await browser.newContext({ viewport: MOBILE, locale: "en-ZW" });
  await context.addCookies([
    { name: "svika_theme", value: theme, url: BASE },
    { name: "svika_lang", value: lang, url: BASE },
  ]);
  const page = await context.newPage();
  const res = await context.request.post(`${BASE}/e2e/login`, {
    data: {
      email: process.env.DEMO_RIDER_EMAIL,
      password: process.env.DEMO_RIDER_PASSWORD,
    },
  });
  if (!res.ok()) throw new Error(`rider login failed: ${res.status()}`);

  await page.goto(`${BASE}/app/plan?from=Heights&to=${encodeURIComponent(moment.to)}`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.getByTestId("plan-trade").waitFor({ state: "visible", timeout: 30_000 });
  if (moment.openSheet) {
    // the tail leg lives in the opened sheet; the toggle is React state,
    // so wait for hydration before clicking the grabber
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="home-sheet"]')
          ?.getAttribute("data-hydrated") === "true",
      { timeout: 20_000 },
    );
    await page.locator(".home-sheet-grabber").click();
    await page.getByTestId("walk-tail-leg").waitFor({ state: "visible", timeout: 10_000 });
  }
  await page
    .locator(".maplibregl-canvas")
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(3200);
  await page.screenshot({ path: join(OUT, `${moment.state}-${theme}-${lang}.png`) });
  console.log(`${moment.state} ${theme} ${lang} captured`);
  await context.close();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  await fetch(`${BASE}/`).catch(() => {});
  const browser = await chromium.launch({ headless: true });
  for (const moment of MOMENTS) {
    for (const theme of ["light", "dark"]) {
      for (const lang of ["en", "sn"]) {
        await capture(browser, moment, lang, theme);
      }
    }
  }
  await browser.close();
  console.log(`destination plan evidence written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
