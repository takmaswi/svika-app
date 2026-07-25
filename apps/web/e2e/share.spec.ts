// Share my ride: the rider mints a link from a live ticket, a viewer with no
// account follows the trip, revoking kills the link, and a wrong token gets
// the same quiet dead state. The viewer page must never show who is riding
// or their boarding code.
import { test, expect } from "@playwright/test";
import { loginAs, waitForHydration } from "./helpers";

test.describe("share my ride", () => {
  test("mint, follow without an account, revoke", async ({ page, browser }) => {
    await loginAs(page, "RIDER");

    // a fresh live ticket to share
    await page.goto("/app/plan?from=heights&to=rezende");
    await waitForHydration(page);
    await page.locator('.plan-pay button[value="wallet"]').click();
    await expect(page).toHaveURL(/booked=1/, { timeout: 15_000 });

    // booked=1 opens the sheet by itself; the newest ticket sits on top.
    // Navigate by the link's own href: the rider account's home now answers
    // with a mined commute peek (suite history finally minable, 2026-07-26),
    // and the sheet re-laying out under a tap made the click path wander.
    // Tapping list rows is covered by book and mobile-qa; the thing under
    // test HERE is the share section on the ticket.
    await waitForHydration(page);
    const ticketHref = await page
      .locator(".ticket-item")
      .first()
      .getAttribute("href");
    expect(ticketHref).toMatch(/\/app\/ticket\//);
    await page.goto(ticketHref!);
    await expect(page.getByTestId("share-section")).toBeVisible();

    // mint the link
    await page.getByTestId("share-create").click();
    await expect(page.getByTestId("share-url")).toBeVisible();
    const shareUrl = (await page.getByTestId("share-url").innerText()).trim();
    expect(shareUrl).toMatch(/\/share\/[0-9a-f]{32}$/);

    // the viewer: a fresh context with no session at all
    const viewerContext = await browser.newContext();
    const viewer = await viewerContext.newPage();
    await viewer.goto(shareUrl);
    await expect(viewer.getByTestId("share-view")).toBeVisible();
    await expect(viewer.getByTestId("share-status")).toHaveText("Waiting to board");
    await expect(viewer.getByTestId("share-eta")).toContainText("min");
    const body = await viewer.locator("body").innerText();
    expect(body).not.toContain("Test Rider"); // no rider identity
    expect(body).not.toMatch(/\b\d{4}\b/); // no 4 digit board code anywhere

    // the disclosure is on the expanded sheet
    await viewer.click(".home-sheet-grabber");
    await expect(viewer.getByTestId("share-disclosure")).toBeVisible();

    // revoke from the ticket
    await page.getByTestId("share-revoke").click();
    await expect(page.getByTestId("share-revoked")).toBeVisible();

    // the viewer's link is dead now
    await viewer.reload();
    await expect(viewer.getByTestId("share-dead")).toBeVisible();
    await viewerContext.close();
  });

  test("a wrong token lands on the same quiet dead state", async ({ page }) => {
    await page.goto("/share/00000000000000000000000000000000");
    await expect(page.getByTestId("share-dead")).toBeVisible();
  });
});
