// Launch Step 0 proof: under the launch profile no public surface can show
// simulated or generated data (ruling 3), and the paid and operator routes
// answer not found (ruling 14). The crawler visits every public route signed
// out and signed in and fails on any visible text, label or alt text that
// matches the honesty pattern.
import { expect, test, type Page } from "@playwright/test";
import { enableLaunchPreview } from "./launch-helpers";

const HONESTY = /demo|mock|simulat|generated|sample/i;

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/privacy",
  "/app",
  "/app?sheet=open",
  "/app/plan?from=Mt%20Pleasant%20Heights&to=Rezende",
  "/app/places",
  "/app/journeys",
  "/app/record",
  "/app/partner",
  "/app/profile",
  "/app/privacy",
  "/app/family",
];

const HIDDEN_PREFIXES = [
  "/app/kombis",
  "/app/ticket",
  "/app/wallet",
  "/app/gift",
  "/app/owner",
  "/app/intelligence",
  "/app/parcel",
];

const HIDDEN_ROUTES = [
  "/app/kombis",
  "/app/wallet",
  "/app/ticket/00000000-0000-0000-0000-000000000000",
  "/app/gift/00000000-0000-0000-0000-000000000000",
  "/app/owner",
  "/app/owner/statement",
  "/app/intelligence",
  "/app/parcel",
];

/** Everything a rider can read or hear: text, plus aria, alt, title and placeholder. */
async function readableText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    for (const el of clone.querySelectorAll("script, style, noscript, template")) el.remove();
    const attrs: string[] = [];
    for (const el of clone.querySelectorAll("[aria-label], [alt], [title], [placeholder]")) {
      for (const name of ["aria-label", "alt", "title", "placeholder"]) {
        const v = el.getAttribute(name);
        if (v) attrs.push(v);
      }
    }
    return `${clone.textContent ?? ""}\n${attrs.join("\n")}`;
  });
}

async function crawl(page: Page, who: string): Promise<void> {
  // fourteen routes, each a first compile on a cold dev server
  test.setTimeout(300_000);
  const offences: string[] = [];
  for (const route of PUBLIC_ROUTES) {
    const res = await page.goto(route);
    expect(res?.status(), `${who} ${route}`).toBeLessThan(500);
    // the map and lazy chips settle after hydration
    await page.waitForLoadState("networkidle").catch(() => {});
    const text = await readableText(page);
    // a hidden route is a dead end, so no public screen may link to one
    const deadLinks = await page.evaluate((hidden) => {
      return [...document.querySelectorAll("a[href]")]
        .map((a) => new URL((a as HTMLAnchorElement).href).pathname)
        .filter((p) => hidden.some((h) => p === h || p.startsWith(`${h}/`)));
    }, HIDDEN_PREFIXES);
    for (const link of deadLinks) offences.push(`${who} ${route}: links to hidden ${link}`);
    for (const line of text.split(/\n+/)) {
      const m = line.match(HONESTY);
      if (m) offences.push(`${who} ${route} [${page.url()}]: "${line.trim().slice(0, 140)}"`);
    }
  }
  expect(offences, offences.join("\n")).toEqual([]);
}

test.describe("launch profile honesty", () => {
  test.beforeEach(async ({ context }) => {
    await enableLaunchPreview(context);
  });

  test("hidden paid and operator routes answer not found", async ({ page }) => {
    for (const route of HIDDEN_ROUTES) {
      const res = await page.goto(route);
      expect(res?.status(), route).toBe(404);
    }
  });

  test("no public route shows simulated or generated data, signed out", async ({ page }) => {
    await crawl(page, "signed out");
  });

  test("no public route shows simulated or generated data, signed in", async ({ page }) => {
    const email = process.env.TEST_RIDER_A_EMAIL;
    const password = process.env.TEST_RIDER_A_PASSWORD;
    test.skip(!email || !password, "TEST_RIDER_A credentials missing from .env.local");
    const res = await page.request.post("/e2e/login", { data: { email, password } });
    expect(res.ok()).toBeTruthy();
    // prove the pass is really signed in, not bounced to consent or sign in
    await page.goto("/app");
    await expect(page.getByTestId("profile-chip")).toBeVisible();
    await crawl(page, "signed in");
  });

  test("the pitch door is closed without its key", async ({ page }) => {
    const res = await page.goto("/pitch");
    expect(res?.status()).toBe(404);
    const wrong = await page.goto("/pitch?key=not-the-key-0123456789");
    expect(wrong?.status()).toBe(404);
  });
});
