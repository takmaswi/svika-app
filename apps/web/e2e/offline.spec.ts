// P2: offline boarding, end to end. Playwright's setOffline stands in for
// airplane mode: the conductor caches the route, loses the network, clears a
// fare against the local cache, and the queue reconciles the ledger when the
// signal returns. The double redeem conflict (offline device vs online
// clear) resolves first sync wins and flags the second.
//
// The single take phone video Mhofu records follows this same script
// (docs/p2-recording-script.md).
import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CONDUCTOR_URL = "http://localhost:5174";

function anonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in ${email} failed: ${error.message}`);
  return c;
}

async function buyTicket(rider: SupabaseClient): Promise<{
  code: string;
  ticketId: string;
  routeId: string;
}> {
  const { data: route } = await rider
    .from("routes")
    .select("id")
    .eq("code", "HEIGHTS-REZENDE")
    .single();
  const { data, error } = await rider.rpc("purchase_ticket", {
    p_route: route!.id,
    p_direction: "outbound",
    p_payment: "wallet",
  });
  if (error) throw new Error(`purchase failed: ${error.message}`);
  const row = data[0] as { ticket_id: string; board_code: string };
  return { code: row.board_code, ticketId: row.ticket_id, routeId: route!.id as string };
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

/** pick the route and wait for the offline cache pull to land */
async function pickHeightsOutboundCached(page: Page): Promise<void> {
  const pull = page.waitForResponse(
    (r) => r.url().includes("pull_offline_cache") && r.ok(),
    { timeout: 15_000 },
  );
  await page
    .locator(".hwindi-route", { hasText: "HEIGHTS-REZENDE" })
    .filter({ hasText: "Rezende Rank" })
    .first()
    .click();
  // the kombi step (V5) sits between the route and the keypad. Offline
  // boarding proves the money path, not the shift declaration, so this walks
  // past it; the queued event then carries a null vehicle, which the sync RPC
  // has always accepted.
  await page
    .getByTestId("vehicle-picker")
    .waitFor({ timeout: 5_000 })
    .catch(() => {});
  const skip = page.getByTestId("vehicle-skip");
  if ((await skip.count()) > 0) await skip.click();
  await page.locator(".hwindi-key").first().waitFor({ timeout: 10_000 });
  await pull;
}

async function typeCode(page: Page, code: string): Promise<void> {
  for (const d of code) {
    await page.locator(".hwindi-key", { hasText: d }).first().click();
  }
  await expect(page.getByTestId("code-display")).toHaveText(code);
  await page.locator(".hwindi-cta").click();
}

async function ticketStatus(rider: SupabaseClient, ticketId: string): Promise<string> {
  const { data } = await rider
    .from("ticket_status")
    .select("status")
    .eq("ticket_id", ticketId)
    .single();
  return data?.status ?? "unknown";
}

test.describe("offline boarding", () => {
  test("clears a fare in airplane mode and reconciles the ledger on reconnect", async ({
    page,
    context,
  }) => {
    const rider = await signedIn(
      process.env.DEMO_RIDER_EMAIL!,
      process.env.DEMO_RIDER_PASSWORD!,
    );
    const { code, ticketId } = await buyTicket(rider);

    await conductorSignIn(page);
    await pickHeightsOutboundCached(page);

    // airplane mode
    await context.setOffline(true);
    await expect(page.getByTestId("status-pill")).toContainText(/Offline|Hapana/, {
      timeout: 10_000,
    });

    await typeCode(page, code);
    const verdict = page.getByTestId("verdict");
    await expect(verdict).toHaveClass(/hwindi-verdict-success/, { timeout: 15_000 });
    await expect(page.getByTestId("offline-note")).toBeVisible();

    // truly offline: the server has not heard about it
    expect(await ticketStatus(rider, ticketId)).toBe("issued");

    // signal returns; the queue replays and the ledger settles
    await context.setOffline(false);
    await expect
      .poll(async () => ticketStatus(rider, ticketId), { timeout: 20_000 })
      .toBe("redeemed");

    const admin = adminClient();
    const { data: txns } = await admin
      .from("ledger_transactions")
      .select("id")
      .eq("ticket_id", ticketId)
      .eq("kind", "fare_settlement");
    expect(txns).toHaveLength(1);

    const { data: postings } = await admin
      .from("ledger_postings")
      .select("amount_cents")
      .in("transaction_id", (txns ?? []).map((t) => t.id));
    const sum = (postings ?? []).reduce((a, p) => a + p.amount_cents, 0);
    expect(sum).toBe(0);

    const { data: events } = await admin
      .from("ticket_events")
      .select("event_type, detail")
      .eq("ticket_id", ticketId)
      .eq("event_type", "redeemed");
    expect(events).toHaveLength(1);
    expect((events?.[0]?.detail as { offline?: boolean }).offline).toBe(true);
  });

  test("the same code entered twice offline is refused on the device", async ({
    page,
    context,
  }) => {
    const rider = await signedIn(
      process.env.DEMO_RIDER_EMAIL!,
      process.env.DEMO_RIDER_PASSWORD!,
    );
    const { code } = await buyTicket(rider);

    await conductorSignIn(page);
    await pickHeightsOutboundCached(page);
    await context.setOffline(true);

    await typeCode(page, code);
    const verdict = page.getByTestId("verdict");
    await expect(verdict).toHaveClass(/hwindi-verdict-success/, { timeout: 15_000 });

    await verdict.locator("button.hwindi-cta").click();
    await typeCode(page, code);
    await expect(page.getByTestId("verdict")).toHaveClass(
      /hwindi-verdict-already_redeemed/,
      { timeout: 15_000 },
    );
  });

  test("double redeem conflict: first sync wins, second flags, no double spend", async ({
    page,
    context,
  }) => {
    const rider = await signedIn(
      process.env.DEMO_RIDER_EMAIL!,
      process.env.DEMO_RIDER_PASSWORD!,
    );
    const { code, ticketId, routeId } = await buyTicket(rider);

    // the device caches the pending code, then loses signal
    await conductorSignIn(page);
    await pickHeightsOutboundCached(page);
    await context.setOffline(true);

    // it clears the fare offline (queued locally)
    await typeCode(page, code);
    await expect(page.getByTestId("verdict")).toHaveClass(/hwindi-verdict-success/, {
      timeout: 15_000,
    });

    // meanwhile the same code is cleared ONLINE elsewhere and wins
    const conductorElsewhere = await signedIn(
      process.env.DEMO_CONDUCTOR_EMAIL!,
      process.env.DEMO_CONDUCTOR_PASSWORD!,
    );
    const { data: onlineRedeem } = await conductorElsewhere.rpc("redeem_board_code", {
      p_route: routeId,
      p_direction: "outbound",
      p_code: code,
    });
    expect(onlineRedeem?.[0]?.outcome).toBe("success");

    // the offline device reconnects; its queued event must lose, flag, and
    // move no money
    await context.setOffline(false);

    const admin = adminClient();
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("anomaly_flags")
            .select("id")
            .eq("kind", "offline_duplicate_redemption")
            .eq("ticket_id", ticketId);
          return data?.length ?? 0;
        },
        { timeout: 20_000 },
      )
      .toBe(1);

    const { data: txns } = await admin
      .from("ledger_transactions")
      .select("id")
      .eq("ticket_id", ticketId)
      .eq("kind", "fare_settlement");
    expect(txns).toHaveLength(1);

    const { data: events } = await admin
      .from("ticket_events")
      .select("id")
      .eq("ticket_id", ticketId)
      .eq("event_type", "redeemed");
    expect(events).toHaveLength(1);
  });
});
