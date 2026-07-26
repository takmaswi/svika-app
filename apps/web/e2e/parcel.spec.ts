// Flow 6: parcel booking with LOAD and COLLECT codes. The sender books a
// parcel between two stops on a direct route, gets two codes, and the hwindi
// advances it LOAD → COLLECT. Collect before load is refused, and a wallet
// paid parcel settles to the owner only at collection.
import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { skipKombiStep } from "./helpers";

const CONDUCTOR_URL = "http://localhost:5174";

async function riderClient(): Promise<SupabaseClient> {
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await c.auth.signInWithPassword({
    email: process.env.DEMO_RIDER_EMAIL!,
    password: process.env.DEMO_RIDER_PASSWORD!,
  });
  if (error) throw new Error(`rider sign in failed: ${error.message}`);
  return c;
}

async function loginViaApp(page: Page): Promise<void> {
  const res = await page.request.post("http://localhost:3000/e2e/login", {
    data: {
      email: process.env.DEMO_RIDER_EMAIL!,
      password: process.env.DEMO_RIDER_PASSWORD!,
    },
  });
  expect(res.ok()).toBeTruthy();
}

async function conductorSignIn(page: Page): Promise<void> {
  await page.goto(CONDUCTOR_URL);
  await page.fill("#email", process.env.DEMO_CONDUCTOR_EMAIL!);
  await page.fill("#password", process.env.DEMO_CONDUCTOR_PASSWORD!);
  await page.click("button[type=submit]");
  await expect(page.locator(".hwindi-route").first()).toBeVisible({
    timeout: 15_000,
  });
}

async function typeAndClear(page: Page, code: string): Promise<void> {
  for (const d of code) {
    await page.locator(".hwindi-key", { hasText: d }).first().click();
  }
  await page.locator(".hwindi-cta").click();
}

test("book a parcel, load it, refuse early collect, then collect", async ({
  page,
  browser,
}) => {
  // book through the rider UI: Heights terminus → Rezende Rank (direct route)
  await loginViaApp(page);
  await page.goto("http://localhost:3000/app/parcel");
  await page.selectOption("#parcel-from", { label: "2nd boom gate" });
  await page.selectOption("#parcel-to", { label: "Rezende Rank" });
  await page.click("button[value=wallet]");
  await page.waitForURL("**/app/parcel?booked=1");

  const loadCode = (await page.getByTestId("load-code").first().innerText()).trim();
  const collectCode = (
    await page.getByTestId("collect-code").first().innerText()
  ).trim();
  expect(loadCode).toMatch(/^\d{4}$/);
  expect(collectCode).toMatch(/^\d{4}$/);
  expect(loadCode).not.toBe(collectCode);

  // hwindi: try to COLLECT before it is loaded → refused as not ready
  const ctx = await browser.newContext();
  const hwindi = await ctx.newPage();
  await conductorSignIn(hwindi);
  await hwindi
    .locator(".hwindi-route", { hasText: "HEIGHTS-REZENDE" })
    .filter({ hasText: "Rezende Rank" })
    .first()
    .click();
    await skipKombiStep(hwindi);
  await typeAndClear(hwindi, collectCode);
  await expect(hwindi.getByTestId("verdict")).toHaveClass(/hwindi-verdict-not_ready/, {
    timeout: 15_000,
  });

  // LOAD the parcel
  await hwindi.getByTestId("verdict").locator("button").click();
  await typeAndClear(hwindi, loadCode);
  await expect(hwindi.getByTestId("verdict")).toHaveClass(/hwindi-verdict-success/);
  await expect(hwindi.locator(".hwindi-verdict-word")).toContainText(/loaded|wakwira/i);

  // COLLECT it
  await hwindi.getByTestId("verdict").locator("button").click();
  await typeAndClear(hwindi, collectCode);
  await expect(hwindi.getByTestId("verdict")).toHaveClass(/hwindi-verdict-success/);
  await expect(hwindi.locator(".hwindi-verdict-word")).toContainText(
    /collected|watorwa/i,
  );
  await ctx.close();

  // the sender's parcel shows the event sourced final status
  const rider = await riderClient();
  const { data: parcels } = await rider
    .from("tickets")
    .select("id")
    .eq("kind", "parcel")
    .order("purchased_at", { ascending: false })
    .limit(1);
  const { data: status } = await rider
    .from("ticket_status")
    .select("status")
    .eq("ticket_id", parcels![0]!.id)
    .single();
  expect(status?.status).toBe("collected");
});

test("a stop pair needing a transfer cannot book a parcel", async ({ page }) => {
  await loginViaApp(page);
  await page.goto("http://localhost:3000/app/parcel");
  // Heights terminus → Sam Levy's needs a rank transfer: no direct kombi
  await page.selectOption("#parcel-from", { label: "2nd boom gate" });
  await page.selectOption("#parcel-to", { label: "Sam Levy's Village Bus Stop" });
  await page.click("button[value=wallet]");
  await page.waitForURL("**/app/parcel?err=direct");
  await expect(page.locator(".auth-error")).toBeVisible();
});
