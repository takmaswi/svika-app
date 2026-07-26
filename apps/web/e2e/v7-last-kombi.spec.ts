// Batch V7: the last kombi countdown. The evening history is staged around
// the real clock (never the other way round), so these runs exercise the real
// Harare time arithmetic, the real percentile and the real warning rule.
//
// What is being defended here is the honesty, not the pixels: the warning
// appears only inside the window where a rider can still act, it says
// "usually" in both languages, it declares how many evenings it counted and
// how many of those are generated, and thin history says nothing at all.
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { clearStagedEvenings, stageLastKombi } from "./service-day-fixtures";

const ROUTE = "HEIGHTS-REZENDE";
/** A corridor route that has never carried a digital fare. */
const QUIET_ROUTE = "FOURTHST-BORROWDALE";
const FROM = "2nd boom gate";
const TO = "Rezende Rank";

const planUrl = `/app/plan?from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`;

test.describe("last kombi countdown", () => {
  test.afterAll(async () => {
    // hand the corridor back to the committed generator (pnpm db:service-days)
    await clearStagedEvenings(ROUTE, "outbound");
  });

  test("inside the window the rider is warned, with the time they have left", async ({
    page,
  }, testInfo) => {
    const staged = await stageLastKombi(ROUTE, "outbound", 35);
    testInfo.annotations.push({
      type: "staged evening (CAT)",
      description: `now ${staged.nowMinute}, usual last kombi ${staged.usualMinute}`,
    });
    // an evening cannot be staged past midnight: the minute of day would
    // clamp and the window this test needs would not exist
    test.skip(
      staged.usualMinute !== staged.nowMinute + 35,
      "CAT clock too close to midnight to stage a window today",
    );

    await loginAs(page, "RIDER");
    await page.goto(`${planUrl}&sheet=open`);

    const card = page.getByTestId("last-kombi");
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toHaveAttribute("data-state", "warn");

    // "usually", never a departure time
    const line = await card.getByTestId("last-kombi-line").innerText();
    expect(line).toContain("Usually gone by");
    const left = Number(line.match(/about (\d+) min/)?.[1]);
    // the staged median can sit a few minutes either side of the target
    // because a handful of real evenings share the sample; what must hold is
    // that the rider is told roughly the right amount of time
    expect(left).toBeGreaterThan(15);
    expect(left).toBeLessThan(55);

    // it declares what it counted, and that some of it is generated
    const basis = await card.getByTestId("last-kombi-basis").innerText();
    expect(basis).toMatch(/Counted from \d+ evenings/);
    expect(basis).toMatch(/generated history/);

    // the cached voice cue is offered, never auto played
    await expect(card.getByTestId("last-kombi-listen")).toBeVisible();
  });

  test("the same warning stands in Shona", async ({ page }) => {
    const staged = await stageLastKombi(ROUTE, "outbound", 35);
    test.skip(
      staged.usualMinute !== staged.nowMinute + 35,
      "CAT clock too close to midnight to stage a window today",
    );
    await loginAs(page, "RIDER");
    await page.context().addCookies([
      { name: "svika_lang", value: "sn", url: "http://localhost:3000" },
    ]);
    await page.goto(`${planUrl}&sheet=open`);

    const card = page.getByTestId("last-kombi");
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByTestId("last-kombi-line")).toContainText("Inowanzoenda");
    await expect(card.getByTestId("last-kombi-listen")).toHaveText("Teerera");

    await page.context().clearCookies({ name: "svika_lang" });
  });

  test("hours before the last kombi the screen stays quiet", async ({ page }) => {
    // staged far enough ahead that the warning would be noise
    const staged = await stageLastKombi(ROUTE, "outbound", 300);
    test.skip(
      staged.usualMinute !== staged.nowMinute + 300,
      "CAT clock too late in the day to stage a quiet hour today",
    );
    await loginAs(page, "RIDER");
    await page.goto(`${planUrl}&sheet=open`);

    await expect(page.getByTestId("home-sheet")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("last-kombi")).toHaveCount(0);
  });

  test("with no evening history at all it says nothing rather than guessing", async ({
    page,
  }) => {
    // Fourth Street to Borrowdale has never carried a digital fare, so with
    // its generated history removed the route genuinely knows nothing about
    // its own evenings. The card must stay away rather than borrow another
    // route's answer.
    await clearStagedEvenings(QUIET_ROUTE, "outbound");
    await loginAs(page, "RIDER");
    await page.goto(
      `/app/plan?from=${encodeURIComponent("Fourth Street Rank")}&to=${encodeURIComponent(
        "Sam Levy's Village Bus Stop",
      )}&sheet=open`,
    );

    await expect(page.getByTestId("home-sheet")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("last-kombi")).toHaveCount(0);
  });
});
