// Stages the last kombi countdown (V7) by moving the DATA, never the clock,
// which is the same trick the commute specs use for Takunda's history: the
// server's own wall clock stays real, and the synthetic evening history is
// rewritten so the usual last kombi lands a chosen number of minutes from
// now. That exercises the real code path end to end, including the Harare
// time arithmetic, instead of stubbing it out.
//
// Only public.synthetic_service_days is touched, the table whose every row is
// stamped synthetic (migration 0042). Tickets, ticket_events and the ledger
// are never involved. Restore by rerunning the committed generator:
// pnpm db:service-days.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { harareNow } from "@svika/shared";

function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface StagedEvening {
  /** The minute of day the staged history says service usually ends. */
  usualMinute: number;
  /** Local minute of day when the staging ran. */
  nowMinute: number;
}

/**
 * Rewrite one route and direction's synthetic evenings so the usual last
 * kombi sits `minutesFromNow` from the present, with a small deterministic
 * jitter so the sample has a believable spread rather than one repeated
 * number. Returns what it staged so the spec can assert against it.
 */
export async function stageLastKombi(
  routeCode: string,
  direction: "outbound" | "inbound",
  minutesFromNow: number,
  // 84 days is twelve of every weekday, so the per weekday sample the
  // estimator prefers still outnumbers the handful of real e2e evenings this
  // corridor has collected and the staged median cannot be dragged off by them
  days = 84,
): Promise<StagedEvening> {
  const db = admin();
  const { data: route, error: routeErr } = await db
    .from("routes")
    .select("id")
    .eq("code", routeCode)
    .single();
  if (routeErr) throw new Error(`route ${routeCode} not found: ${routeErr.message}`);

  const { minute: nowMinute } = harareNow(new Date());
  const usualMinute = Math.min(1439, Math.max(0, nowMinute + minutesFromNow));

  await db
    .from("synthetic_service_days")
    .delete()
    .eq("route_id", route.id)
    .eq("direction", direction);

  const today = new Date();
  const rows = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (i + 1));
    // +-6 minutes, deterministic, so the spread stays narrow and the card
    // never claims the route varies wildly
    const jitter = ((i * 7) % 13) - 6;
    return {
      route_id: route.id,
      direction,
      day: d.toISOString().slice(0, 10),
      last_fare_minute: Math.min(1439, Math.max(0, usualMinute + jitter)),
      fares: 12,
    };
  });
  const { error } = await db.from("synthetic_service_days").insert(rows);
  if (error) throw new Error(`staging failed: ${error.message}`);

  return { usualMinute, nowMinute };
}

/** Remove one route and direction's synthetic evenings entirely. */
export async function clearStagedEvenings(
  routeCode: string,
  direction: "outbound" | "inbound",
): Promise<void> {
  const db = admin();
  const { data: route } = await db
    .from("routes")
    .select("id")
    .eq("code", routeCode)
    .single();
  if (!route) return;
  await db
    .from("synthetic_service_days")
    .delete()
    .eq("route_id", route.id)
    .eq("direction", direction);
}
