// Share a trip to a friend (batch M2): the rider shares a saved journey as
// a guide link, a viewer with no account opens it, sees the trace and the
// derived steps, follows it with their own live dot and gets the off path
// and arrival cues (client side geometry), and revoking kills the link.
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

const START = { latitude: -17.8292, longitude: 31.0522 };
// south down the avenue then east: one clean left turn, two derived steps
const WALK: { latitude: number; longitude: number }[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    latitude: START.latitude - (i + 1) * 0.00036,
    longitude: START.longitude,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    latitude: START.latitude - 8 * 0.00036,
    longitude: START.longitude + (i + 1) * 0.00038,
  })),
];
const END = WALK[WALK.length - 1]!;
const OFF_PATH = {
  latitude: START.latitude - 4 * 0.00036,
  longitude: START.longitude + 0.0012, // ~125 m east of the southward leg
};

test.describe("journey guide links", () => {
  test.use({ geolocation: START, permissions: ["geolocation"] });

  test("share, follow logged out with cues, revoke", async ({
    page,
    context,
    browser,
  }) => {
    await loginAs(page, "RIDER");

    // record and save the walk to share
    await page.goto("/app/record?gps=replay");
    await page.getByTestId("record-start").click();
    await expect(page.getByTestId("record-chip")).toBeVisible();
    for (const step of WALK) {
      await context.setGeolocation(step);
      await page.waitForTimeout(180);
    }
    await page.getByTestId("record-stop").click();
    await page.getByTestId("journey-name").fill("Guide walk e2e");
    await page.getByTestId("journey-save").click();
    const consentAgree = page.getByTestId("journey-consent-agree");
    const savedNote = page.getByTestId("journey-saved-note");
    await expect(consentAgree.or(savedNote)).toBeVisible({ timeout: 15_000 });
    if (await consentAgree.isVisible()) await consentAgree.click();
    await expect(savedNote).toBeVisible({ timeout: 15_000 });

    // mint the guide link from the trip
    await expect(page.getByTestId("journey-share-section")).toBeVisible();
    await page.getByTestId("journey-share-create").click();
    await expect(page.getByTestId("journey-share-url")).toBeVisible();
    const shareUrl = (
      await page.getByTestId("journey-share-url").innerText()
    ).trim();
    expect(shareUrl).toMatch(/\/share\/journey\/[0-9a-f]{32}$/);

    // the viewer: a fresh context, no session, standing at the path start
    const viewerContext = await browser.newContext({
      geolocation: START,
      permissions: ["geolocation"],
    });
    const viewer = await viewerContext.newPage();
    await viewer.goto(shareUrl);
    await expect(viewer.getByTestId("guide-view")).toBeVisible();
    await expect(viewer.getByTestId("guide-name")).toHaveText("Guide walk e2e");
    await expect(viewer.getByTestId("guide-not-ai")).toBeVisible();
    const steps = viewer.getByTestId("guide-steps").locator("li");
    await expect(steps).toHaveCount(2); // walk south, turn left, walk east
    await expect(steps.first()).toContainText(/Walk \d+ m/);
    await expect(steps.nth(1)).toContainText(/left/i);
    const body = await viewer.locator("body").innerText();
    expect(body).not.toContain("Test Rider"); // nothing says who recorded it

    // the trace is on the map and the viewer's own dot joins it
    await expect(viewer.getByTestId("guide-trace-map")).toHaveAttribute(
      "data-trace-count",
      /^(1[0-9]|[2-9][0-9])$/,
    );
    await viewer.getByTestId("guide-locate").click();
    await expect(viewer.locator('[data-testid="trace-self-dot"]')).toBeVisible({
      timeout: 15_000,
    });

    // drift off the path: the cue names it (client side geometry)
    await viewerContext.setGeolocation(OFF_PATH);
    await expect(viewer.getByTestId("guide-cue")).toHaveAttribute(
      "data-cue",
      "off-path",
      { timeout: 15_000 },
    );
    // walk to the destination: arrived, and arrived is terminal
    await viewerContext.setGeolocation(END);
    await expect(viewer.getByTestId("guide-cue")).toHaveAttribute(
      "data-cue",
      "arrived",
      { timeout: 15_000 },
    );

    // revoke from the trip; the viewer's link dies
    await page.getByTestId("journey-share-revoke").click();
    await expect(page.getByTestId("journey-share-revoked")).toBeVisible();
    await viewer.reload();
    await expect(viewer.getByTestId("guide-dead")).toBeVisible();
    await viewerContext.close();
  });

  test("a wrong token lands on the quiet dead state", async ({ page }) => {
    await page.goto("/share/journey/00000000000000000000000000000000");
    await expect(page.getByTestId("guide-dead")).toBeVisible();
  });
});
