// Launch Step 3: the front door. A signed out rider at Market Square Rank
// opens the app, searches, taps a suggestion and reads the step card in
// three interactions; location refused turns From into a field; the first
// win card stays dismissed; the synthetic test route is never offered; and
// with the flag off the old home is untouched.
import { expect, test, type BrowserContext } from "@playwright/test";
import { enableLaunchPreview } from "./launch-helpers";

const MARKET_SQUARE = { latitude: -17.83575, longitude: 31.03992 };

async function atMarketSquare(context: BrowserContext): Promise<void> {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(MARKET_SQUARE);
}

test.describe("front door", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ context }) => {
    await enableLaunchPreview(context);
  });

  test("search, pick, step card: three interactions, no account", async ({
    page,
    context,
  }) => {
    await atMarketSquare(context);
    await page.goto("/app");
    await expect(page.getByTestId("front-door")).toBeVisible();
    await expect(page.getByTestId("guest-signin-chip")).toBeVisible();

    await page.getByTestId("door-search").click(); // 1
    await expect(page.getByTestId("planner-from")).toHaveAttribute("data-me", "true");
    await page.getByTestId("planner-to").fill("Avondale"); // 2
    const first = page.getByTestId("planner-suggestion").first();
    await expect(first).toContainText("Avondale Shops");
    await first.click(); // 3

    await expect(page).toHaveURL(/\/app\/plan\?from=%40-17\.836%2C31\.040&to=/);
    await expect(page.getByTestId("trip-result")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Avondale Shops",
    );
    const steps = page.getByTestId("trip-step");
    await expect(steps.first()).toContainText("Market Square Rank");
    await expect(page.getByTestId("trip-steps")).toContainText(
      "Market Square Rank to Avondale Shops",
    );
    await expect(page.getByTestId("trip-fare")).toHaveText("Not yet");
    await expect(page.getByTestId("trip-start")).toHaveAttribute(
      "href",
      "/login?why=record",
    );
  });

  test("a quick place plans from where you are in one tap", async ({
    page,
    context,
  }) => {
    await atMarketSquare(context);
    await page.goto("/app");
    await page.getByTestId("quick-chip").filter({ hasText: "Avondale" }).click();
    await expect(page.getByTestId("trip-result")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("trip-kombis")).toHaveText("1");
  });

  test("location refused: From becomes a field and the planner says why", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition: (_ok: unknown, fail: (e: { code: number }) => void) =>
            fail({ code: 1 }),
        },
      });
    });
    await page.goto("/app/where");
    await page.getByTestId("planner-to").fill("Avondale");
    await page.getByTestId("planner-suggestion").first().click();
    await expect(page.getByTestId("planner-location-off")).toBeVisible();
    const from = page.getByTestId("planner-from");
    await expect(from).toBeFocused();
    await expect(from).toHaveValue("");
    await from.fill("Market Sq");
    await page.getByTestId("planner-suggestion").first().click();
    await expect(page.getByTestId("trip-result")).toBeVisible({ timeout: 30_000 });
  });

  test("the synthetic test route is never offered", async ({ page }) => {
    await page.goto("/app/where");
    await page.getByTestId("planner-to").fill("Synthetic");
    await expect(page.getByTestId("planner-nomatch")).toBeVisible();
    await expect(page.getByTestId("planner-suggestion")).toHaveCount(0);
    const res = await page.request.get("/places/suggest?q=Synthetic");
    expect(await res.json()).toEqual([]);
  });

  test("the first win card stays dismissed", async ({ page }) => {
    await page.goto("/app/plan?from=Heights&to=Rezende");
    const card = page.getByTestId("first-win");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("first-win-cta")).toHaveAttribute("href", "/signup");
    await page.getByTestId("first-win-dismiss").click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("trip-result")).toBeVisible();
    await expect(page.getByTestId("first-win")).toHaveCount(0);
  });
});

test("with the flag off the old home is untouched", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByTestId("front-door")).toHaveCount(0);
  await expect(page.getByTestId("home-sheet")).toBeVisible();
  const res = await page.request.get("/places/suggest?q=Avondale");
  expect(res.status()).toBe(404);
});
