// Flow 2: board code → conductor redeem (online). The rider's ticket is
// bought through the same RPC the app uses; the hwindi clears it through the
// real keypad surface. Codes are scoped to route + direction + window and a
// second clear of the same code is refused.
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

async function buyTicket(c: SupabaseClient): Promise<{
  code: string;
  ticketId: string;
}> {
  const { data: route } = await c
    .from("routes")
    .select("id")
    .eq("code", "HEIGHTS-REZENDE")
    .single();
  const { data, error } = await c.rpc("purchase_ticket", {
    p_route: route!.id,
    p_direction: "outbound",
    p_payment: "wallet",
  });
  if (error) throw new Error(`purchase failed: ${error.message}`);
  const row = data[0] as { ticket_id: string; board_code: string };
  return { code: row.board_code, ticketId: row.ticket_id };
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

async function pickHeightsOutbound(page: Page): Promise<void> {
  await page
    .locator(".hwindi-route", { hasText: "HEIGHTS-REZENDE" })
    .filter({ hasText: "Rezende Rank" })
    .first()
    .click();
    await skipKombiStep(page);
}

async function typeCode(page: Page, code: string): Promise<void> {
  for (const d of code) {
    await page.locator(".hwindi-key", { hasText: d }).first().click();
  }
  await expect(page.getByTestId("code-display")).toHaveText(code);
  await page.locator(".hwindi-cta").click();
}

test.describe("conductor online redeem", () => {
  test("clears a valid code once and refuses it the second time", async ({ page }) => {
    const rider = await riderClient();
    const { code, ticketId } = await buyTicket(rider);

    await conductorSignIn(page);
    await pickHeightsOutbound(page);
    await typeCode(page, code);

    const verdict = page.getByTestId("verdict");
    await expect(verdict).toHaveClass(/hwindi-verdict-success/, {
      timeout: 15_000,
    });

    // rider's event sourced status followed
    const { data: status } = await rider
      .from("ticket_status")
      .select("status")
      .eq("ticket_id", ticketId)
      .single();
    expect(status?.status).toBe("redeemed");

    // same code again: refused, logged as already_redeemed
    await verdict.locator("button").click();
    await typeCode(page, code);
    await expect(page.getByTestId("verdict")).toHaveClass(
      /hwindi-verdict-already_redeemed/,
    );
  });

  test("a code from the wrong direction is a wrong code, not a clear", async ({
    page,
  }) => {
    const rider = await riderClient();
    const { code } = await buyTicket(rider); // outbound ticket

    await conductorSignIn(page);
    // pick the INBOUND direction of the same route
    await page
      .locator(".hwindi-route", { hasText: "HEIGHTS-REZENDE" })
      .filter({ hasText: "2nd boom gate" })
      .first()
      .click();
      await skipKombiStep(page);
    await typeCode(page, code);
    await expect(page.getByTestId("verdict")).toHaveClass(
      /hwindi-verdict-invalid_code/,
    );
  });
});
