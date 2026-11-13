// Ruling 3 (no simulated data in the public app): the network a rider plans
// on leaves out test routes (code TEST-*, e.g. "Synthetic Test Route (not a
// real corridor)") and every stop that only they serve. The routes stay in
// the database for the pitch build, the simulator and the test suites.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Network } from "@svika/shared";
import { fetchNetwork } from "./network";

export const TEST_ROUTE_RE = /^TEST-/i;

export function publicNetwork(network: Network): Network {
  const routes = network.routes.filter((r) => !TEST_ROUTE_RE.test(r.code));
  const served = new Set(routes.flatMap((r) => r.stops));
  const testOnly = new Set(
    network.routes
      .filter((r) => TEST_ROUTE_RE.test(r.code))
      .flatMap((r) => r.stops)
      .filter((id) => !served.has(id)),
  );
  return {
    stops: network.stops.filter((s) => !testOnly.has(s.id)),
    routes,
    transfers: network.transfers.filter(
      (t) => !testOnly.has(t.fromStopId) && !testOnly.has(t.toStopId),
    ),
  };
}

/** The public network is world readable and changes rarely: kept 5 minutes per server. */
const TTL_MS = 5 * 60_000;
let cached: { at: number; network: Network } | null = null;

export async function fetchPublicNetwork(supabase: SupabaseClient): Promise<Network> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.network;
  const network = publicNetwork(await fetchNetwork(supabase));
  cached = { at: Date.now(), network };
  return network;
}
