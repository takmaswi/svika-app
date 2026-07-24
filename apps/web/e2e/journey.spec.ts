// Record my trip (batch M1): a rider records a walk, saves it with the
// journey consent, and finds the trip again after a full reload. GPS is
// Playwright's mocked geolocation walked along a Harare line; ?gps=replay
// compresses the adaptive sampling delays (same rules, tiny waits) exactly
// like the D1 voice replay pattern. A second test proves the permission
// denied state is a named card, not silence.
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

// a walk near the seeded corridor: south down the avenue, then a turn east
const WALK_START = { latitude: -17.8292, longitude: 31.0522 };
const WALK_STEPS: { latitude: number; longitude: number }[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    latitude: WALK_START.latitude - (i + 1) * 0.00036, // ~40 m south each
    longitude: WALK_START.longitude,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    latitude: WALK_START.latitude - 8 * 0.00036,
    longitude: WALK_START.longitude + (i + 1) * 0.00038, // ~40 m east each
  })),
];

test.describe("journey recording", () => {
  test.use({ geolocation: WALK_START, permissions: ["geolocation"] });

  test("record a walk, save it, reload, see the trip", async ({ page, context }) => {
    await loginAs(page, "RIDER");

    await page.goto("/app/record?gps=replay");
    await expect(page.getByTestId("record-screen")).toHaveAttribute(
      "data-state",
      "idle",
    );

    // walking is the preselected mode; one action starts
    await page.getByTestId("record-start").click();
    await expect(page.getByTestId("record-screen")).toHaveAttribute(
      "data-state",
      "recording",
    );
    await expect(page.getByTestId("record-chip")).toBeVisible();

    // walk the line: each fix ~40 m on, all inside the replay sample gate
    for (const step of WALK_STEPS) {
      await context.setGeolocation(step);
      await page.waitForTimeout(200);
    }

    // the chip carries distance in mono; ~560 m walked must show as metres
    await expect
      .poll(async () => await page.getByTestId("record-distance").innerText(), {
        timeout: 10_000,
      })
      .toMatch(/^[1-9]\d{2} m$/);

    await page.getByTestId("record-stop").click();
    await expect(page.getByTestId("record-screen")).toHaveAttribute(
      "data-state",
      "finish",
    );
    const pointCount = Number(await page.getByTestId("finish-points").innerText());
    expect(pointCount).toBeGreaterThanOrEqual(10);

    await page.getByTestId("journey-name").fill("Avenue test walk");
    await page.getByTestId("journey-save").click();

    // first run on a fresh stream asks for the journey consent; later runs
    // already hold an accepted journey-v1 row (consent history is append
    // only) and go straight to the saved trip
    const consentAgree = page.getByTestId("journey-consent-agree");
    const savedNote = page.getByTestId("journey-saved-note");
    await expect(consentAgree.or(savedNote)).toBeVisible({ timeout: 15_000 });
    if (await consentAgree.isVisible()) {
      await consentAgree.click();
    }
    await expect(savedNote).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("journey-title")).toHaveText("Avenue test walk");

    // the full reload: land on the list fresh and find the trip again
    await page.goto("/app/journeys");
    await expect(page.getByTestId("journeys-list")).toHaveAttribute(
      "data-loaded",
      "true",
    );
    const card = page
      .getByTestId("journey-card")
      .filter({ hasText: "Avenue test walk" })
      .first();
    await expect(card).toBeVisible();
    await card.click();

    // the saved trace came back from the server: named, measured, drawn
    await expect(page.getByTestId("journey-title")).toHaveText("Avenue test walk");
    const savedPoints = Number(
      await page.getByTestId("journey-points-count").innerText(),
    );
    expect(savedPoints).toBeGreaterThanOrEqual(10);
    await expect(page.getByTestId("journey-distance")).toContainText("m");
    await expect(page.getByTestId("journey-trace-map")).toHaveAttribute(
      "data-trace-count",
      String(savedPoints),
    );
  });
});

test.describe("journey recording without permission", () => {
  // no geolocation grant: the browser denies the watch outright
  test("the denied state is a named card, never silence", async ({ page }) => {
    await loginAs(page, "RIDER");
    await page.goto("/app/record?gps=replay");
    await page.getByTestId("record-start").click();
    await expect(page.getByTestId("record-blocked")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("record-screen")).toHaveAttribute(
      "data-state",
      "denied",
    );
  });
});
