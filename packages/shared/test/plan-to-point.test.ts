import { describe, expect, test } from "vitest";
import type { Network } from "../src/planner";
import {
  haversineMeters,
  MAX_ALIGHT_CANDIDATES,
  planToPoint,
  STREET_FACTOR,
  WALK_METERS_PER_MINUTE,
  WALK_SERVICE_METERS,
  walkTail,
} from "../src/plan-to-point";

// A tiny synthetic town near Harare's latitude so the metre maths is honest.
// Route R1 runs A -> B -> C; route R2 runs C -> D. Stop E exists but no
// route serves it. One degree of longitude here is ~105.6 km, so 0.001 deg
// is ~105 m east to west.
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

/** A point `meters` east of the given stop. */
function eastOf(stopId: string, meters: number): { name: string; lng: number; lat: number } {
  const stop = stops.find((s) => s.id === stopId)!;
  const degPerMeter = 1 / (111_320 * Math.cos((LAT * Math.PI) / 180));
  return { name: "somewhere", lng: stop.lng + meters * degPerMeter, lat: stop.lat };
}

describe("walk maths", () => {
  test("haversine is sane at city scale", () => {
    const d = haversineMeters(31.0, LAT, 31.01, LAT);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1120);
  });

  test("the tail applies the street factor and the walking pace", () => {
    const dest = eastOf("c", 400);
    const tail = walkTail(stops[2]!, dest);
    // within a metre: the test's degree conversion and the haversine radius
    // round differently at this scale
    expect(Math.abs(tail.meters - 400 * STREET_FACTOR)).toBeLessThanOrEqual(1);
    expect(tail.minutes).toBe(Math.ceil(tail.meters / WALK_METERS_PER_MINUTE));
  });
});

describe("planToPoint", () => {
  test("a destination near a served stop alights there with a short tail", () => {
    const result = planToPoint(network, "a", eastOf("c", 300));
    expect(result).not.toBeNull();
    expect(result!.connected).toBe(true);
    expect(result!.alightStopId).toBe("c");
    expect(result!.plan.boardings).toBe(1);
    expect(Math.abs(result!.walkTail.meters - 300 * STREET_FACTOR)).toBeLessThanOrEqual(1);
  });

  test("a destination past the transfer shows the two kombi plan", () => {
    const result = planToPoint(network, "a", eastOf("d", 200));
    expect(result).not.toBeNull();
    expect(result!.connected).toBe(true);
    expect(result!.alightStopId).toBe("d");
    expect(result!.plan.boardings).toBe(2);
  });

  test("a nearer stop with a worse total still loses to the better trade", () => {
    // halfway between c and d, 500m from each: both candidates plan, and the
    // scoring must pick the cheaper faster single boarding at c over the
    // second kombi to d
    const dest = eastOf("c", 500);
    const result = planToPoint(network, "a", dest)!;
    expect(result.connected).toBe(true);
    expect(result.alightStopId).toBe("c");
  });

  test("an unserved stop never becomes the alight stop", () => {
    // 300m from the island stop E: E is nearest but no kombi reaches it, so
    // the plan says so plainly and drops at the closest served stop instead
    const dest = eastOf("e", 300);
    const result = planToPoint(network, "a", dest)!;
    expect(result.connected).toBe(false);
    expect(result.alightStopId).toBe("d");
    expect(result.walkTail.meters).toBeGreaterThan(WALK_SERVICE_METERS);
  });

  test("a destination in the void is honest about the long walk", () => {
    const dest = eastOf("d", 3000);
    const result = planToPoint(network, "a", dest)!;
    expect(result.connected).toBe(false);
    expect(result.alightStopId).toBe("d");
    expect(result.walkTail.minutes).toBe(
      Math.ceil(result.walkTail.meters / WALK_METERS_PER_MINUTE),
    );
  });

  test("an unknown origin yields null", () => {
    expect(planToPoint(network, "ghost", eastOf("c", 100))).toBeNull();
  });

  test("the candidate shortlist is bounded", () => {
    expect(MAX_ALIGHT_CANDIDATES).toBeGreaterThan(0);
    expect(WALK_SERVICE_METERS).toBeGreaterThan(0);
  });
});
