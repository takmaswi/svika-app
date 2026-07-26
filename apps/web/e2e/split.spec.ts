// Flow 4: split a note. One rider's $5 note covers two fares; the hwindi
// records the note and the fares covered, and only the true remainder lands
// in the payer's wallet.
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

async function riderBalance(c: SupabaseClient): Promise<number> {
  const { data } = await c
    .from("account_balances")
    .select("balance_cents")
    .eq("kind", "rider_wallet")
    .single();
  return data!.balance_cents as number;
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

test("a $5 note covering two $1.50 fares credits exactly $2.00", async ({ page }) => {
  const rider = await riderClient();
  const before = await riderBalance(rider);

  // cash reservation on the full Heights run: verified $1.50 flat fare
  const { data: route } = await rider
    .from("routes")
    .select("id")
    .eq("code", "HEIGHTS-REZENDE")
    .single();
  const { data, error } = await rider.rpc("purchase_ticket", {
    p_route: route!.id,
    p_direction: "outbound",
    p_payment: "cash",
  });
  expect(error).toBeNull();
  const code = (data![0] as { board_code: string }).board_code;

  await conductorSignIn(page);
  await page
    .locator(".hwindi-route", { hasText: "HEIGHTS-REZENDE" })
    .filter({ hasText: "Rezende Rank" })
    .first()
    .click();
    await skipKombiStep(page);
  for (const d of code) {
    await page.locator(".hwindi-key", { hasText: d }).first().click();
  }
  await page.locator(".hwindi-cta").click();
  await expect(page.getByTestId("verdict")).toHaveClass(/hwindi-verdict-success/, {
    timeout: 15_000,
  });

  // change flow: bump fares covered to 2 (the payer covers a companion)
  await page.getByTestId("change-offer").click();
  await page.locator(".hwindi-covered-row button", { hasText: "+" }).click();
  await expect(page.getByTestId("fares-covered")).toHaveText("2");

  // $2 and under notes cannot cover 2 × $1.50; $5 can
  await expect(page.locator(".hwindi-note-btn", { hasText: "$2.00" })).toBeDisabled();
  await page.locator(".hwindi-note-btn", { hasText: "$5.00" }).click();

  await expect(page.getByTestId("change-done")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByTestId("change-done").locator(".hwindi-verdict-code"),
  ).toHaveText("$2.00"); // 500 - 2×150

  const after = await riderBalance(rider);
  expect(after - before).toBe(200);
});
