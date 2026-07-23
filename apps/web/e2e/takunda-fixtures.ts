// Rebuilds Takunda's fixture commute history relative to now, exactly as the
// seed does (packages/db/seed/seed.mjs, ensureTakunda), but shifted by an
// offset so a spec can stage a moment: 0 minutes lands the mined window on
// the present (the usual-trip peek), a few hours lands it earlier today (the
// ride-back peek). Goes through reset_demo_commute_history as Takunda
// himself, which the RPC allows only for demo_sim profiles, so real history
// is never touched. Callers must restore with offsetMinutes 0 when done.
import { createClient } from "@supabase/supabase-js";

const TAKUNDA_EMAIL = "demo.takunda@svika.app";
const HISTORY_DAYS = 14;

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

  // one ride per day, same jitter shape as the seed, shifted by the offset
  const rides = [];
  for (let d = 0; d < HISTORY_DAYS; d++) {
    const jitterMinutes = 6 + ((d * 7) % 20);
    const at = new Date(
      Date.now() -
        offsetMinutes * 60_000 -
        d * 24 * 60 * 60_000 -
        jitterMinutes * 60_000,
    );
    rides.push({ at: at.toISOString() });
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
