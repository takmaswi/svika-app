// Launch Step 1: the launch-v2 visual system behind the ui_v2 flag. The
// preview cookie turns every launch flag on for this browser
// (e2e/launch-helpers.ts); without it the pre launch app is untouched.
import { expect, test } from "@playwright/test";
import { enableLaunchPreview } from "./launch-helpers";

test.describe("launch-v2 foundation", () => {
  test("the v2 system is on only with the flag", async ({ page, context }) => {
    await page.goto("/privacy");
    await expect(page.locator("html")).not.toHaveAttribute("data-ui", "v2");
    await enableLaunchPreview(context);
    await page.goto("/privacy");
    await expect(page.locator("html")).toHaveAttribute("data-ui", "v2");
  });

  test.describe("with the flag", () => {
    test.beforeEach(async ({ context }) => {
      await enableLaunchPreview(context);
    });

    test("one round language button, no Ndebele coming soon chip", async ({ page }) => {
      await page.goto("/app");
      await expect(page.getByTestId("lang-ndebele")).toHaveCount(0);
      const button = page.getByTestId("lang-button");
      await expect(button).toHaveAccessibleName(/^EN Switch to Shona$/);
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(48);
      await button.click();
      await expect(page.getByTestId("lang-button")).toHaveAccessibleName(/^SN /);
      await page.getByTestId("lang-button").click();
      await expect(page.getByTestId("lang-button")).toHaveAccessibleName(/^EN /);
    });

    test("map credits are a small info button bottom left that opens on tap", async ({
      page,
    }) => {
      await page.goto("/app");
      const credits = page.locator(
        ".maplibregl-ctrl-bottom-left .maplibregl-ctrl-attrib.maplibregl-compact",
      );
      await expect(credits).toHaveCount(1, { timeout: 30_000 });
      await expect(credits).not.toHaveClass(/maplibregl-compact-show/);
      await expect(
        page.locator(".maplibregl-ctrl-top-right .maplibregl-ctrl-attrib"),
      ).toHaveCount(0);
      await credits.locator(".maplibregl-ctrl-attrib-button").click();
      await expect(credits).toHaveClass(/maplibregl-compact-show/);
      await expect(credits).toContainText("OpenStreetMap");
    });

    test("a missing field is named in Svika copy, never the browser bubble", async ({
      page,
    }) => {
      await page.goto("/app");
      await expect(page.locator("label[for=from]")).toBeVisible();
      await page.locator("form.home-search button[type=submit]").click();
      await expect(page).toHaveURL(/\/app$/);
      await expect(page.getByTestId("form-error")).toHaveText(
        "Type where you are starting from.",
      );
      await expect(page.locator("#from")).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator("#from")).toBeFocused();
      await page.locator("#from").fill("Heights");
      await page.locator("form.home-search button[type=submit]").click();
      await expect(page.getByTestId("form-error")).toHaveText(
        "Type where you are going.",
      );
      await expect(page.locator("#to")).toBeFocused();
      await page.locator("#to").fill("Rezende");
      await page.locator("form.home-search button[type=submit]").click();
      await expect(page).toHaveURL(/\/app\/plan\?/);
    });

    test("a one kombi trip says 1 kombi", async ({ page }) => {
      await page.goto("/app/plan?from=Heights&to=Rezende");
      const meta = page.locator(".plan-fare-meta");
      await expect(meta).toContainText(/\b1 kombi\b/);
      await expect(meta).not.toContainText("1 kombis");
    });
  });
});
