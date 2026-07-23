import { describe, expect, test } from "vitest";
import { measurePolyline, type LngLat } from "../src/lib/map/geometry";
import type { SimulationConfig } from "../src/lib/map/vehicle-feed";
import { simEtaMsToTarget } from "../src/lib/kombi/sim-eta";

// The card's mock twin: when the spine cannot serve, the honest fallback for
// "when does THIS kombi reach that stop" is the simulation's own clock. The
// simulation is a pure function of time, so its arrival moment is exact.
// A straight test road with linear profiles makes every expectation
// hand-checkable.

const road: LngLat[] = [
  [31.05, -17.72],
  [31.05, -17.71],
];
const metrics = measurePolyline(road);
const total = metrics.totalMeters;

// outbound: the full line in 100s; inbound: back in 200s; 50s dwell each end
const config: SimulationConfig = {
  routeCode: "TEST",
  metrics,
  profiles: {
    outbound: { durationSeconds: 100, points: [[0, 0], [100, total]] },
    inbound: { durationSeconds: 200, points: [[0, total], [200, 0]] },
  },
  dwellSeconds: 50,
};

const kombi = { id: "sim-1", phaseSeconds: 0 };
const sec = (n: number) => n * 1000;

describe("simEtaMsToTarget", () => {
  test("an outbound kombi short of the stop arrives on the profile clock", () => {
    const eta = simEtaMsToTarget(config, kombi, 0, total / 2, "outbound");
    expect(eta).not.toBeNull();
    expect(eta! / 1000).toBeCloseTo(50, 0);
  });

  test("the wait shrinks as the kombi rolls closer", () => {
    const eta = simEtaMsToTarget(config, kombi, sec(25), total / 2, "outbound");
    expect(eta! / 1000).toBeCloseTo(25, 0);
  });

  test("a kombi already past the stop has no honest arrival this leg", () => {
    expect(simEtaMsToTarget(config, kombi, sec(20), total * 0.1, "outbound")).toBeNull();
  });

  test("a kombi heading the other way has no arrival number", () => {
    expect(simEtaMsToTarget(config, kombi, sec(10), total / 2, "inbound")).toBeNull();
  });

  test("dwelling at the far rank counts the pause before the return leg", () => {
    // t=110: 40s of dwell left, then 100s to mid line on the inbound profile
    const eta = simEtaMsToTarget(config, kombi, sec(110), total / 2, "inbound");
    expect(eta! / 1000).toBeCloseTo(140, 0);
  });

  test("dwelling at the near rank counts the pause before heading out", () => {
    // cycle is 400s; t=355: 45s of dwell left, then 50s to mid line outbound
    const eta = simEtaMsToTarget(config, kombi, sec(355), total / 2, "outbound");
    expect(eta! / 1000).toBeCloseTo(95, 0);
  });

  test("the arrival moment is stable across sampling instants", () => {
    // arrival at t=50s regardless of when we ask before it
    for (const at of [0, 10, 30, 49]) {
      const eta = simEtaMsToTarget(config, kombi, sec(at), total / 2, "outbound");
      expect((sec(at) + eta!) / 1000).toBeCloseTo(50, 0);
    }
  });
});
