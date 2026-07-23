// Per-vehicle arrival numbers for the kombi card and board: for each
// simulated kombi, when does it reach the rider's stop travelling the
// rider's way. The learned number comes from the spine (same GET /eta the
// home screen uses, measured from the same simulated position, so the card
// and the map never disagree); when the spine cannot serve, the fallback is
// the simulation's own clock (sim-eta.ts), labelled a demo estimate like
// every mock number. A kombi running the other way, or already past the
// stop, gets no number at all: "not coming right now" is an honest state,
// never an invented wait.
import type { CorridorDirectionName } from "../map/corridor";
import { pointAtDistance, type LngLat, type PolylineMetrics } from "../map/geometry";
import {
  simulatedTravelAt,
  type SimulatedVehicle,
  type SimulationConfig,
} from "../map/vehicle-feed";
import { simEtaMsToTarget } from "./sim-eta";

export interface VehicleEta {
  id: string;
  /** The leg the kombi is on (or dwelling to start). */
  direction: CorridorDirectionName;
  /** Null when the kombi does not reach the stop on its current leg. */
  minutes: number | null;
  /** True when the number came from the sim clock, not the spine. */
  isMock: boolean;
  /** Recorded rides behind a spine number; 0 for the sim clock. */
  rides: number;
}

export interface FleetEtaDeps {
  routeCode: string;
  metrics: PolylineMetrics;
  simConfig: SimulationConfig;
  vehicles: SimulatedVehicle[];
  epochMs: number;
  /** Spine base url; empty string means the sim clock serves alone. */
  spineBaseUrl: string;
  fetchFn?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

async function spineMinutes(
  deps: FleetEtaDeps,
  direction: CorridorDirectionName,
  targetStopId: string,
  lngLat: LngLat,
): Promise<{ minutes: number; rides: number } | null> {
  if (deps.spineBaseUrl === "") return null;
  try {
    const [lng, lat] = lngLat;
    const params = new URLSearchParams({
      route: deps.routeCode,
      direction,
      target: targetStopId,
      lat: String(lat),
      lng: String(lng),
    });
    const fetchFn = deps.fetchFn ?? fetch;
    const res = await fetchFn(`${deps.spineBaseUrl}/eta?${params}`, {
      signal: AbortSignal.timeout(deps.timeoutMs ?? 1500),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      etaSeconds?: unknown;
      basis?: { journeys?: unknown };
    };
    if (typeof body.etaSeconds !== "number") return null;
    const journeys = body.basis?.journeys;
    return {
      minutes: Math.max(1, Math.round(body.etaSeconds / 60)),
      rides: typeof journeys === "number" ? journeys : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Every vehicle's honest answer for one stop and travel direction. At the
 * direction's origin rank (originTerminus), a kombi still finishing the
 * opposite leg is the next departure here, so its arrival at the rank is
 * the honest wait — the same terminus rule the home estimate applies
 * (eta-live.ts); the spine is then asked in the direction the kombi is
 * actually travelling.
 */
export async function fleetEtasToStop(
  deps: FleetEtaDeps,
  targetStopId: string,
  targetMeters: number,
  direction: CorridorDirectionName,
  opts: { originTerminus?: boolean } = {},
): Promise<VehicleEta[]> {
  const now = (deps.now ?? Date.now)();
  const elapsed = now - deps.epochMs;
  return Promise.all(
    deps.vehicles.map(async (v): Promise<VehicleEta> => {
      const travel = simulatedTravelAt(deps.simConfig, v, elapsed);
      let askDirection = direction;
      let simMs = simEtaMsToTarget(deps.simConfig, v, elapsed, targetMeters, direction);
      if (simMs === null && opts.originTerminus) {
        const opposite = direction === "outbound" ? "inbound" : "outbound";
        const arriving = simEtaMsToTarget(
          deps.simConfig,
          v,
          elapsed,
          targetMeters,
          opposite,
        );
        if (arriving !== null) {
          simMs = arriving;
          askDirection = opposite;
        }
      }
      if (simMs === null) {
        return { id: v.id, direction: travel.direction, minutes: null, isMock: true, rides: 0 };
      }
      const spine = await spineMinutes(
        deps,
        askDirection,
        targetStopId,
        pointAtDistance(deps.metrics, travel.meters),
      );
      if (spine) {
        return { id: v.id, direction: travel.direction, ...spine, isMock: false };
      }
      return {
        id: v.id,
        direction: travel.direction,
        minutes: Math.max(1, Math.round(simMs / 60_000)),
        isMock: true,
        rides: 0,
      };
    }),
  );
}
