// Flow 3: change to credit. A cash fare is cleared, the hwindi records the
// note the rider paid with, and the unreturned change lands in the rider's
// wallet through the ledger (no mutable balance anywhere). Also proves the
// guards: wallet fares offer no change flow, and a second credit for the
// same ticket is refused by the database.
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

async function reserveCashTicket(
  c: SupabaseClient,
): Promise<{ code: string; ticketId: string; fareCents: number }> {
  const { data: route } = await c
    .from("routes")
    .select("id")
    .eq("code", "HEIGHTS-REZENDE")
    .single();
  const { data, error } = await c.rpc("purchase_ticket", {
    p_route: route!.id,
    p_direction: "outbound",
    p_payment: "cash",
  });
  if (error) throw new Error(`reserve failed: ${error.message}`);
  const row = data[0] as {
    ticket_id: string;
    board_code: string;
    fare_cents: number;
  };
  return {
    code: row.board_code,
    ticketId: row.ticket_id,
    fareCents: row.fare_cents,
  };
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

async function clearCode(page: Page, code: string): Promise<void> {
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
}

test.describe("change to credit", () => {
  test("unreturned change on a $5 note becomes wallet credit via the ledger", async ({
    page,
  }) => {
    const rider = await riderClient();
    const before = await riderBalance(rider);
    const { code, ticketId, fareCents } = await reserveCashTicket(rider);
    expect(fareCents).toBe(150); // verified end to end fare (flat corridor fare)

    await conductorSignIn(page);
    await clearCode(page, code);

    // cash fare: the verdict offers the change flow
    await page.getByTestId("change-offer").click();
    await page.locator(".hwindi-note-btn", { hasText: "$5.00" }).click();

    await expect(page.getByTestId("change-done")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByTestId("change-done").locator(".hwindi-verdict-code"),
    ).toHaveText("$3.50");

    // the rider's ledger derived balance rose by exactly the change
    const after = await riderBalance(rider);
    expect(after - before).toBe(350);

    // a second credit for the same ticket is refused by the database
    const conductor = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    await conductor.auth.signInWithPassword({
      email: process.env.DEMO_CONDUCTOR_EMAIL!,
      password: process.env.DEMO_CONDUCTOR_PASSWORD!,
    });
    const dup = await conductor.rpc("record_change_credit", {
      p_ticket: ticketId,
      p_note_cents: 500,
    });
    expect(dup.error?.message ?? "").toContain("already credited");
  });

  test("a wallet fare offers no change flow", async ({ page }) => {
    const rider = await riderClient();
    const { data: route } = await rider
      .from("routes")
      .select("id")
      .eq("code", "WESTGATE-COPA")
      .single();
    const { data, error } = await rider.rpc("purchase_ticket", {
      p_route: route!.id,
      p_direction: "outbound",
      p_payment: "wallet",
    });
    expect(error).toBeNull();
    const code = (data![0] as { board_code: string }).board_code;

    await conductorSignIn(page);
    await page
      .locator(".hwindi-route", { hasText: "WESTGATE-COPA" })
      .filter({ hasText: "Avondale" })
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
    await expect(page.getByTestId("change-offer")).toHaveCount(0);
  });
});
