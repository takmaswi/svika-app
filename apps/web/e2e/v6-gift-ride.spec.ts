// Batch V6: send a ride, not money. The sender pays from their wallet and
// hands over a four digit code; the recipient needs no account, no wallet and
// no app, and the hwindi clears the code exactly like any other.
//
// The share sheet cannot be driven from a test (it is the operating system's
// own UI), so what is proven here is everything up to and including the
// message that would travel: the card, the code, and the fact that the button
// copies the whole message when navigator.share is absent. The clipboard read
// IS the share payload.
import { test, expect, type Page } from "@playwright/test";
import { loginAs, skipKombiStep } from "./helpers";

const CONDUCTOR_URL = "http://localhost:5174";
const PLAN = `/app/plan?from=${encodeURIComponent("2nd boom gate")}&to=${encodeURIComponent("Rezende Rank")}`;

async function conductorSignIn(page: Page): Promise<void> {
  await page.goto(CONDUCTOR_URL);
  await page.fill("#email", process.env.DEMO_CONDUCTOR_EMAIL!);
  await page.fill("#password", process.env.DEMO_CONDUCTOR_PASSWORD!);
  await page.click("button[type=submit]");
  await expect(page.locator(".hwindi-route").first()).toBeVisible({ timeout: 15_000 });
}

/** Clear a code on the hwindi surface, skipping the kombi step. */
async function clearCode(page: Page, code: string): Promise<void> {
  await conductorSignIn(page);
  await page
    .locator(".hwindi-route", { hasText: "HEIGHTS-REZENDE" })
    .filter({ hasText: "Rezende Rank" })
    .first()
    .click();
  await skipKombiStep(page);
  for (const d of code) {
    await page.locator(".hwindi-key", { hasText: d }).first().click();
  }
  await expect(page.getByTestId("code-display")).toHaveText(code);
  await page.locator(".hwindi-cta").click();
}

async function walletCents(page: Page): Promise<number> {
  await page.goto("/app/wallet");
  const text = await page.getByTestId("wallet-balance").innerText();
  const m = text.match(/\$(\d+)\.(\d{2})/);
  if (!m) throw new Error(`unreadable wallet amount: ${text}`);
  return Number(m[1]) * 100 + Number(m[2]);
}

test.describe("send a ride, not money", () => {
  test("gift, share card, recipient boards", async ({ page, context }) => {
    await loginAs(page, "RIDER");
    const before = await walletCents(page);

    await page.goto(`${PLAN}&sheet=open`);
    await page.getByTestId("gift-ride").click();
    await expect(page).toHaveURL(/\/app\/gift\//, { timeout: 20_000 });

    // the share card: the same boarding card a ticket wears, with the code
    const card = page.getByTestId("gift-card");
    await expect(card).toBeVisible();
    const code = (await page.getByTestId("gift-code").innerText()).trim();
    expect(code).toMatch(/^\d{4}$/);

    // the sender paid: the fare left their wallet
    const afterGift = await walletCents(page);
    expect(afterGift).toBeLessThan(before);

    // the message that would travel carries the trip, the code and the
    // window, and nothing that identifies the recipient (Svika never asked)
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goBack();
    await page.addInitScript(() => {
      // force the copy path: navigator.share is not present on desktop
      // chromium anyway, but pin it so the assertion cannot drift
      Object.defineProperty(navigator, "share", { value: undefined });
    });
    await page.reload();
    await page.getByTestId("gift-share").click();
    const message = await page.evaluate(() => navigator.clipboard.readText());
    expect(message).toContain(code);
    expect(message).toContain("Rezende Rank");
    expect(message).toMatch(/hwindi/i);

    // a gifted ride is not the sender's own trip: the home rides list must
    // not offer to board it
    await page.goto("/app?sheet=open");
    await expect(page.getByText(code, { exact: true })).toHaveCount(0);

    // but it IS on the wallet, waiting to be handed over or taken back
    await page.goto("/app/wallet");
    await expect(page.getByTestId("sent-rides")).toContainText(code);

    // the recipient boards: no account anywhere in this step, just the code
    const hwindi = await context.newPage();
    await clearCode(hwindi, code);
    await expect(hwindi.getByTestId("verdict")).toHaveClass(
      /hwindi-verdict-success/,
      { timeout: 15_000 },
    );
    await hwindi.close();

    // and the sender's screen tells the truth afterwards
    await page.goto("/app/wallet");
    await expect(page.getByTestId("sent-rides")).toHaveCount(0);
  });

  test("taken back before anyone boards, the fare comes home", async ({ page }) => {
    await loginAs(page, "RIDER");
    const before = await walletCents(page);

    await page.goto(`${PLAN}&sheet=open`);
    await page.getByTestId("gift-ride").click();
    await expect(page).toHaveURL(/\/app\/gift\//, { timeout: 20_000 });
    const code = (await page.getByTestId("gift-code").innerText()).trim();

    await page.getByTestId("gift-revoke").click();
    await expect(page.getByTestId("gift-revoked")).toBeVisible({ timeout: 20_000 });

    // exactly what left came back
    expect(await walletCents(page)).toBe(before);

    // and the code is dead: the hwindi refuses it
    const hwindi = await page.context().newPage();
    await clearCode(hwindi, code);
    await expect(hwindi.getByTestId("verdict")).toHaveClass(
      /hwindi-verdict-already_redeemed/,
      { timeout: 15_000 },
    );
    await hwindi.close();
  });
});
