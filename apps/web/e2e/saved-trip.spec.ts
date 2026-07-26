// Flow: nickname a trip on the plan page, find it as a quick pick on the
// home map, tap it back into a plan. The quick pick carries a mock ETA that
// must always be labelled as a demo estimate (honesty tier 2, disclosure
// register entry).
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAs, waitForHydration } from "./helpers";

test.describe("saved trips", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "RIDER");
  });

  test("saves a nicknamed trip and rides it from the home map", async ({ page }) => {
    await page.goto("/app/plan?from=heights&to=rezende");
    await expect(page.locator(".plan-total")).toHaveText("$1.50");

    // the save form lives in the expanded half of the plan sheet
    await waitForHydration(page);
    await page.click(".home-sheet-grabber");
    await page.fill("#nickname", "Town trip");
    await page.click(".plan-save-cta");
    await expect(page.getByTestId("trip-saved")).toBeVisible();

    // home: the sheet opens and the quick pick is there, demo label attached
    await page.goto("/app");
    await waitForHydration(page);
    await page.click(".home-sheet-grabber");
    const pick = page.locator(".home-pick", { hasText: "Town trip" });
    await expect(pick).toBeVisible();
    await expect(pick.locator(".home-pick-eta .svika-mono-code")).toContainText("min");
    await expect(pick.locator(".home-pick-demo")).toBeVisible();

    // tapping the pick's trip link lands straight on a priced plan (the eta
    // column beside it answers its own tap with the provenance card)
    await pick.locator(".home-pick-link").click();
    await expect(page.locator(".plan-total")).toHaveText("$1.50");
  });

  test("renaming the same stop pair keeps one quick pick", async ({ page }) => {
    await page.goto("/app/plan?from=heights&to=rezende");
    await waitForHydration(page);
    await page.click(".home-sheet-grabber");
    await page.fill("#nickname", "Kumba");
    await page.click(".plan-save-cta");
    await expect(page.getByTestId("trip-saved")).toBeVisible();

    await page.goto("/app");
    await waitForHydration(page);
    await page.click(".home-sheet-grabber");
    await expect(page.locator(".home-pick", { hasText: "Kumba" })).toHaveCount(1);
    await expect(page.locator(".home-pick", { hasText: "Town trip" })).toHaveCount(0);
  });
});

// M4 (the D1 follow-up): a trip to a named place saves the same way a stop
// pair does, and the quick pick replans it. saved_trips carries the
// destination's own name and coordinates now (migration 0046) rather than
// pretending a place is a stop.
test.describe("saving a trip to a place", () => {
  test("a place destination saves and comes back as a quick pick", async ({ page }) => {
    await loginAs(page, "RIDER");
    const nickname = `Place ${Date.now().toString(36).slice(-4)}`;

    await page.goto(
      `/app/plan?from=${encodeURIComponent("2nd boom gate")}&to=${encodeURIComponent("University of Zimbabwe")}`,
    );
    await expect(page.getByTestId("home-sheet")).toBeVisible({ timeout: 20_000 });
    await page.locator(".home-sheet-grabber").click();

    await page.fill("#nickname", nickname);
    await page.locator(".plan-save-cta").click();
    await expect(page.getByTestId("trip-saved")).toBeVisible({ timeout: 20_000 });

    // the quick pick names the place and replans to it
    await page.goto("/app?sheet=open");
    const pick = page.locator(".home-pick", { hasText: nickname });
    await expect(pick).toBeVisible({ timeout: 20_000 });
    await expect(pick).toContainText("University of Zimbabwe");
    await pick.locator(".home-pick-link").click();
    await expect(page).toHaveURL(/to=University/i, { timeout: 20_000 });
    await expect(page.getByTestId("plan-trade")).toBeVisible();

    // clean up: a place trip left at the top of the demo rider's list is the
    // newest saved trip for every later spec, which changes the stop the
    // kombi surfaces talk about and the trip the home peek answers with
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const admin = createClient(url, key, { auth: { persistSession: false } });
      // this run, and any earlier run that died before its own cleanup
      await admin.from("saved_trips").delete().like("nickname", "Place %");
      void nickname;
    }
  });
});
