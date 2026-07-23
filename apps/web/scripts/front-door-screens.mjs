// P1 gate evidence: the front door at the reference device (360x740), both
// themes and both languages. Run with the dev server up on :3000:
//   node scripts/front-door-screens.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dirname, "..", "..", "..", "docs", "design-evidence", "front-door");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  for (const lang of ["en", "sn"]) {
    const ctx = await browser.newContext({
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
    });
    await ctx.addCookies([
      { name: "svika_theme", value: theme, url: "http://localhost:3000" },
      { name: "svika_lang", value: lang, url: "http://localhost:3000" },
    ]);
    const page = await ctx.newPage();
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
    // let the map tiles and the entrance motion settle
    await page.waitForSelector('[data-testid="demo-chip"]', { timeout: 30_000 });
    await page.waitForTimeout(2_500);
    await page.screenshot({ path: join(OUT, `${theme}-${lang}.png`), fullPage: true });
    await ctx.close();
    console.log(`captured ${theme}-${lang}`);
  }
}
await browser.close();
