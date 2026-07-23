// Mobile QA at the reference device (360x740, cheap Android). Two proofs:
// the idle home peek folds compact so the live map is the hero, and sign out
// is reachable straight from the profile and drops back to the front door.
// Both run at the config viewport; no resize needed.
import { test, expect } from "@playwright/test";
import { loginAs, waitForHydration } from "./helpers";

test.describe("mobile QA", () => {
  // Pin the reference cheap Android. The chromium project spreads
  // devices["Desktop Chrome"], whose 1280x720 viewport otherwise wins over the
  // config's 360x740 default, so these proofs must assert the size they claim.
  test.use({ viewport: { width: 360, height: 740 } });

  test("the home peek stays compact so the live map is visible at 360px", async ({
    page,
  }) => {
    await loginAs(page, "RIDER");
    await page.goto("/app");

    const map = page.getByTestId("live-map");
    await expect(map).toBeVisible();
    await expect(map).toHaveAttribute("data-map-ready", "true", {
      timeout: 30_000,
    });

    const sheet = page.getByTestId("home-sheet");
    await waitForHydration(page);

    // resting state, never auto-open
    await expect(sheet).not.toHaveClass(/home-sheet-open/);

    // the compact peek drops the "Search" title on short viewports so only the
    // bar (search + route/arrival/fare) shows
    await expect(page.locator(".home-sheet-title")).toBeHidden();

    // and it sits low enough that most of the 740 tall viewport is live map:
    // the compact peek seats the sheet top near 392 (map ~53%), well below the
    // un-folded 396 peek which reached ~344
    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan(375);

    // the search field of the compact bar is at hand without opening the sheet
    await expect(page.locator("#from")).toBeVisible();
  });

  test("sign out is reachable from the profile and returns to the front door", async ({
    page,
  }) => {
    await loginAs(page, "RIDER");
    await page.goto("/app/profile");

    // plainly there in the Settings group, no sheet to open, no map to reach
    const signOut = page.getByTestId("profile-signout").getByRole("button");
    await expect(signOut).toBeVisible();
    await signOut.click();

    // back at the front door, signed out
    await expect(page).toHaveURL(/localhost:3000\/(\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByTestId("landing-cta")).toBeVisible();

    // the session is truly gone: the guarded app bounces to login
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
  });
});
