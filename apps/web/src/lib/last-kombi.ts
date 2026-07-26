// The server side of the last kombi countdown (batch V7): read each ride
// leg's observed evenings and hand the tightest warning to the plan screen.
//
// Not AI. The database counts (public.service_day_ends, migration 0042) and
// packages/shared/src/last-kombi.ts decides; this file is only the wiring,
// plus the one product rule that belongs to the plan screen rather than to
// the estimator: a trip with a transfer is only as safe as its tightest leg,
// so the leg with the least time left is the one the rider is warned about.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  harareNow,
  lastKombiWarning,
  type LastKombiWarning,
  type RideLeg,
  type ServiceDayEnd,
} from "@svika/shared";

interface ServiceDayRow {
  weekday: number;
  last_fare_minute: number;
  data_source: string;
}

export interface LegWarning extends LastKombiWarning {
  routeName: string;
}

/** The observed evenings for one route and direction, newest first. */
async function observations(
  supabase: SupabaseClient,
  routeId: string,
  direction: string,
): Promise<ServiceDayEnd[]> {
  const { data, error } = await supabase.rpc("service_day_ends", {
    p_route: routeId,
    p_direction: direction,
  });
  if (error) return [];
  return ((data ?? []) as ServiceDayRow[]).map((r) => ({
    weekday: r.weekday,
    lastFareMinute: r.last_fare_minute,
    source: r.data_source === "real" ? "real" : "synthetic",
  }));
}

/**
 * The warning for a plan, or null when there is nothing worth saying: no
 * history, or the evening is still hours away. Called on the plan screen,
 * which is the last moment a rider can still choose differently.
 */
export async function planLastKombi(
  supabase: SupabaseClient,
  legs: readonly RideLeg[],
  at: Date = new Date(),
): Promise<LegWarning | null> {
  if (legs.length === 0) return null;
  const { minute, weekday } = harareNow(at);

  const warnings = await Promise.all(
    legs.map(async (leg) => ({
      routeName: leg.routeName,
      ...lastKombiWarning(
        await observations(supabase, leg.routeId, leg.direction),
        weekday,
        minute,
      ),
    })),
  );

  const worth = warnings.filter((w) => w.state === "warn" || w.state === "past");
  if (worth.length === 0) return null;
  // past beats warn (a leg already past its usual last kombi is the sharper
  // fact), then the least time left
  return worth.sort((a, b) => (a.minutesLeft ?? 0) - (b.minutesLeft ?? 0))[0]!;
}
