// Real phone OTP login against a Supabase test phone number: the fixed
// code is configured in the dashboard, no SMS vendor exists anywhere, and
// this drives the SAME LoginForm a rider uses (never the /e2e/login
// endpoint). The number and its code live in .env.local ONLY: a real
// personal number never enters the repo, so without them the spec skips.
import { test, expect } from "@playwright/test";

const phone = process.env.TEST_PHONE_NUMBER;
const otp = process.env.TEST_PHONE_OTP;

test.describe("phone OTP login", () => {
  test.skip(
    !phone || !otp,
    "TEST_PHONE_NUMBER / TEST_PHONE_OTP not set in .env.local",
  );

  test("signs in with the dashboard test OTP, no SMS sent", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#phone").fill(phone!);
    await page.getByRole("button", { name: "Send code" }).click();

    // the code phase renders without any SMS having gone anywhere
    await expect(page.locator("#code")).toBeVisible({ timeout: 15_000 });
    await page.locator("#code").fill(otp!);
    await page.getByRole("button", { name: "Verify" }).click();

    // a session exists: a fresh account lands on the consent gate (consent
    // sits at account creation, the V2 law), a consented one on the app
    await expect(page).toHaveURL(/\/(consent|app)/, { timeout: 20_000 });
  });
});
