// Spine 2 commute alerts, after the V1 gate ruling (Mhofu, 2026-07-23):
// when the answer peek already carries the same trip, the peek is the
// alert's home and the floating alert hides. It still floats when it says
// something different (the usual outbound kombi while the peek offers the
// ride back), and a rider with no pattern and no pref never sees either.
// Takunda's fixture history is rebuilt around now to stage each moment,
// exactly as the seed does, and restored after.
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers";
import { rebuildTakundaHistory } from "./takunda-fixtures";

/** Harare (CAT, UTC+2) minutes past midnight on the machine the server shares. */
function catMinuteOfDay(): number {
  const shifted = new Date(Date.now() + 2 * 60 * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

const TAKUNDA_EMAIL = "demo.takunda@svika.app";

async function loginTakunda(page: Page): Promise<void> {
  const res = await page.request.post("/e2e/login", {
    data: { email: TAKUNDA_EMAIL, password: process.env.DEMO_JUDGE_PASSWORD },
  });
  expect(res.ok(), `Takunda login failed: ${res.status()}`).toBeTruthy();
}

test.describe("commute alerts", () => {
  test("inside the usual window the peek is the alert's home and the float hides", async ({
    page,
  }) => {
    await rebuildTakundaHistory(0);
    await loginTakunda(page);
    await page.goto("/app");

    // the answer peek carries the trip, the live minutes and the honest basis
    const answer = page.getByTestId("peek-answer");
    await expect(answer).toBeVisible();
    await expect(answer).toContainText("2nd boom gate");
    await expect(answer).toContainText("Rezende Rank");
    await expect(answer.getByTestId("peek-stats")).toContainText(/min/);
    await expect(answer).toContainText(/demo estimate|recorded ride/);

    // same trip: the floating alert stays out of the way (V1 gate ruling)
    await expect(page.getByTestId("commute-alert")).toHaveCount(0);
  });

  test("past the window the float returns because it says something different", async ({
    page,
  }, testInfo) => {
    const minute = catMinuteOfDay();
    testInfo.annotations.push({
      type: "stage clock (CAT)",
      description: `minute ${minute} of the day`,
    });
    test.skip(minute < 270, "CAT clock too early to stage a passed window today");

    await rebuildTakundaHistory(180);
    try {
      await loginTakunda(page);
      await page.goto("/app");

      // the peek offers the ride back...
      const answer = page.getByTestId("peek-answer");
      await expect(answer).toBeVisible();
      await expect(answer).toContainText("Your ride back");

      // ...while the alert still reports the usual outbound kombi, with
      // live minutes and the honest basis label, exactly as before
      const alert = page.getByTestId("commute-alert");
      await expect(alert).toBeVisible();
      await expect(alert).toContainText("Your usual kombi is close");
      await expect(alert.locator(".commute-alert-eta")).toContainText("min");
      await expect(alert).toContainText(/demo estimate|recorded ride/);
    } finally {
      await rebuildTakundaHistory(0);
    }
  });

  test("a fresh rider never sees an alert or an answer peek", async ({ page }) => {
    await loginAs(page, "RIDER");
    await page.goto("/app");
    await expect(page.getByTestId("home-sheet")).toBeVisible();
    await expect(page.getByTestId("commute-alert")).toHaveCount(0);
    await expect(page.getByTestId("peek-answer")).toHaveCount(0);
  });
});
