// Live arrival numbers for the kombi card and board. Serves nothing
// personal: only the simulated fleet's positions (already public on the
// landing map) turned into per-vehicle waits for one corridor stop, by the
// spine when it can serve and the sim clock when it cannot. The registry
// and fare aggregates go through the authenticated kombi_board RPC instead;
// they never travel this route.
import { NextResponse } from "next/server";
import {
  CORRIDOR_ROUTE_CODE,
  corridorMetrics,
  corridorStops,
} from "@/lib/map/corridor-data";
import { distanceAlongLine } from "@/lib/map/eta-live";
import { SIM_EPOCH_MS, SIM_VEHICLES, simConfig } from "@/lib/map/sim-config";
import { fleetEtasToStop } from "@/lib/kombi/vehicle-eta";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const stopId = url.searchParams.get("stop") ?? "";
  const direction = url.searchParams.get("dir") === "inbound" ? "inbound" : "outbound";

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("route_stops")
    .select("stop_id, seq, routes!inner(code)")
    .eq("routes.code", CORRIDOR_ROUTE_CODE)
    .eq("direction", "outbound")
    .order("seq");
  if (error) {
    return NextResponse.json({ error: "network unavailable" }, { status: 503 });
  }

  const orderedStopIds = (rows ?? []).map((r) => r.stop_id as string);
  const targetIndex = orderedStopIds.indexOf(stopId);
  if (targetIndex === -1 || orderedStopIds.length !== corridorStops.length) {
    return NextResponse.json({ error: "unknown stop" }, { status: 400 });
  }

  const targetMeters = distanceAlongLine(
    corridorMetrics,
    corridorStops[targetIndex]!.lngLat,
  );
  const vehicles = await fleetEtasToStop(
    {
      routeCode: CORRIDOR_ROUTE_CODE,
      metrics: corridorMetrics,
      simConfig,
      vehicles: SIM_VEHICLES,
      epochMs: SIM_EPOCH_MS,
      spineBaseUrl: (process.env.SPINE_URL ?? "").replace(/\/$/, ""),
    },
    stopId,
    targetMeters,
    direction,
  );

  return NextResponse.json(
    { vehicles },
    { headers: { "cache-control": "no-store" } },
  );
}
