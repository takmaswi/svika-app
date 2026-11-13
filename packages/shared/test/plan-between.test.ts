import { describe, expect, test } from "vitest";
import { planTrip, type Network } from "../src/planner";
import { STREET_FACTOR, WALK_METERS_PER_MINUTE } from "../src/plan-to-point";
import { planBetween } from "../src/plan-between";

// The same tiny town as plan-to-point.test.ts: R1 runs A -> B -> C, R2 runs
// C -> D, and E is a stop no route serves.
const LAT = -17.8;
const stops = [
  { id: "a", name: "A rank", lat: LAT, lng: 31.0 },
  { id: "b", name: "B shops", lat: LAT, lng: 31.01 },
  { id: "c", name: "C turn off", lat: LAT, lng: 31.02 },
  { id: "d", name: "D end", lat: LAT, lng: 31.035 },
  { id: "e", name: "E island", lat: LAT, lng: 31.06 },
];
const network: Network = {
  stops,
  routes: [
    {
      id: "r1",
      code: "R1",
      name: "A to C",
      stops: ["a", "b", "c"],
      typicalDurationMinutes: 20,
      defaultFareCents: 100,
      fareSegments: [],
    },
    {
      id: "r2",
      code: "R2",
      name: "C to D",
      stops: ["c", "d"],
      typicalDurationMinutes: 10,
      defaultFareCents: 50,
      fareSegments: [],
    },
  ],
  transfers: [],
};

const degPerMeter = 1 / (111_320 * Math.cos((LAT * Math.PI) / 180));
/** A point `meters` east (negative: west) of a stop, `north` metres north. */
function near(stopId: string, meters: number, north = 0) {
  const s = stops.find((x) => x.id === stopId)!;
  return {
    name: "here",
    lng: s.lng + meters * degPerMeter,
    lat: s.lat + north / 111_320,
  };
}
const stop = (stopId: string) => ({ kind: "stop" as const, stopId });
const point = (p: { name: string; lng: number; lat: number }) => ({
  kind: "point" as const,
  point: p,
});

describe("planBetween", () => {
  test("stop to stop is exactly the stop planner, with no walking added", () => {
    const r = planBetween(network, stop("a"), stop("d"))!;
    expect(r.plan).toEqual(planTrip(network, "a", "d"));
    expect(r.head).toBeNull();
    expect(r.tail).toBeNull();
    expect(r.totalMinutes).toBe(r.plan.totalMinutes);
    expect(r.reachableFrom && r.reachableTo).toBe(true);
  });

  test("from my location: walk to the nearest serving stop first, at the city pace", () => {
    const r = planBetween(network, point(near("a", -300)), stop("c"))!;
    expect(r.boardStopId).toBe("a");
    expect(r.head!.toStopId).toBe("a");
    expect(Math.abs(r.head!.meters - 300 * STREET_FACTOR)).toBeLessThanOrEqual(1);
    expect(r.head!.minutes).toBe(Math.ceil(r.head!.meters / WALK_METERS_PER_MINUTE));
    expect(r.totalMinutes).toBe(r.head!.minutes + r.plan.totalMinutes);
    expect(r.reachableFrom).toBe(true);
  });

  test("boards where the whole trip is quickest, not just at the closest stop", () => {
    // 450 m north of C, B is also in walking range, but from B the trip
    // needs R1 then R2; from C it is R2 alone
    const origin = near("c", 0, 450);
    const r = planBetween(network, point(origin), stop("d"))!;
    expect(r.boardStopId).toBe("c");
    expect(r.plan.boardings).toBe(1);
  });

  test("place to place walks at both ends", () => {
    const r = planBetween(network, point(near("a", -200)), point(near("d", 250)))!;
    expect(r.head!.toStopId).toBe("a");
    expect(r.alightStopId).toBe("d");
    expect(r.tail!.meters).toBeGreaterThan(0);
    expect(r.totalMinutes).toBe(
      r.head!.minutes + r.plan.totalMinutes + r.tail!.minutes,
    );
    expect(r.reachableTo).toBe(true);
  });

  test("far from every stop: the nearest stop that works serves, and it says so", () => {
    const r = planBetween(network, point(near("a", -5000)), stop("c"))!;
    expect(r.reachableFrom).toBe(false);
    expect(r.boardStopId).toBe("a");
    expect(r.head!.meters).toBeGreaterThan(5000);
  });

  test("no plan at all is null, never a guess", () => {
    expect(planBetween(network, stop("e"), stop("a"))).toBeNull();
    expect(planBetween(network, stop("a"), stop("a"))).toBeNull();
    expect(planBetween(network, stop("zz"), stop("a"))).toBeNull();
  });
});
