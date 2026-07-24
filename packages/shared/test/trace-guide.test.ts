import { describe, expect, test } from "vitest";
import {
  APPROACHING_METERS,
  ARRIVED_METERS,
  deriveSteps,
  guideCue,
  OFF_PATH_METERS,
  OFF_PATH_RETURN_METERS,
  projectOnTrace,
  RIDE_SPEED_MPS,
  TURN_DEGREES,
  type GuidePoint,
} from "../src/trace-guide";

// Same synthetic latitude as the other geometry tests. At -17.8 deg,
// 0.001 deg of longitude is ~105.6 m; 0.001 deg of latitude is ~111.3 m.
const LAT = -17.8;
const DEG_PER_METER_LNG = 1 / (111_320 * Math.cos((LAT * Math.PI) / 180));
const DEG_PER_METER_LAT = 1 / 111_320;

/** A point `east`/`north` metres from the base corner, `seconds` after epoch. */
function pt(east: number, north: number, seconds = 0): GuidePoint {
  return {
    lat: LAT + north * DEG_PER_METER_LAT,
    lng: 31.0 + east * DEG_PER_METER_LNG,
    recordedAt: seconds * 1000,
  };
}

// A 400 m walk east then 300 m north: one clean right angle turn.
const L_TRACE = [pt(0, 0, 0), pt(200, 0, 160), pt(400, 0, 320), pt(400, 150, 440), pt(400, 300, 560)];

describe("projection onto the trace", () => {
  test("a point on the line is at distance ~0", () => {
    const p = projectOnTrace(L_TRACE, pt(100, 0))!;
    expect(p.distanceMeters).toBeLessThan(1);
  });

  test("a point beside the line reports its offset", () => {
    const p = projectOnTrace(L_TRACE, pt(100, 40))!;
    expect(p.distanceMeters).toBeGreaterThan(35);
    expect(p.distanceMeters).toBeLessThan(45);
  });

  test("remaining distance shrinks along the walk", () => {
    const start = projectOnTrace(L_TRACE, pt(0, 0))!;
    const mid = projectOnTrace(L_TRACE, pt(400, 10))!;
    const nearEnd = projectOnTrace(L_TRACE, pt(400, 280))!;
    expect(start.remainingMeters).toBeGreaterThan(mid.remainingMeters);
    expect(mid.remainingMeters).toBeGreaterThan(nearEnd.remainingMeters);
    expect(start.remainingMeters).toBeGreaterThan(650);
    expect(start.remainingMeters).toBeLessThan(750);
  });

  test("an empty trace projects nowhere", () => {
    expect(projectOnTrace([], pt(0, 0))).toBeNull();
  });
});

describe("guide cues", () => {
  test("on the path, no cue", () => {
    expect(guideCue(L_TRACE, pt(100, 0), "on-path")).toBe("on-path");
  });

  test("drifting past the off path line raises the cue", () => {
    expect(guideCue(L_TRACE, pt(100, OFF_PATH_METERS + 20), "on-path")).toBe(
      "off-path",
    );
  });

  test("hysteresis: once off path, coming almost back is still off path", () => {
    const between = (OFF_PATH_RETURN_METERS + OFF_PATH_METERS) / 2;
    expect(guideCue(L_TRACE, pt(100, between), "off-path")).toBe("off-path");
    expect(guideCue(L_TRACE, pt(100, between), "on-path")).toBe("on-path");
  });

  test("near the destination the cue is approaching, then arrived", () => {
    expect(guideCue(L_TRACE, pt(400, 300 - APPROACHING_METERS + 10), "on-path")).toBe(
      "approaching",
    );
    expect(guideCue(L_TRACE, pt(400, 300 - ARRIVED_METERS + 5), "approaching")).toBe(
      "arrived",
    );
  });

  test("arrived is terminal even if the viewer wanders", () => {
    expect(guideCue(L_TRACE, pt(100, 0), "arrived")).toBe("arrived");
  });
});

describe("derived steps", () => {
  test("the L shaped walk yields two steps with a left turn between", () => {
    const steps = deriveSteps(L_TRACE);
    expect(steps).toHaveLength(2);
    expect(steps[0]!.turn).toBe("start");
    expect(steps[0]!.meters).toBeGreaterThan(380);
    expect(steps[0]!.meters).toBeLessThan(420);
    // walking east then turning north is a left turn
    expect(steps[1]!.turn).toBe("left");
    expect(steps[1]!.meters).toBeGreaterThan(280);
    expect(steps[1]!.meters).toBeLessThan(320);
  });

  test("gentle wiggle below the turn threshold stays one step", () => {
    // drifts a few degrees, never past TURN_DEGREES
    const wiggle = [pt(0, 0, 0), pt(100, 4, 80), pt(200, 0, 160), pt(300, 4, 240)];
    const steps = deriveSteps(wiggle);
    expect(steps).toHaveLength(1);
    expect(TURN_DEGREES).toBeGreaterThan(10);
  });

  test("a right turn is a right turn", () => {
    const rightTurn = [pt(0, 0, 0), pt(200, 0, 160), pt(200, -200, 320)];
    const steps = deriveSteps(rightTurn);
    expect(steps).toHaveLength(2);
    expect(steps[1]!.turn).toBe("right");
  });

  test("steps carry the mode their speed implies", () => {
    // 400 m east at walking pace, then 3 km north at kombi pace
    const mixed = [
      pt(0, 0, 0),
      pt(400, 0, 320),
      pt(400, 1500, 470),
      pt(400, 3000, 620),
    ];
    const steps = deriveSteps(mixed);
    expect(steps[0]!.mode).toBe("walk");
    expect(steps[steps.length - 1]!.mode).toBe("ride");
    expect(RIDE_SPEED_MPS).toBeGreaterThan(2);
  });

  test("tiny traces derive no steps rather than nonsense", () => {
    expect(deriveSteps([])).toHaveLength(0);
    expect(deriveSteps([pt(0, 0)])).toHaveLength(0);
  });
});
