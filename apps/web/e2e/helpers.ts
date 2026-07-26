// Shared e2e helpers. Login goes through the env gated /e2e/login endpoint
// with the seeded demo accounts (the product login is phone OTP; e2e never
// depends on a live SMS vendor).
import { expect, type Page } from "@playwright/test";

export type DemoRole = "RIDER" | "OWNER" | "CONDUCTOR";

export async function loginAs(page: Page, role: DemoRole): Promise<void> {
  const email = process.env[`DEMO_${role}_EMAIL`];
  const password = process.env[`DEMO_${role}_PASSWORD`];
  if (!email || !password) {
    throw new Error(`missing DEMO_${role}_EMAIL / _PASSWORD in .env.local`);
  }
  const res = await page.request.post("/e2e/login", {
    data: { email, password },
  });
  expect(res.ok(), `login for ${role} failed: ${res.status()}`).toBeTruthy();
}

/**
 * Wait until React is interactive on a screen that carries the bottom sheet
 * (home, plan). A form submit that races hydration falls back to a native
 * POST, and Next 15.1's no-JS action replay 500s (pre-existing upstream
 * bug, see docs/CHECKS-FOR-MHOFU.md); real fingers are slower than
 * Playwright, so the suite must not race.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await expect(page.getByTestId("home-sheet")).toHaveAttribute(
    "data-hydrated",
    "true",
    { timeout: 15_000 },
  );
}

/** Read the rider wallet balance shown on the rider home, in cents. The
    sheet must be open: at peek the strip is hidden and innerText is empty. */
export async function walletBalanceCents(page: Page): Promise<number> {
  await page.goto("/app?sheet=open");
  const text = await page.locator(".wallet-amount").innerText();
  const m = text.match(/\$(\d+)\.(\d{2})/);
  if (!m) throw new Error(`unreadable wallet amount: ${text}`);
  return Number(m[1]) * 100 + Number(m[2]);
}

/**
 * Walk past the hwindi surface's kombi step (V5), which sits between picking
 * a route and the keypad. Flows that prove money, codes or parcels have
 * nothing to say about which vehicle a shift is on, so they skip it; the
 * server has always accepted a null vehicle.
 *
 * Safe to call when the step is absent (a conductor whose fleet has no
 * vehicles never sees it). isVisible() would race the render, hence the
 * explicit wait, and the keypad wait afterwards means callers can type
 * immediately.
 */
export async function skipKombiStep(page: Page): Promise<void> {
  await page
    .getByTestId("vehicle-picker")
    .waitFor({ timeout: 5_000 })
    .catch(() => {});
  const skip = page.getByTestId("vehicle-skip");
  if ((await skip.count()) > 0) await skip.click();
  await page.locator(".hwindi-key").first().waitFor({ timeout: 10_000 });
}
