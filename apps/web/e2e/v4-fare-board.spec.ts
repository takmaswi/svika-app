// Batch V4: the live fare board. Every digital ticket is a verified fare
// observation, and the plan screen shows what riders on this route actually
// paid today.
//
// What is defended here is the honesty of the surface: it counts real tickets
// (buy one, watch the count move), it says what it counted, and it never says
// anything about whether that fare was good, or what the next one will be.
import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loginAs } from "./helpers";

const PLAN = `/app/plan?from=${encodeURIComponent("2nd boom gate")}&to=${encodeURIComponent("Rezende Rank")}`;

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

/** The fare count the board is showing, or null when the board is absent. */
async function openPlan(page: import("@playwright/test").Page): Promise<void> {
  // a unique param defeats the App Router's client cache: two reads of the
  // same URL either side of a purchase would otherwise show the same render
  await page.goto(`${PLAN}&r=${Date.now()}`);
  await expect(page.getByTestId("home-sheet")).toBeVisible({ timeout: 20_000 });
  // the board lives in the sheet body, which is inert until the sheet opens
  await page.locator(".home-sheet-grabber").click();
  await expect(page.locator(".home-sheet-open")).toBeVisible();
}

async function countedFares(page: import("@playwright/test").Page): Promise<number | null> {
  await openPlan(page);
  const counted = page.getByTestId("fare-board-counted");
  if ((await counted.count()) === 0) return null;
  const text = await counted.innerText();
  const m = text.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

test.describe("live fare board", () => {
  test("a fare paid today shows up on the board, counted and labelled", async ({
    page,
  }) => {
    await loginAs(page, "RIDER");
    const before = (await countedFares(page)) ?? 0;

    // a real ticket through the real RPC: the board reads the ledger, so the
    // only honest way to move it is to actually pay a fare
    const rider = await riderClient();
    const { data: route } = await rider
      .from("routes")
      .select("id")
      .eq("code", "HEIGHTS-REZENDE")
      .single();
    const { error } = await rider.rpc("purchase_ticket", {
      p_route: route!.id,
      p_direction: "outbound",
      p_payment: "cash",
    });
    expect(error, error?.message).toBeNull();

    const after = await countedFares(page);
    expect(after).toBe(before + 1);

    const board = page.getByTestId("fare-board");
    await expect(board).toBeVisible();
    // what most riders paid, in mono per the type law
    await expect(page.getByTestId("fare-board-line")).toContainText(/\$\d+\.\d{2}/);
    // and it says what it counted, and refuses to be a prediction
    await expect(page.getByTestId("fare-board-counted")).toContainText(/today/i);
    await expect(board).toContainText(/not a prediction/i);
  });

  test("the same board stands in Shona", async ({ page }) => {
    await loginAs(page, "RIDER");
    await page.context().addCookies([
      { name: "svika_lang", value: "sn", url: "http://localhost:3000" },
    ]);
    await openPlan(page);
    await expect(page.getByTestId("fare-board")).toContainText(/Zvakabhadharwa nhasi/);
    await expect(page.getByTestId("fare-board")).toContainText(/Haisi fungidziro/);
    await page.context().clearCookies({ name: "svika_lang" });
  });
});
