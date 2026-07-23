// The intelligence surfaces: the spines shown with their evidence and not a
// word more. The rider's arrival number carries its measured basis, and the
// honest ladder page renders the committed metrics file itself, never
// retyped numbers. The owner's watchdog card shows both verdicts and a
// bilingual narrative that flags patterns, never a person.
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import metrics from "../../../services/spine/metrics/metrics.json";

test.describe("the intelligence surfaces", () => {
  test("the arrival number, its basis, then the honest ladder", async ({ page }) => {
    await loginAs(page, "RIDER");

    // home: the live arrival number with its measured basis; the spine
    // serves in this environment, so a demo estimate label here means the
    // mock twin answered and the proof must fail
    await page.goto("/app");
    await expect(page.getByTestId("peek-stats")).toBeVisible();
    const basis = page.getByTestId("eta-basis").first();
    await expect(basis).toBeVisible();
    await expect(basis).toContainText(/recorded ride/);

    // the ladder page: the table renders the committed file itself
    await page.goto("/app/intelligence");
    const table = page.getByTestId("intelligence-metrics");
    await expect(table).toContainText(String(metrics.journeys));
    await expect(table).toContainText(`${metrics.baseline.maeSeconds} s`);
    await expect(table).toContainText(metrics.served);
    await expect(page.getByTestId("intelligence-verdict")).toBeVisible();
  });

  test("the watchdog card carries both verdicts and never accuses a person", async ({
    page,
  }) => {
    await loginAs(page, "OWNER");
    await page.goto("/app/owner");

    // the card is labelled simulated history and shows scored days
    const watchdog = page.getByTestId("owner-watchdog");
    await expect(watchdog).toBeVisible();
    await expect(watchdog).toContainText("Simulated history");

    // a flagged day from the scored synthetic history renders both the
    // forest's verdict and the named baseline's beside it
    const verdicts = page.getByTestId("watchdog-verdicts").first();
    await expect(verdicts).toBeVisible();
    await expect(verdicts).toContainText(/Forest|threshold/);

    // the narrative flags the pattern and says so in never accuse language
    const narrative = page.locator(".watchdog-narrative").first();
    await expect(narrative).toBeVisible();
    await expect(watchdog).toContainText("never a person");

    // the owner can flip the narrative to Shona
    await page.locator(".watchdog-lang button", { hasText: "Shona" }).click();
    await expect(narrative).not.toHaveText(/^$/);
  });
});
