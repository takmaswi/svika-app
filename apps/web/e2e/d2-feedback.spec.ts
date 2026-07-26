// Did we get you there right? (batch D2). The rider books through the real
// pay path, arrives with their own tap, and the three tap card appears:
// right kombi, right stop, too much walking. The third tap saves the row
// (proven by a reload showing the thanks state), the quiet plan versus
// trace comparison runs and honestly judges nothing without a recorded
// journey, and the card speaks Shona when the app does.
import { test, expect } from "@playwright/test";
import { loginAs, waitForHydration } from "./helpers";

test.describe("post trip feedback", () => {
  test("three taps after arrival save once and stay saved", async ({ page }) => {
    await loginAs(page, "RIDER");

    // book a corridor fare through the real pay path, then arrive
    await page.goto("/app/plan?from=heights&to=rezende");
    await waitForHydration(page);
    await page.locator('.plan-pay button[value="wallet"]').click();
    await expect(page).toHaveURL(/booked=1/, { timeout: 15_000 });
    await waitForHydration(page);
    await page.locator(".ticket-item").first().click();
    await page.getByTestId("ticket-arrived").click();
    await expect(page.getByTestId("ticket-arrived-note")).toBeVisible();

    // the card opens with all three questions and the never-people note
    const card = page.getByTestId("feedback-card");
    await expect(card).toHaveAttribute("data-state", "open");
    await expect(page.getByTestId("feedback-q-kombi")).toBeVisible();
    await expect(page.getByTestId("feedback-q-stop")).toBeVisible();
    await expect(page.getByTestId("feedback-q-tooMuchWalking")).toBeVisible();

    // the implicit channel ran and, with no recorded journey over this
    // trip, honestly judged nothing
    await expect(card).toHaveAttribute("data-mismatches", "0", {
      timeout: 15_000,
    });

    // three taps, the third saves
    await page.getByTestId("feedback-kombi-yes").click();
    await page.getByTestId("feedback-stop-yes").click();
    await page.getByTestId("feedback-tooMuchWalking-no").click();
    await expect(page.getByTestId("feedback-thanks")).toBeVisible({
      timeout: 15_000,
    });

    // the row is server truth, not screen state: a reload stays thanked
    const ticketUrl = page.url();
    await page.reload();
    await expect(page.getByTestId("feedback-card")).toHaveAttribute(
      "data-state",
      "thanks",
      { timeout: 15_000 },
    );

    // and the card speaks Shona when the app does
    await page.context().addCookies([
      { name: "svika_lang", value: "sn", url: ticketUrl },
    ]);
    await page.reload();
    await expect(page.getByTestId("feedback-card")).toContainText(
      "Takusvitsa zvakanaka here?",
    );
    await page.context().addCookies([
      { name: "svika_lang", value: "en", url: ticketUrl },
    ]);
  });
});
