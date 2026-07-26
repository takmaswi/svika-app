// Batch V5: rank pulse. The hwindi declares which kombi they are on, clears a
// fare on it, and the rider's kombi card counts up. That whole chain is the
// feature: the shift declaration is what links a fare to a vehicle at all
// (before it, every ticket_events row carried a null vehicle_id), and the
// count against declared seats is what the rider reads.
//
// The assertion is a DELTA, not an absolute: the pulse window is 20 minutes,
// so a suite run twice inside it legitimately sees a higher count. What must
// hold every time is that one cleared fare moves the rider's card by exactly
// one.
import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loginAs } from "./helpers";

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

async function buyTicket(c: SupabaseClient): Promise<string> {
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
  return (data as { board_code: string }[])[0]!.board_code;
}

/** The pulse count the rider's board shows for one plate, or null if absent. */
async function pulseFaresFor(page: Page, plate: string): Promise<number | null> {
  await page.goto("/app/kombis");
  const row = page.getByTestId("kombi-board-row").filter({ hasText: plate });
  await expect(row).toHaveCount(1, { timeout: 20_000 });
  const pulse = row.getByTestId("kombi-pulse");
  if ((await pulse.count()) === 0) return null;
  const text = await pulse.locator(".kombi-eta-value").innerText();
  const m = text.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

async function conductorSignIn(page: Page): Promise<void> {
  await page.goto(CONDUCTOR_URL);
  await page.fill("#email", process.env.DEMO_CONDUCTOR_EMAIL!);
  await page.fill("#password", process.env.DEMO_CONDUCTOR_PASSWORD!);
  await page.click("button[type=submit]");
  await expect(page.locator(".hwindi-route").first()).toBeVisible({ timeout: 15_000 });
}

async function typeCode(page: Page, code: string): Promise<void> {
  for (const d of code) {
    await page.locator(".hwindi-key", { hasText: d }).first().click();
  }
  await expect(page.getByTestId("code-display")).toHaveText(code);
  await page.locator(".hwindi-cta").click();
}

test.describe("rank pulse", () => {
  test("a fare cleared on a declared kombi moves that kombi's rider card", async ({
    page,
    context,
  }) => {
    const rider = await riderClient();
    const code = await buyTicket(rider);

    // the hwindi picks the route, then the kombi
    await conductorSignIn(page);
    await page
      .locator(".hwindi-route", { hasText: "HEIGHTS-REZENDE" })
      .filter({ hasText: "Rezende Rank" })
      .first()
      .click();

    const picker = page.getByTestId("vehicle-picker");
    await expect(picker).toBeVisible();
    const option = page.getByTestId("vehicle-option").first();
    const plate = (await option.locator(".svika-mono-code").innerText()).trim();
    expect(plate).toMatch(/^[A-Z]{3} \d{4}$/);

    // the rider's card for that exact kombi, before the fare
    const riderPage = await context.newPage();
    await loginAs(riderPage, "RIDER");
    const before = await pulseFaresFor(riderPage, plate);
    expect(before, "the board must show a pulse row for a registry kombi").not.toBeNull();

    await option.click();
    // the shift now carries the kombi, visible on the keypad header
    await expect(page.getByTestId("shift-vehicle")).toHaveText(plate);

    await typeCode(page, code);
    await expect(page.getByTestId("verdict")).toHaveClass(/hwindi-verdict-success/, {
      timeout: 15_000,
    });

    // exactly one more fare on that kombi's card
    const after = await pulseFaresFor(riderPage, plate);
    expect(after).toBe((before ?? 0) + 1);

    // and the row states what it counted, so it can never read as a promise
    await expect(riderPage.getByTestId("kombi-pulse-basis").first()).toContainText(
      /last \d+ minutes/,
    );
    await riderPage.close();
  });

  test("the kombi step is skippable and the fare still clears", async ({ page }) => {
    const rider = await riderClient();
    const code = await buyTicket(rider);

    await conductorSignIn(page);
    await page
      .locator(".hwindi-route", { hasText: "HEIGHTS-REZENDE" })
      .filter({ hasText: "Rezende Rank" })
      .first()
      .click();
    await page.getByTestId("vehicle-skip").click();

    // no kombi pill on the keypad: nothing was declared, nothing is implied
    await expect(page.getByTestId("shift-vehicle")).toHaveCount(0);

    await typeCode(page, code);
    await expect(page.getByTestId("verdict")).toHaveClass(/hwindi-verdict-success/, {
      timeout: 15_000,
    });
  });
});
