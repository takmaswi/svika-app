// Guest mode (batch V2): the map, planning and fares work logged out and
// read only; the OTP wall stands exactly at the identity moments and says
// why an account exists. No consent gate for guests: consent guards
// accounts, and a guest holds no data to consent over.
import { test, expect } from "@playwright/test";
import { waitForHydration } from "./helpers";

test.describe("guest mode", () => {
  test("plan a trip logged out, hit the wall only at pay", async ({ page }) => {
    // the guest door is the landing's PRIMARY CTA (ruling 6: value before
    // the wall); sign in waits on the line below it
    await page.goto("/");
    const door = page.getByTestId("landing-cta");
    await expect(door).toHaveAttribute("href", "/app");
    await expect(page.getByTestId("landing-signin")).toBeVisible();
    await door.click();

    // the guest home: map, search, corridor fare; nothing personal
    await expect(page.getByTestId("guest-home")).toBeVisible();
    await expect(page.getByTestId("guest-signin-chip")).toBeVisible();
    await expect(page.getByTestId("peek-stats")).toBeVisible();
    const homeBody = await page.locator("body").innerText();
    expect(homeBody).not.toContain("Wallet balance");

    // plan a real corridor trip with free text, logged out
    await page.locator("#from").fill("heights");
    await page.locator("#to").fill("rezende");
    await page.locator(".home-search-go").click();

    // the plan answers with route, time and fare: no wall yet (the leg
    // list sits behind the sheet grabber, same as for a signed in rider)
    await expect(page.locator(".plan-total")).toBeVisible();
    await waitForHydration(page);
    await page.click(".home-sheet-grabber");
    await expect(page.locator(".plan-legs .plan-leg").first()).toBeVisible();

    // the wall stands exactly at pay: no pay buttons exist for a guest
    await expect(page.locator('.plan-pay button[value="wallet"]')).toHaveCount(0);
    await expect(page.locator('.plan-pay button[value="cash"]')).toHaveCount(0);
    await expect(page.getByTestId("guest-pay-wall")).toBeVisible();
    await expect(page.getByTestId("guest-save-wall")).toBeVisible();

    // tapping it lands on the login with the pay reason spelled out
    await page.getByTestId("guest-pay-wall").click();
    await expect(page).toHaveURL(/\/login\?why=pay&next=/);
    await expect(page.getByTestId("login-why")).toContainText(
      "Paying needs an account",
    );
  });

  test("recording walls with its own reason; personal pages stay shut", async ({
    page,
  }) => {
    await page.goto("/app/record");
    await expect(page).toHaveURL(/\/login\?why=record/);
    await expect(page.getByTestId("login-why")).toContainText(
      "Recording a journey needs an account",
    );

    // personal surfaces never render for a guest
    for (const path of ["/app/wallet", "/app/profile", "/app/family"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("the kombi board opens for guests (rulings 5 and 7)", async ({ page }) => {
    // trust visibility is public value: the chip is on the guest home and
    // the board renders logged out from the 0037 aggregates, identity cells
    // degraded to the corridor's first rank
    await page.goto("/app");
    await expect(page.getByTestId("guest-home")).toBeVisible();
    await waitForHydration(page);
    await page.getByTestId("kombis-chip").click();
    await expect(page).toHaveURL(/\/app\/kombis/);
    await expect(page.getByTestId("kombi-board-row").first()).toBeVisible({
      timeout: 15_000,
    });
    // aggregates only: nothing personal exists to leak on this screen
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Wallet");
  });

  test("the guest home speaks Shona too", async ({ page }) => {
    await page.context().addCookies([
      { name: "svika_lang", value: "sn", url: "http://localhost:3000" },
    ]);
    await page.goto("/app");
    await expect(page.getByTestId("guest-home")).toBeVisible();
    await expect(page.getByTestId("guest-why")).toContainText("Svika ikuyeuke");
  });
});
