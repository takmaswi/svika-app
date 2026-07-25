// V3 gate evidence: guardian mode at the 360px reference viewport.
//
// Captures the child-visible guardian chip in both themes and BOTH
// languages (the dignity law shot the gate demands), the family screen
// from both sides, the travel-with-me ticket section fronted by the 0023
// guardian contact, and the guardian's safe-arrival state. Uses the real
// doors only: invite minted by the guardian, code entered by the child,
// fare booked through the pay path, arrival tapped by the rider.
//
// Needs the dev server on :3000 started with E2E_AUTH=on.
// Usage: node scripts/family-evidence.mjs   (from apps/web)
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
const OUT = join(repoRoot, "docs", "design-evidence", "family");
const MOBILE = { width: 360, height: 740 };

async function userContext(browser, role, theme, lang) {
  const context = await browser.newContext({ viewport: MOBILE, locale: "en-ZW" });
  await context.addCookies([
    { name: "svika_theme", value: theme, url: BASE },
    { name: "svika_lang", value: lang, url: BASE },
  ]);
  const page = await context.newPage();
  const res = await page.request.post(`${BASE}/e2e/login`, {
    data: {
      email: process.env[`DEMO_${role}_EMAIL`],
      password: process.env[`DEMO_${role}_PASSWORD`],
    },
  });
  if (!res.ok()) throw new Error(`${role} login failed: ${res.status()}`);
  return { context, page };
}

async function endAllLinks(page) {
  for (let i = 0; i < 6; i++) {
    await page.goto(`${BASE}/app/family`);
    const enders = page.getByTestId("family-end-link");
    if ((await enders.count()) === 0) return;
    await enders.first().click();
    await page.waitForURL(/\/app\/family/);
  }
}

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });

// the guardian mints the code
const guardian = await userContext(browser, "OWNER", "light", "en");
await endAllLinks(guardian.page);
if ((await guardian.page.getByTestId("family-invite-code").count()) === 0) {
  await guardian.page.getByTestId("family-invite-create").click();
  await guardian.page.getByTestId("family-invite-code").waitFor();
}
const code = (
  await guardian.page.getByTestId("family-invite-code").innerText()
).trim();
await guardian.page.screenshot({
  path: join(OUT, "family-guardian-invite-light-en.png"),
  fullPage: true,
});
console.log("invite code minted:", code);

// the child confirms it, then wears the chip in every theme and language
const child = await userContext(browser, "RIDER", "light", "en");
await endAllLinks(child.page);
await child.page.goto(`${BASE}/app/family`);
await child.page.getByTestId("family-code-input").fill(code);
await child.page.getByTestId("family-code-confirm").click();
await child.page.getByTestId("family-linked-note").waitFor();
await child.page.screenshot({
  path: join(OUT, "family-child-linked-light-en.png"),
  fullPage: true,
});

// the guardian contact on the ticket door (0023 fronts the 0026 link)
await child.page.goto(`${BASE}/app/profile`);
await child.page.locator("#kin_name").fill("Amai Chido");
await child.page.locator("#kin_phone").fill("+263 77 000 0000");
await child.page.getByTestId("emergency-consent").check();
await child.page.getByTestId("emergency-save").click();
await child.page.getByTestId("emergency-saved").waitFor();

for (const theme of ["light", "dark"]) {
  for (const lang of ["en", "sn"]) {
    const ctx = await userContext(browser, "RIDER", theme, lang);
    await ctx.page.goto(`${BASE}/app`);
    await ctx.page.getByTestId("guardian-chip").waitFor({ timeout: 20_000 });
    await ctx.page.waitForTimeout(1200); // map settle
    await ctx.page.screenshot({
      path: join(OUT, `guardian-chip-${theme}-${lang}.png`),
    });
    await ctx.context.close();
    console.log(`chip shot ${theme}/${lang}`);
  }
}

// the child rides and arrives; the ticket shows travel with me
await child.page.goto(`${BASE}/app/plan?from=heights&to=rezende`);
await child.page
  .getByTestId("home-sheet")
  .and(child.page.locator('[data-hydrated="true"]'))
  .waitFor({ timeout: 20_000 });
await child.page.locator('.plan-pay button[value="wallet"]').click();
await child.page.waitForURL(/booked=1/, { timeout: 20_000 });
await child.page
  .getByTestId("home-sheet")
  .and(child.page.locator('[data-hydrated="true"]'))
  .waitFor({ timeout: 20_000 });
await child.page.locator(".ticket-item").first().click();
await child.page.getByTestId("share-section").waitFor();
await child.page.screenshot({
  path: join(OUT, "ticket-travel-with-me-light-en.png"),
  fullPage: true,
});

await child.page.getByTestId("ticket-arrived").click();
await child.page.getByTestId("ticket-arrived-note").waitFor();
await child.page.screenshot({
  path: join(OUT, "ticket-arrived-light-en.png"),
  fullPage: true,
});

// the guardian sees the safe arrival
await guardian.page.goto(`${BASE}/app/family`);
await guardian.page.getByTestId("family-trip-state").waitFor();
await guardian.page.screenshot({
  path: join(OUT, "family-guardian-arrived-light-en.png"),
  fullPage: true,
});
const state = await guardian.page
  .getByTestId("family-trip-state")
  .getAttribute("data-state");
console.log("guardian sees state:", state);

// leave the pair unlinked so reruns and the e2e start clean
await endAllLinks(child.page);

await browser.close();
console.log("family evidence written to", OUT);
