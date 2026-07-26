// The partner adapter: a trip recorded in the app becomes exactly the
// bundle shape the pipeline has always eaten, so a partner ride and a
// 2026-07-07 corridor ride are indistinguishable downstream.
import { describe, expect, test } from "vitest";
import {
  ingestableReason,
  partnerSourceRef,
  toParsedBundle,
  type PartnerJourneyRow,
  type PartnerLegRow,
  type PartnerPointRow,
} from "../src/ingest/partner.ts";
import { buildIngestPlan } from "../src/ingest/plan.ts";
import type { OrderedStop } from "../src/ingest/segments.ts";

const journey: PartnerJourneyRow = {
  id: "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
  name: "Kutown",
  started_at: "2026-07-24T06:00:00.000Z",
  ended_at: "2026-07-24T06:40:00.000Z",
};

// walk to the road, wait, ride, walk home
const legs: PartnerLegRow[] = [
  { leg_index: 0, mode: "walking" },
  { leg_index: 1, mode: "waiting" },
  { leg_index: 2, mode: "riding" },
  { leg_index: 3, mode: "walking" },
];

function point(
  seq: number,
  legIndex: number,
  lat: number,
  lng: number,
  minute: number,
): PartnerPointRow {
  return {
    seq,
    leg_index: legIndex,
    lat,
    lng,
    accuracy_m: 8,
    recorded_at: new Date(Date.parse(journey.started_at) + minute * 60_000).toISOString(),
  };
}

const points: PartnerPointRow[] = [
  point(0, 0, -17.7498, 31.0425, 0),
  point(1, 1, -17.7500, 31.043, 2),
  point(2, 2, -17.76, 31.045, 5),
  point(3, 2, -17.77, 31.047, 12),
  point(4, 2, -17.78, 31.049, 20),
  point(5, 3, -17.7805, 31.0495, 24),
];

describe("toParsedBundle", () => {
  const bundle = toParsedBundle(journey, legs, points);

  test("prefixes the source ref so it can never collide with a file bundle", () => {
    expect(bundle.journey.sourceRef).toBe(partnerSourceRef(journey.id));
    expect(bundle.journey.sourceRef.startsWith("partner:")).toBe(true);
  });

  test("carries the leg index and mode the recorder stamped", () => {
    expect(bundle.pings.map((p) => p.legIndex)).toEqual([0, 1, 2, 2, 2, 3]);
    expect(bundle.pings.filter((p) => p.mode === "riding")).toHaveLength(3);
  });

  test("a wait lands as walking, the only two modes the pipeline has", () => {
    // public.gps_pings allows walking and riding only (migration 0019)
    expect(bundle.pings[1]!.mode).toBe("walking");
    expect(new Set(bundle.pings.map((p) => p.mode))).toEqual(
      new Set(["walking", "riding"]),
    );
  });

  test("a point whose leg has no row walks rather than inheriting a ride", () => {
    const orphan = toParsedBundle(journey, [], points);
    expect(orphan.pings.every((p) => p.mode === "walking")).toBe(true);
  });

  test("sorts by seq no matter what order the rows arrived in", () => {
    const shuffled = toParsedBundle(journey, legs, [...points].reverse());
    expect(shuffled.pings.map((p) => p.seq)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("keeps the label and both ends of the trip", () => {
    expect(bundle.journey.label).toBe("Kutown");
    expect(bundle.journey.startedAtMs).toBe(Date.parse(journey.started_at));
    expect(bundle.journey.endedAtMs).toBe(Date.parse(journey.ended_at!));
  });

  test("an unnamed trip gets an empty label, never the word undefined", () => {
    const unnamed = toParsedBundle({ ...journey, name: null }, legs, points);
    expect(unnamed.journey.label).toBe("");
  });
});

describe("ingestableReason", () => {
  test("a walk is skipped by name, not thrown at the direction inference", () => {
    const walk = toParsedBundle(
      journey,
      [{ leg_index: 0, mode: "walking" }],
      [point(0, 0, -17.75, 31.04, 0), point(1, 0, -17.751, 31.041, 2)],
    );
    expect(ingestableReason(walk)).toBe("no riding leg");
  });

  test("one riding point cannot carry a direction", () => {
    const single = toParsedBundle(
      journey,
      legs,
      [point(0, 0, -17.75, 31.04, 0), point(1, 2, -17.76, 31.045, 5)],
    );
    expect(ingestableReason(single)).toBe("fewer than two riding points");
  });

  test("a real ride passes", () => {
    expect(ingestableReason(toParsedBundle(journey, legs, points))).toBeNull();
  });
});

describe("the plan builder treats a partner trip like any other ride", () => {
  // three stops down the same line the riding pings run along
  const stops: OrderedStop[] = [
    { id: "stop-a", lat: -17.76, lng: 31.045 },
    { id: "stop-b", lat: -17.77, lng: 31.047 },
    { id: "stop-c", lat: -17.78, lng: 31.049 },
  ];

  test("riding pings snap to stops and become segment times", () => {
    const plan = buildIngestPlan(
      toParsedBundle(journey, legs, points),
      stops,
      "real_field_ride",
    );
    expect(plan.journey.source_ref).toBe(partnerSourceRef(journey.id));
    expect(plan.journey.direction).toBe("outbound");
    expect(plan.passes.map((p) => p.stopId)).toEqual(["stop-a", "stop-b", "stop-c"]);
    expect(plan.segments).toHaveLength(2);
    expect(plan.segments[0]!.duration_seconds).toBe(7 * 60);
    // every row carries the honesty flag, same as a bundle ingest
    expect(plan.pings.every((p) => p.source === "real_field_ride")).toBe(true);
  });

  test("walking pings never reach the segment derivation", () => {
    const plan = buildIngestPlan(
      toParsedBundle(journey, legs, points),
      stops,
      "real_field_ride",
    );
    // six pings stored, three of them riding, and only those three snapped
    expect(plan.pings).toHaveLength(6);
    expect(plan.passes).toHaveLength(3);
  });
});
