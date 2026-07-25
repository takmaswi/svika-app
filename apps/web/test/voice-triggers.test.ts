import { describe, expect, test } from "vitest";
import {
  APPROACH_METERS,
  GET_OFF_METERS,
  metersToStop,
  promptsArrival,
  VoiceTriggerEngine,
  WALK_PAST_METERS,
  type VoiceTrip,
} from "../src/lib/voice/triggers";

const trip: VoiceTrip = {
  targetMeters: 5000,
  direction: "outbound",
  hasWalkAfter: true,
};

describe("metersToStop", () => {
  test("positive approaching, negative past, both directions", () => {
    expect(metersToStop(trip, 4000)).toBe(1000);
    expect(metersToStop(trip, 5200)).toBe(-200);
    const inbound: VoiceTrip = { ...trip, direction: "inbound" };
    expect(metersToStop(inbound, 5400)).toBe(400);
    expect(metersToStop(inbound, 4900)).toBe(-100);
  });
});

describe("VoiceTriggerEngine", () => {
  test("a ride fires each cue once, in order", () => {
    const engine = new VoiceTriggerEngine(trip);
    const cues: (string | null)[] = [];
    // far out, approach band, still in band, at the stop, just past, walked past
    for (const meters of [3000, 4200, 4600, 4950, 5030, 5200, 5400]) {
      cues.push(engine.next(meters, "outbound"));
    }
    expect(cues).toEqual([null, "approaching", null, "getOff", null, "walk", null]);
  });

  test("jumping straight into the stop band still speaks get off once", () => {
    const engine = new VoiceTriggerEngine(trip);
    expect(engine.next(4990, "outbound")).toBe("getOff");
    expect(engine.next(4995, "outbound")).toBeNull();
    // and approaching never fires late
    expect(engine.next(4500, "outbound")).toBeNull();
  });

  test("no walking leg means no walk cue", () => {
    const engine = new VoiceTriggerEngine({ ...trip, hasWalkAfter: false });
    engine.next(4950, "outbound");
    expect(engine.next(5400, "outbound")).toBeNull();
  });

  test("a kombi going the other way stays silent", () => {
    const engine = new VoiceTriggerEngine(trip);
    expect(engine.next(4600, "inbound")).toBeNull();
  });

  test("the thresholds hold their shape", () => {
    // the bands must nest: walk past < get off < approach
    expect(WALK_PAST_METERS).toBeLessThan(GET_OFF_METERS);
    expect(GET_OFF_METERS).toBeLessThan(APPROACH_METERS);
  });
});

describe("promptsArrival", () => {
  // V3 ruling 3: the arrival cues open a skippable confirm prompt; the
  // approach warning never does, and nothing ever confirms by itself.
  test("the at-the-stop cues prompt, the approach warning does not", () => {
    expect(promptsArrival("getOff")).toBe(true);
    expect(promptsArrival("walk")).toBe(true);
    expect(promptsArrival("approaching")).toBe(false);
  });
});
