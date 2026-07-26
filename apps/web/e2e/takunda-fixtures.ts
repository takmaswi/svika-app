// Rebuilds Takunda's fixture commute history relative to now, exactly as the
// seed does (packages/db/seed/seed.mjs, ensureTakunda), but shifted by an
// offset so a spec can stage a moment: 0 minutes lands the mined window on
// the present (the usual-trip peek), a few hours lands it earlier today (the
// ride-back peek). Goes through reset_demo_commute_history as Takunda
// himself, which the RPC allows only for demo_sim profiles, so real history
// is never touched. Callers must restore with offsetMinutes 0 when done.
import { createClient } from "@supabase/supabase-js";

const TAKUNDA_EMAIL = "demo.takunda@svika.app";
// Two rides per day across the miner's whole 28 day lookback (56 rides,
// the RPC caps at 60). Density matters, not just coverage: every e2e run
// books a REAL ticket as Takunda that can never be deleted (wallet paid,
// ledger FK), so those strays accumulate at arbitrary times of day and
// drag the mined median off "now" once they outnumber the fixture. 56
// fresh fixture rides keep the median inside the staged window against
// any realistic stray mass in a 28 day window (found 2026-07-25 when 43
// strays broke the 14 ride fixture; reproduced on baseline).
const HISTORY_DAYS = 28;
const RIDES_PER_DAY = 2;

export async function rebuildTakundaHistory(offsetMinutes: number): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const password = process.env.DEMO_JUDGE_PASSWORD;
  if (!url || !anon || !password) {
    throw new Error(
      "missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / DEMO_JUDGE_PASSWORD",
    );
  }

  const supabase = createClient(url, anon);
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: TAKUNDA_EMAIL,
    password,
  });
  if (authErr) throw authErr;

  const { data: route, error: routeErr } = await supabase
    .from("routes")
    .select("id")
    .eq("code", "HEIGHTS-REZENDE")
    .single();
  if (routeErr) throw routeErr;
  const { data: stops, error: stopsErr } = await supabase
    .from("route_stops")
    .select("stop_id, seq")
    .eq("route_id", route.id)
    .eq("direction", "outbound")
    .order("seq");
  if (stopsErr) throw stopsErr;
  const from = stops[0]!.stop_id as string;
  const to = stops[stops.length - 1]!.stop_id as string;

  // same jitter shape as the seed, shifted by the offset; the second ride
  // of each day sits a few minutes on the other side of the anchor so the
  // median stays pinned to the staged moment
  const rides = [];
  for (let d = 0; d < HISTORY_DAYS; d++) {
    for (let r = 0; r < RIDES_PER_DAY; r++) {
      const jitterMinutes = (r === 0 ? 6 : -14) + (((d + r) * 7) % 20);
      const at = new Date(
        Date.now() -
          offsetMinutes * 60_000 -
          d * 24 * 60 * 60_000 -
          jitterMinutes * 60_000,
      );
      // fixture rides must sit in the past (RPC law): clamp the negative
      // jitter side just behind now
      rides.push({
        at: (at.getTime() >= Date.now() ? new Date(Date.now() - 60_000) : at).toISOString(),
      });
    }
  }
  const { error: histErr } = await supabase.rpc("reset_demo_commute_history", {
    p_profile: auth.user.id,
    p_route: route.id,
    p_direction: "outbound",
    p_from: from,
    p_to: to,
    p_fare_cents: 150,
    p_rides: rides,
  });
  if (histErr) throw histErr;
  await supabase.auth.signOut();
}

/**
 * How Takunda's fixture history compares with the stray rides that have piled
 * up on that account.
 *
 * Every e2e run that books as Takunda (the D1 and D2 flows do) leaves a REAL
 * ticket that can never be deleted: the wallet paid and the ledger holds a
 * foreign key to it. Those strays sit at whatever hour the suite happened to
 * run, so once they outnumber the fixture they drag the mined median away from
 * the staged window and a clock staged test asserts against a pattern the
 * miner correctly refuses to see.
 *
 * That is data, not a defect: the product is reading the history it actually
 * has. So the specs that stage a moment check this first and skip by name.
 * Raising the fixture is not a way out, because the RPC caps it at 60 rides.
 * The real remedy is a fresh demo account, or accepting the account's own
 * history as the demo's history.
 */
export async function takundaFixtureBalance(): Promise<{
  fixture: number;
  stray: number;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { fixture: 1, stray: 0 }; // cannot tell; never skip
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
  const takunda = (users?.users ?? []).find((u) => u.email === TAKUNDA_EMAIL);
  if (!takunda) return { fixture: 1, stray: 0 };

  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60_000).toISOString();
  const [{ data: tickets }, { data: fixtures }] = await Promise.all([
    admin
      .from("tickets")
      .select("id")
      .eq("rider_id", takunda.id)
      .eq("kind", "fare")
      .gt("purchased_at", since),
    admin.from("demo_commute_fixtures").select("ticket_id").eq("profile_id", takunda.id),
  ]);

  const fixtureIds = new Set((fixtures ?? []).map((f) => f.ticket_id as string));
  const all = tickets ?? [];
  const fixture = all.filter((t) => fixtureIds.has(t.id as string)).length;
  return { fixture, stray: all.length - fixture };
}
