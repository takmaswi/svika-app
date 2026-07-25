// V2 gate evidence: guest mode at the 360px reference viewport, no login
// anywhere. The guest home, the planned trip with the pay wall, and the
// login why screen, in both themes and both languages where it matters.
// Needs the dev server on :3000. Usage: node scripts/guest-evidence.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const BASE = "http://localhost:3000";
const OUT = join(repoRoot, "docs", "design-evidence", "guest");
const MOBILE = { width: 360, height: 740 };

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });

for (const theme of ["light", "dark"]) {
  for (const lang of ["en", "sn"]) {
    const context = await browser.newContext({ viewport: MOBILE });
    await context.addCookies([
      { name: "svika_theme", value: theme, url: BASE },
      { name: "svika_lang", value: lang, url: BASE },
    ]);
    const page = await context.newPage();

    // ruling 6: the landing's primary CTA is the guest door
    await page.goto(`${BASE}/`);
    await page.getByTestId("landing-cta").waitFor();
    await page.waitForTimeout(1500); // map settle
    await page.screenshot({
      path: join(OUT, `landing-guest-door-${theme}-${lang}.png`),
    });

    await page.goto(`${BASE}/app`);
    await page.getByTestId("guest-home").waitFor();
    await page.waitForTimeout(1500); // map settle
    await page.screenshot({ path: join(OUT, `guest-home-${theme}-${lang}.png`) });

    // rulings 5 and 7: the kombi board open to guests, aggregates only
    await page.goto(`${BASE}/app/kombis`);
    await page.getByTestId("kombi-board-row").first().waitFor();
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, `guest-kombis-${theme}-${lang}.png`) });

    if (theme === "light") {
      await page.goto(`${BASE}/app/plan?from=heights&to=rezende`);
      await page.getByTestId("guest-pay-wall").waitFor();
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: join(OUT, `guest-plan-paywall-${theme}-${lang}.png`),
      });

      await page.goto(`${BASE}/login?why=pay&next=%2Fapp`);
      await page.getByTestId("login-why").waitFor();
      await page.screenshot({
        path: join(OUT, `login-why-pay-${theme}-${lang}.png`),
        fullPage: true,
      });
    }
    await context.close();
    console.log(`guest shots ${theme}/${lang}`);
  }
}

await browser.close();
console.log("guest evidence written to", OUT);
