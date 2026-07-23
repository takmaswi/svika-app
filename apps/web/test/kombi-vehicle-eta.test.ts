import { describe, expect, test } from "vitest";
import { measurePolyline, type LngLat } from "../src/lib/map/geometry";
import type { SimulationConfig } from "../src/lib/map/vehicle-feed";
import { fleetEtasToStop, type FleetEtaDeps } from "../src/lib/kombi/vehicle-eta";

// Boarding at the rank: a kombi still finishing its ride IN is the next
// departure OUT, so the card must count its arrival instead of calling it
// "away" — the same terminus honesty the home estimate already has
// (eta-live.ts). Straight road, linear profiles, no spine: the sim clock
// answers alone.

const road: LngLat[] = [
  [31.05, -17.72],
  [31.05, -17.71],
];
const metrics = measurePolyline(road);
const total = metrics.totalMeters;

const config: SimulationConfig = {
  routeCode: "TEST",
  metrics,
  profiles: {
    outbound: { durationSeconds: 100, points: [[0, 0], [100, total]] },
    inbound: { durationSeconds: 200, points: [[0, total], [200, 0]] },
  },
  dwellSeconds: 50,
};

function deps(nowMs: number): FleetEtaDeps {
  return {
    routeCode: "TEST",
    metrics,
    simConfig: config,
    vehicles: [{ id: "sim-1", phaseSeconds: 0 }],
    epochMs: 0,
    spineBaseUrl: "",
    now: () => nowMs,
  };
}

describe("fleetEtasToStop at the origin rank", () => {
  test("a kombi riding in counts as the next departure out", async () => {
    // t=250s: 100s into the inbound leg, 100s of riding left to the rank
    const [eta] = await fleetEtasToStop(deps(250_000), "stop-0", 0, "outbound", {
      originTerminus: true,
    });
    expect(eta!.minutes).not.toBeNull();
    expect(eta!.minutes).toBe(Math.max(1, Math.round(100 / 60)));
    expect(eta!.isMock).toBe(true);
  });

  test("away from a mid corridor stop stays an honest null", async () => {
    // same moment, but the rider stands mid line asking for outbound
    const [eta] = await fleetEtasToStop(deps(250_000), "stop-x", total / 2, "outbound", {
      originTerminus: false,
    });
    expect(eta!.minutes).toBeNull();
  });

  test("an outbound kombi short of a mid stop still gets its number", async () => {
    const [eta] = await fleetEtasToStop(deps(10_000), "stop-x", total / 2, "outbound", {
      originTerminus: false,
    });
    expect(eta!.minutes).toBe(Math.max(1, Math.round(40 / 60)));
  });
});
