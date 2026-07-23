// V1, answer first home. The peek answers a known commuter's moment: the
// usual trip inside its window with live wait, fare and wallet honesty, one
// tap from a cold open to a held board code; the ride back once the window
// has passed; and the plain search peek for anyone without a recognised
// context. Takunda's fixture history stages the moments (rebuilt relative to
// now, exactly like the seed, and restored after).
import { test, expect, type Page } from "@playwright/test";
import { loginAs, waitForHydration } from "./helpers";
import { rebuildTakundaHistory } from "./takunda-fixtures";

const TAKUNDA_EMAIL = "demo.takunda@svika.app";

/** Minutes past midnight in Harare (CAT, UTC+2). */
function catMinuteOfDay(): number {
  const shifted = new Date(Date.now() + 2 * 60 * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

async function loginTakunda(page: Page): Promise<void> {
  const res = await page.request.post("/e2e/login", {
    data: { email: TAKUNDA_EMAIL, password: process.env.DEMO_JUDGE_PASSWORD },
  });
  expect(res.ok(), `Takunda login failed: ${res.status()}`).toBeTruthy();
}

test.describe("V1 answer first home", () => {
  test("a known commuter goes from cold open to a board code in one tap", async ({
    page,
  }) => {
    // the seed centres Takunda's mined window on the seed moment, so the
    // suite may drift past it; rebuild around now so this IS the window
    await rebuildTakundaHistory(0);
    await loginTakunda(page);
    await page.goto("/app");

    // cold open: the peek is an answer, not a search box
    const answer = page.getByTestId("peek-answer");
    await expect(answer).toBeVisible();
    await expect(answer).toContainText("Your usual trip");
    // §9 trio intact and the number says what it stands on
    await expect(answer.getByTestId("peek-stats")).toContainText(/min/);
    await expect(answer).toContainText(/demo estimate|recorded ride/);
    // wallet honesty on the fare cell
    await expect(answer.getByTestId("answer-wallet")).toBeVisible();
    // gate ruling: the peek is the alert's home for the same trip, so the
    // floating alert stays hidden here
    await expect(page.getByTestId("commute-alert")).toHaveCount(0);

    // one tap: rebook, land with a live board code on screen
    await waitForHydration(page);
    await page.getByTestId("answer-rebook").click();
    await page.waitForURL(/\/app\?booked=1/, { timeout: 30_000 });
    await expect(page.locator(".ticket-item-code").first()).toHaveText(/^\d{4}$/, {
      timeout: 15_000,
    });
  });

  test("once the usual window has passed, the peek answers with the ride back", async ({
    page,
  }, testInfo) => {
    const minute = catMinuteOfDay();
    testInfo.annotations.push({
      type: "stage clock (CAT)",
      description: `minute ${minute} of the day`,
    });
    // a window that already passed today needs the clock to be far enough
    // past midnight to hold one; before ~04:30 CAT there is nowhere to put it
    test.skip(minute < 270, "CAT clock too early to stage a passed window today");

    await rebuildTakundaHistory(180);
    try {
      await loginTakunda(page);
      await page.goto("/app");
      const answer = page.getByTestId("peek-answer");
      await expect(answer).toBeVisible();
      await expect(answer).toContainText("Your ride back");
      // the pair reverses: the usual outbound alight is now the boarding stop
      await expect(answer.locator(".peek-answer-trip")).toContainText(/^Rezende Rank/);
      await expect(answer.getByTestId("answer-rebook")).toBeVisible();
    } finally {
      await rebuildTakundaHistory(0);
    }
  });

  test("a rider with no recognised context keeps the search peek", async ({ page }) => {
    await loginAs(page, "RIDER");
    await page.goto("/app");
    await expect(page.getByTestId("home-sheet")).toBeVisible();
    await expect(page.getByTestId("peek-answer")).toHaveCount(0);
    // the search box is the peek, exactly as before
    await expect(page.locator(".home-search #from")).toBeVisible();
  });

  test("the answer home still offers a way to plan a different trip", async ({
    page,
  }) => {
    await rebuildTakundaHistory(0);
    await loginTakunda(page);
    await page.goto("/app?sheet=open");
    await expect(page.getByTestId("answer-plan-other")).toBeVisible();
    await expect(page.locator(".home-plan-other #from")).toBeVisible();
  });
});
