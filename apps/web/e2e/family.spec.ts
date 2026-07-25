// Guardian mode (batch V3): a guardian mints an invite, the child confirms
// it on their own phone (mutual confirm), the child's app wears the
// guardian chip on every screen in both languages (dignity law, no silent
// tracking), the child rides and taps safe arrival, and the guardian sees
// exactly that. Ending the link from the child's side kills the window and
// the chip together.
import { test, expect, type Page } from "@playwright/test";
import { loginAs, waitForHydration } from "./helpers";

async function endAllLinks(familyPage: Page): Promise<void> {
  // idempotent re-runs: end whatever a previous run left behind
  for (let i = 0; i < 6; i++) {
    const enders = familyPage.getByTestId("family-end-link");
    if ((await enders.count()) === 0) return;
    await enders.first().click();
    await familyPage.waitForURL(/\/app\/family/);
    await familyPage.goto("/app/family");
  }
}

test.describe("guardian mode", () => {
  test("guardian links, child rides, guardian sees arrival", async ({
    page,
    browser,
  }) => {
    // the guardian on their own phone (the owner account plays guardian);
    // a hand-made context inherits no baseURL, so pass it through
    const guardianCtx = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
    });
    const guardian = await guardianCtx.newPage();
    await loginAs(guardian, "OWNER");
    await guardian.goto("/app/family");
    await endAllLinks(guardian);

    // mint (or reuse) the invite code
    if ((await guardian.getByTestId("family-invite-code").count()) === 0) {
      await guardian.getByTestId("family-invite-create").click();
    }
    await expect(guardian.getByTestId("family-invite-code")).toBeVisible();
    const code = (
      await guardian.getByTestId("family-invite-code").innerText()
    ).trim();
    expect(code).toMatch(/^[0-9a-f]{12}$/);

    // the child on theirs
    await loginAs(page, "RIDER");
    await page.goto("/app/family");
    await endAllLinks(page);

    // a wrong code gets a named error, never silence
    await page.getByTestId("family-code-input").fill("000000000000");
    await page.getByTestId("family-code-confirm").click();
    await expect(page.getByTestId("family-err-invalid")).toBeVisible();

    // the real code confirms the link: mutual confirm complete
    await page.getByTestId("family-code-input").fill(code);
    await page.getByTestId("family-code-confirm").click();
    await expect(page.getByTestId("family-linked-note")).toBeVisible();

    // dignity law: the chip rides EVERY child screen, in both languages
    await page.goto("/app");
    await expect(page.getByTestId("guardian-chip")).toHaveText(
      "Guardian sees your trips",
    );
    await page.goto("/app/wallet");
    await expect(page.getByTestId("guardian-chip")).toBeVisible();
    await page.context().addCookies([
      { name: "svika_lang", value: "sn", url: page.url() },
    ]);
    await page.reload();
    await expect(page.getByTestId("guardian-chip")).toHaveText(
      "Muchengeti anoona nzendo dzako",
    );
    await page.context().addCookies([
      { name: "svika_lang", value: "en", url: page.url() },
    ]);

    // the child rides: book a corridor fare through the real pay path
    await page.goto("/app/plan?from=heights&to=rezende");
    await waitForHydration(page);
    await page.locator('.plan-pay button[value="wallet"]').click();
    await expect(page).toHaveURL(/booked=1/, { timeout: 15_000 });

    // the guardian sees the booked trip, and only status words: no code,
    // no fare, no money anywhere on the family screen
    await guardian.goto("/app/family");
    await expect(guardian.getByTestId("family-trip-state")).toHaveAttribute(
      "data-state",
      "booked",
    );
    const guardianBody = await guardian.locator("body").innerText();
    expect(guardianBody).not.toMatch(/\$\d/); // no fare, no wallet figures

    // the child arrives and says so (one tap, their own)
    await waitForHydration(page);
    await page.locator(".ticket-item").first().click();
    await page.getByTestId("ticket-arrived").click();
    await expect(page.getByTestId("ticket-arrived-note")).toBeVisible();

    // the guardian sees the safe arrival
    await guardian.goto("/app/family");
    await expect(guardian.getByTestId("family-trip-state")).toHaveAttribute(
      "data-state",
      "arrived",
    );

    // the child ends it: window and chip die together
    await page.goto("/app/family");
    await page.getByTestId("family-end-link").first().click();
    await page.goto("/app");
    await expect(page.getByTestId("guardian-chip")).toHaveCount(0);
    await guardian.goto("/app/family");
    await expect(guardian.getByTestId("family-child-row")).toHaveCount(0);

    await guardianCtx.close();
  });
});
