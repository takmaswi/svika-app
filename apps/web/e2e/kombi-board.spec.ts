// Flow (batch K1): tap a kombi on the live map, read its card, walk through
// to the board of every kombi on the corridor. The card and board answer
// "which kombi, and can I trust it": plate and declared seats from the
// seeded registry, live wait for the rider's stop, and the trust record as
// rules over the fare ledger. No vehicle-linked fares exist yet, so every
// kombi shows the unverified default — asserted here on purpose: the trust
// surface must never invent a good record.
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

const PLATE = /^(AEZ 4821|AFK 2903|AGT 1157|ADR 7346)$/;

test.describe("kombi card and board", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "RIDER");
  });

  test("tap kombi opens the card, card walks to the board", async ({ page }) => {
    await page.goto("/app");

    const map = page.getByTestId("live-map");
    await expect(map).toHaveAttribute("data-map-ready", "true", {
      timeout: 30_000,
    });
    const markers = page.locator('[data-testid="kombi-marker"]');
    await expect(markers).toHaveCount(4, { timeout: 15_000 });

    // markers are moving; dispatch skips the pointer stability wait
    await markers.first().dispatchEvent("click");

    const card = page.getByTestId("kombi-card");
    await expect(card).toBeVisible();

    // the registry plate, mono per type law
    await expect(card.getByTestId("kombi-plate")).toHaveText(PLATE);

    // trust: the unverified default is the truthful state of the fleet today
    await expect(card.getByTestId("kombi-trust")).toHaveAttribute(
      "data-trust",
      "unverified",
    );

    // the live wait row and the standing provenance line
    await expect(card.getByTestId("kombi-eta")).toBeVisible();
    await expect(card.getByTestId("kombi-provenance")).toBeVisible();

    // one primary action: the board
    await card.getByTestId("kombi-card-board-link").click();
    await expect(page).toHaveURL(/\/app\/kombis$/);

    const rows = page.getByTestId("kombi-board-row");
    await expect(rows).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect(rows.nth(i).getByTestId("kombi-plate")).toHaveText(PLATE);
      await expect(rows.nth(i).getByTestId("kombi-trust")).toHaveAttribute(
        "data-trust",
        "unverified",
      );
    }
    // the simulated feed is declared on the board too
    await expect(page.getByTestId("kombi-board-list")).toBeVisible();
  });

  test("the board is one tap from the map home", async ({ page }) => {
    await page.goto("/app");
    await page.getByTestId("kombis-chip").click();
    await expect(page).toHaveURL(/\/app\/kombis$/);
    await expect(page.getByTestId("kombi-board-row")).toHaveCount(4);
  });
});
