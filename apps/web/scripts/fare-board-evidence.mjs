// V4 gate evidence: the live fare board on the plan screen at the 360px
// reference viewport, both themes, both languages.
//
// Nothing is staged. The board reads today's real digital tickets on the
// corridor, which is exactly the point of the feature: whatever riders paid
// today is what the shots show.
//
// Needs the dev server on :3000.
// Usage: node scripts/fare-board-evidence.mjs
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
const OUT = join(repoRoot, "docs", "design-evidence", "fare-board");
const MOBILE = { width: 360, height: 740 };
const PLAN = `${BASE}/app/plan?from=${encodeURIComponent("2nd boom gate")}&to=${encodeURIComponent("Rezende Rank")}`;

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
try {
  for (const theme of ["light", "dark"]) {
    for (const lang of ["en", "sn"]) {
      const context = await browser.newContext({ viewport: MOBILE });
      await context.addCookies([
        { name: "svika_theme", value: theme, url: BASE },
        { name: "svika_lang", value: lang, url: BASE },
      ]);
      const page = await context.newPage();
      const login = await page.request.post(`${BASE}/e2e/login`, {
        data: {
          email: process.env.DEMO_RIDER_EMAIL,
          password: process.env.DEMO_RIDER_PASSWORD,
        },
      });
      if (!login.ok()) throw new Error(`e2e login failed: ${login.status()}`);
      await page.goto(PLAN);
      await page.locator('[data-testid="home-sheet"]').waitFor({ timeout: 20_000 });
      // the board lives in the sheet body: open it, the way a rider does
      await page.locator(".home-sheet-grabber").click();
      const board = page.locator('[data-testid="fare-board"]');
      await board.waitFor({ timeout: 10_000 });
      // the sheet scrolls: bring the whole board into frame rather than
      // shooting whatever happened to be above the fold
      await board.scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(OUT, `fare-board-${theme}-${lang}.png`) });
      await context.close();
      console.log(`shot ${theme}/${lang}`);
    }
  }
} finally {
  await browser.close();
}
