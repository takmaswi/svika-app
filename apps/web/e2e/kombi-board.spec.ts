// Flow (batch K1): tap a kombi on the live map, read its card, walk through
// to the board of every kombi on the corridor. The card and board answer
// "which kombi, and can I trust it": plate and declared seats from the
// seeded registry, live wait for the rider's stop, and the trust record as
// rules over the fare ledger.
//
// Trust used to be asserted as a flat "unverified" here, which held only
// because no fare in the database carried a vehicle id at all. The V5 shift
// declaration changed that, so the assertion now says the thing that must be
// true forever instead: the chip shows exactly the state the ledger implies,
// and a kombi with no verified fare history is unverified, full stop. The
// surface must never invent a good record.
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAs } from "./helpers";
import { deriveTrustState } from "../src/lib/kombi/trust";
import type { KombiBoardRow } from "../src/lib/kombi/fleet";

const PLATE = /^(AEZ 4821|AFK 2903|AGT 1157|ADR 7346)$/;

/** The trust state each plate's own ledger counts imply, read as the rider. */
async function trustByPlate(): Promise<Record<string, string>> {
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
  const { data } = await c.rpc("kombi_board");
  const rows = (data ?? []) as KombiBoardRow[];
  return Object.fromEntries(
    rows.map((r) => [
      r.plate,
      deriveTrustState({
        verifiedFares30d: r.verified_fares_30d,
        fareDays30d: r.fare_days_30d,
        declaredCapacity: r.capacity,
        peakHourLoad30d: r.peak_hour_load_30d,
        driftDays30d: r.drift_days_30d,
      }),
    ]),
  );
}

test.describe("kombi card and board", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "RIDER");
  });

  test("tap kombi opens the card, card walks to the board", async ({ page }) => {
    const expected = await trustByPlate();
    // prime the board route so the dev server's first compile of it never
    // races the navigation assertion mid suite
    await page.request.get("/app/kombis");
    await page.goto("/app");

    const map = page.getByTestId("live-map");
    await expect(map).toHaveAttribute("data-map-ready", "true", {
      timeout: 30_000,
    });
    const markers = page.locator('[data-testid="kombi-marker"]');
    await expect(markers).toHaveCount(4, { timeout: 15_000 });

    // markers are moving; dispatch skips the pointer stability wait
    await markers.first().dispatchEvent("click");

    const card = page.getByTestId("kombi-card");
    await expect(card).toBeVisible();

    // the registry plate, mono per type law
    await expect(card.getByTestId("kombi-plate")).toHaveText(PLATE);

    // trust: exactly what this kombi's own ledger counts imply
    const cardPlate = await card.getByTestId("kombi-plate").innerText();
    await expect(card.getByTestId("kombi-trust")).toHaveAttribute(
      "data-trust",
      expected[cardPlate.trim()]!,
    );

    // the live wait row and the standing provenance line
    await expect(card.getByTestId("kombi-eta")).toBeVisible();
    await expect(card.getByTestId("kombi-provenance")).toBeVisible();

    // one primary action: the board. The generous timeout covers the dev
    // server's first compile of the route mid suite.
    await card.getByTestId("kombi-card-board-link").click();
    await expect(page).toHaveURL(/\/app\/kombis$/, { timeout: 20_000 });

    const rows = page.getByTestId("kombi-board-row");
    await expect(rows).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const plate = (await rows.nth(i).getByTestId("kombi-plate").innerText()).trim();
      expect(plate).toMatch(PLATE);
      await expect(rows.nth(i).getByTestId("kombi-trust")).toHaveAttribute(
        "data-trust",
        expected[plate]!,
      );
    }
    // and the rule that must hold whatever the ledger says: no verified fare
    // history means unverified, never a courtesy upgrade
    for (const [plate, state] of Object.entries(expected)) {
      if (state !== "unverified") continue;
      const row = rows.filter({ hasText: plate });
      await expect(row.getByTestId("kombi-trust")).toHaveAttribute(
        "data-trust",
        "unverified",
      );
    }
    // the simulated feed is declared on the board too
    await expect(page.getByTestId("kombi-board-list")).toBeVisible();
  });

  test("the board is one tap from the map home", async ({ page }) => {
    await page.goto("/app");
    await page.getByTestId("kombis-chip").click();
    await expect(page).toHaveURL(/\/app\/kombis$/, { timeout: 20_000 });
    await expect(page.getByTestId("kombi-board-row")).toHaveCount(4);
  });
});
