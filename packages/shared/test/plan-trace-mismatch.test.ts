import { describe, expect, test } from "vitest";
import {
  detectPlanTraceMismatches,
  type MismatchTracePoint,
  type PlannedArrival,
} from "../src/plan-trace-mismatch";

// SYNTHETIC traces, built in code for these tests alone (documented as
// synthetic in docs/DATASET-STATEMENT.md): straight lines eastward at a
// chosen speed, Harare latitude so metre conversion is realistic. No real
// rider data is used or needed here.
const LAT = -17.8292;
const LNG0 = 31.0;
const M_PER_DEG_LNG = 111_320 * Math.cos((LAT * Math.PI) / 180);

function eastOf(meters: number): { lat: number; lng: number } {
  return { lat: LAT, lng: LNG0 + meters / M_PER_DEG_LNG };
}

/** a leg of `meters` eastward at `speed` m/s appended to `points` */
function leg(
  points: MismatchTracePoint[],
  meters: number,
  speedMps: number,
  stepM = 50,
): MismatchTracePoint[] {
  const last = points[points.length - 1];
  const startM = last ? (last.lng - LNG0) * M_PER_DEG_LNG : 0;
  const startT = last ? last.recordedAt : 0;
  const steps = Math.max(1, Math.round(meters / stepM));
  const out = [...points];
  for (let i = 1; i <= steps; i++) {
    const m = startM + (meters * i) / steps;
    out.push({
      ...eastOf(m),
      recordedAt: startT + ((meters / speedMps) * 1000 * i) / steps,
    });
  }
  return out;
}

const start: MismatchTracePoint[] = [{ ...eastOf(0), recordedAt: 0 }];

describe("plan versus trace mismatch detection (D2, geometry rules)", () => {
  test("a trip that went to plan reports nothing", () => {
    // ride 2 km to the stop, walk the promised 300 m to the gate
    const trace = leg(leg(start, 2000, 10), 300, 1.3);
    const planned: PlannedArrival = {
      alightStop: eastOf(2000),
      destination: eastOf(2300),
      plannedWalkM: 300,
    };
    expect(detectPlanTraceMismatches(planned, trace)).toEqual([]);
  });

  test("dropping one stop early is an early alight and a long walk", () => {
    // the real ride that started this batch: dropped 500 m short, long walk
    const trace = leg(leg(start, 1500, 10), 800, 1.3);
    const planned: PlannedArrival = {
      alightStop: eastOf(2000),
      destination: eastOf(2300),
      plannedWalkM: 300,
    };
    const found = detectPlanTraceMismatches(planned, trace);
    expect(found.map((m) => m.kind)).toEqual(["early_alight", "long_walk"]);
    expect(found[0]!.alightOffsetM).toBeGreaterThan(400);
    expect(found[0]!.alightOffsetM).toBeLessThan(600);
    expect(found[1]!.actualWalkM).toBeGreaterThan(700);
    expect(found[1]!.plannedWalkM).toBe(300);
  });

  test("carried past the stop is a late alight, and the shorter walk is fine", () => {
    const trace = leg(leg(start, 2200, 10), 100, 1.3);
    const planned: PlannedArrival = {
      alightStop: eastOf(2000),
      destination: eastOf(2300),
      plannedWalkM: 300,
    };
    const found = detectPlanTraceMismatches(planned, trace);
    expect(found.map((m) => m.kind)).toEqual(["late_alight"]);
    expect(found[0]!.alightOffsetM).toBeGreaterThan(150);
  });

  test("the right stop with a wandering walk is a long walk alone", () => {
    // alight on the stop, then wander: out 400 m past and back 200 to the
    // gate at 300, so ~700 m walked against a 300 m promise
    let trace = leg(start, 2000, 10);
    trace = leg(trace, 500, 1.3);
    // walk back westward 200 m
    const last = trace[trace.length - 1]!;
    for (let i = 1; i <= 4; i++) {
      trace = [
        ...trace,
        {
          ...eastOf(2500 - i * 50),
          recordedAt: last.recordedAt + i * 40_000,
        },
      ];
    }
    const planned: PlannedArrival = {
      alightStop: eastOf(2000),
      destination: eastOf(2300),
      plannedWalkM: 300,
    };
    const found = detectPlanTraceMismatches(planned, trace);
    expect(found.map((m) => m.kind)).toEqual(["long_walk"]);
    expect(found[0]!.actualWalkM).toBeGreaterThan(600);
  });

  test("a stop to stop plan that promised no walk flags a 300 m trek", () => {
    const trace = leg(leg(start, 2000, 10), 300, 1.3);
    const planned: PlannedArrival = {
      alightStop: eastOf(2000),
      destination: null,
      plannedWalkM: 0,
    };
    const found = detectPlanTraceMismatches(planned, trace);
    expect(found.map((m) => m.kind)).toEqual(["long_walk"]);
  });

  test("a walk-only recording judges nothing", () => {
    const trace = leg(start, 900, 1.3);
    const planned: PlannedArrival = {
      alightStop: eastOf(600),
      destination: eastOf(900),
      plannedWalkM: 300,
    };
    expect(detectPlanTraceMismatches(planned, trace)).toEqual([]);
  });

  test("an unfinished trace judges nothing", () => {
    // the recording died 1.2 km from the destination
    const trace = leg(start, 1100, 10);
    const planned: PlannedArrival = {
      alightStop: eastOf(2000),
      destination: eastOf(2300),
      plannedWalkM: 300,
    };
    expect(detectPlanTraceMismatches(planned, trace)).toEqual([]);
  });

  test("a stub of points judges nothing", () => {
    const trace = leg(start, 100, 10, 50).slice(0, 3);
    const planned: PlannedArrival = {
      alightStop: eastOf(100),
      destination: null,
      plannedWalkM: 0,
    };
    expect(detectPlanTraceMismatches(planned, trace)).toEqual([]);
  });
});
