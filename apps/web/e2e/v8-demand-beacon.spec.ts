// Batch V8: the demand beacon. A rider says they are waiting; conductors on
// that route see a number. That is all, and this spec exists as much to pin
// what CANNOT happen as what can.
//
// The hard boundary, walked end to end: the hwindi's screen shows counts and
// carries the law line, and there is no control on it that answers anybody.
// If a future change adds one, the last assertion here fails.
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

const CONDUCTOR_URL = "http://localhost:5174";

async function conductorToKeypad(page: Page): Promise<void> {
  await page.goto(CONDUCTOR_URL);
  await page.fill("#email", process.env.DEMO_CONDUCTOR_EMAIL!);
  await page.fill("#password", process.env.DEMO_CONDUCTOR_PASSWORD!);
  await page.click("button[type=submit]");
  await expect(page.locator(".hwindi-route").first()).toBeVisible({ timeout: 15_000 });
  await page
    .locator(".hwindi-route", { hasText: "HEIGHTS-REZENDE" })
    .filter({ hasText: "Rezende Rank" })
    .first()
    .click();
  await page
    .getByTestId("vehicle-picker")
    .waitFor({ timeout: 5_000 })
    .catch(() => {});
  const skip = page.getByTestId("vehicle-skip");
  if ((await skip.count()) > 0) await skip.click();
}

test.describe("demand beacon", () => {
  test.afterEach(async ({ page }) => {
    // never leave the corridor with a live beacon from a test
    await page.goto("/app/kombis").catch(() => {});
    const withdraw = page.getByTestId("beacon-withdraw");
    if ((await withdraw.count()) > 0) await withdraw.click().catch(() => {});
  });

  test("a rider raises a signal and the hwindi sees a count, not a person", async ({
    page,
    context,
  }) => {
    await loginAs(page, "RIDER");
    await page.goto("/app/kombis");

    const card = page.getByTestId("beacon-card");
    await expect(card).toBeVisible({ timeout: 20_000 });
    // the law is on screen before the rider taps, not buried in a policy
    await expect(page.getByTestId("beacon-law")).toContainText(/never who/i);

    const withdrawFirst = page.getByTestId("beacon-withdraw");
    if ((await withdrawFirst.count()) > 0) await withdrawFirst.click();

    await page.getByTestId("beacon-raise").click();
    await expect(page.getByTestId("beacon-live")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("beacon-live")).toContainText(/minutes/);

    // the hwindi's whole window: a stop and a number
    const hwindi = await context.newPage();
    await conductorToKeypad(hwindi);
    const pill = hwindi.getByTestId("waiting-pill");
    await expect(pill).toBeVisible({ timeout: 20_000 });
    await pill.click();

    const rows = hwindi.getByTestId("waiting-row");
    await expect(rows.first()).toBeVisible();
    const some = hwindi.locator(".hwindi-waiting-some");
    await expect(some.first()).toBeVisible();

    // THE BOUNDARY: nothing on this screen answers a beacon. No row is a
    // control, and the law line says so. The hwindi surface opens in Shona,
    // so the law is asserted there first and then in English.
    await expect(hwindi.getByTestId("waiting-law")).toContainText(/kwete murairo/i);
    await hwindi.locator(".lang-toggle button", { hasText: "EN" }).click();
    await expect(hwindi.getByTestId("waiting-law")).toContainText(/not an instruction/i);

    // no row is a button, and nothing on the screen offers to act on demand
    await expect(hwindi.locator('[data-testid="waiting-row"] button')).toHaveCount(0);
    await expect(hwindi.locator('[data-testid="waiting-row"] a')).toHaveCount(0);
    const labels = await hwindi
      .locator('[data-testid="waiting-screen"] button')
      .allInnerTexts();
    for (const label of labels) {
      expect(label).not.toMatch(/accept|assign|claim|dispatch|pick up|on my way/i);
    }

    await hwindi.close();
  });

  test("the rider can stop being counted, and the count follows", async ({
    page,
    context,
  }) => {
    await loginAs(page, "RIDER");
    await page.goto("/app/kombis");
    const withdrawFirst = page.getByTestId("beacon-withdraw");
    if ((await withdrawFirst.count()) > 0) await withdrawFirst.click();
    await page.getByTestId("beacon-raise").click();
    await expect(page.getByTestId("beacon-live")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("beacon-withdraw").click();
    await expect(page.getByTestId("beacon-raise")).toBeVisible({ timeout: 20_000 });

    // and the hwindi's pill is gone with it (no beacons left on the route)
    const hwindi = await context.newPage();
    await conductorToKeypad(hwindi);
    await hwindi.waitForTimeout(1500); // the first counts read
    const pill = hwindi.getByTestId("waiting-pill");
    if ((await pill.count()) > 0) {
      await pill.click();
      const some = hwindi.locator(".hwindi-waiting-some");
      await expect(some).toHaveCount(0);
    }
    await hwindi.close();
  });
});
