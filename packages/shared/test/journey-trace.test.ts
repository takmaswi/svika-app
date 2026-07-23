import { describe, expect, test } from "vitest";
import {
  ACCURACY_REJECT_METERS,
  DELAY_MOVING_MS,
  DELAY_STILL_MS,
  DELAY_WALKING_MS,
  MIN_MOVE_METERS,
  MOVING_SPEED_MPS,
  sampleDelayMs,
  shouldKeepPoint,
  speedMps,
  STILL_SPEED_MPS,
  traceDistanceMeters,
  type TracePoint,
} from "../src/journey-trace";

// Same synthetic latitude as the planner tests so the metre maths is honest.
// At -17.8 deg, 0.001 deg of longitude is ~105.6 m.
const LAT = -17.8;

/** A point `meters` east of a base longitude, `seconds` after epoch. */
function pt(meters: number, seconds: number, accuracyM = 10): TracePoint {
  const degPerMeter = 1 / (111_320 * Math.cos((LAT * Math.PI) / 180));
  return {
    lat: LAT,
    lng: 31.0 + meters * degPerMeter,
    accuracyM,
    recordedAt: seconds * 1000,
  };
}

describe("speed", () => {
  test("100 m in 20 s is 5 m/s", () => {
    expect(speedMps(pt(0, 0), pt(100, 20))).toBeCloseTo(5, 1);
  });

  test("no time elapsed means no speed claim", () => {
    expect(speedMps(pt(0, 5), pt(50, 5))).toBe(0);
  });
});

describe("adaptive sampling delay", () => {
  test("still riders sample sparsely", () => {
    expect(sampleDelayMs(STILL_SPEED_MPS / 2)).toBe(DELAY_STILL_MS);
  });

  test("walkers sample at the walking rate", () => {
    expect(sampleDelayMs(1.4)).toBe(DELAY_WALKING_MS);
  });

  test("a moving kombi samples tightest", () => {
    expect(sampleDelayMs(MOVING_SPEED_MPS + 1)).toBe(DELAY_MOVING_MS);
  });

  test("still is sparser than walking is sparser than riding", () => {
    expect(DELAY_STILL_MS).toBeGreaterThan(DELAY_WALKING_MS);
    expect(DELAY_WALKING_MS).toBeGreaterThanOrEqual(DELAY_MOVING_MS);
  });
});

describe("point acceptance", () => {
  test("bad accuracy is rejected", () => {
    expect(
      shouldKeepPoint(pt(0, 0), pt(30, 10, ACCURACY_REJECT_METERS + 1)),
    ).toBe(false);
  });

  test("first point of a trace is kept", () => {
    expect(shouldKeepPoint(null, pt(0, 0))).toBe(true);
  });

  test("first point still needs sane accuracy", () => {
    expect(shouldKeepPoint(null, pt(0, 0, ACCURACY_REJECT_METERS + 1))).toBe(
      false,
    );
  });

  test("standing jitter under the movement floor is dropped", () => {
    expect(shouldKeepPoint(pt(0, 0), pt(MIN_MOVE_METERS / 2, 4))).toBe(false);
  });

  test("real movement is kept", () => {
    expect(shouldKeepPoint(pt(0, 0), pt(40, 10))).toBe(true);
  });

  test("a long still gap is kept even without movement", () => {
    // heartbeat: the trace should show the rider was here, stationary
    expect(shouldKeepPoint(pt(0, 0), pt(1, 60))).toBe(true);
  });
});

describe("trace distance", () => {
  test("empty and single point traces measure zero", () => {
    expect(traceDistanceMeters([])).toBe(0);
    expect(traceDistanceMeters([pt(0, 0)])).toBe(0);
  });

  test("a straight 300 m walk measures ~300 m", () => {
    const trace = [pt(0, 0), pt(100, 80), pt(200, 160), pt(300, 240)];
    expect(traceDistanceMeters(trace)).toBeGreaterThan(290);
    expect(traceDistanceMeters(trace)).toBeLessThan(310);
  });

  test("a GPS teleport does not inflate the distance", () => {
    // 5 km in one second is not a kombi, it is a GPS glitch
    const trace = [pt(0, 0), pt(100, 20), pt(5100, 21), pt(200, 40)];
    expect(traceDistanceMeters(trace)).toBeLessThan(400);
  });
});
