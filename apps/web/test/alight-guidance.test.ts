// D1 gate: alight guidance fires at the right stop on a trace replay. The
// trace is the real recorded corridor ride the simulator replays
// (sim-profile.json, field GPS 2026-07-07); the engine is the same
// VoiceTriggerEngine the in ride guide runs. The test walks the recorded
// timeline second by second and proves the cues fire in order, each inside
// its documented band around the alight stop, for stops along the corridor
// and in both directions.
import { describe, expect, test } from "vitest";
import { corridorMetrics, corridorStops } from "../src/lib/map/corridor-data";
import { distanceAlongLine } from "../src/lib/map/eta-live";
import { SIM_VEHICLES, simConfig } from "../src/lib/map/sim-config";
import { simulatedTravelAt, simulationCycleSeconds } from "../src/lib/map/vehicle-feed";
import {
  APPROACH_METERS,
  GET_OFF_METERS,
  VoiceTriggerEngine,
  WALK_PAST_METERS,
  type VoiceCue,
} from "../src/lib/voice/triggers";

interface FiredCue {
  cue: VoiceCue;
  meters: number;
}

/** Replays one full fleet cycle through the engine at 1s ticks. */
function replay(trip: {
  targetMeters: number;
  direction: "outbound" | "inbound";
  hasWalkAfter: boolean;
}): FiredCue[] {
  const engine = new VoiceTriggerEngine(trip);
  const fired: FiredCue[] = [];
  const cycle = simulationCycleSeconds(simConfig);
  const vehicle = SIM_VEHICLES[0]!;
  for (let s = 0; s < cycle; s++) {
    const travel = simulatedTravelAt(simConfig, vehicle, s * 1000);
    const cue = engine.next(travel.meters, travel.direction);
    if (cue) fired.push({ cue, meters: travel.meters });
  }
  return fired;
}

describe("alight guidance on the recorded trace", () => {
  test("cues fire in order and inside their bands at a mid corridor stop", () => {
    const stop = corridorStops[8]!;
    const target = distanceAlongLine(corridorMetrics, stop.lngLat);
    const fired = replay({ targetMeters: target, direction: "outbound", hasWalkAfter: true });

    expect(fired.map((f) => f.cue)).toEqual(["approaching", "getOff", "walk"]);

    const [approaching, getOff, walk] = fired;
    expect(target - approaching!.meters).toBeLessThanOrEqual(APPROACH_METERS);
    expect(target - approaching!.meters).toBeGreaterThan(GET_OFF_METERS);
    // the chiburuka moment: the kombi is at the stop, within the stand up band
    expect(Math.abs(target - getOff!.meters)).toBeLessThanOrEqual(GET_OFF_METERS);
    // the walking leg begins only after the kombi has really moved on
    expect(walk!.meters - target).toBeGreaterThan(WALK_PAST_METERS);
  });

  test("without a walking tail the guidance ends at chiburuka", () => {
    const stop = corridorStops[8]!;
    const target = distanceAlongLine(corridorMetrics, stop.lngLat);
    const fired = replay({ targetMeters: target, direction: "outbound", hasWalkAfter: false });
    expect(fired.map((f) => f.cue)).toEqual(["approaching", "getOff"]);
  });

  test("every alightable outbound stop earns its getOff inside the band", () => {
    // skip the first stop (the boarding rank) and check each real alight
    for (const stop of corridorStops.slice(1)) {
      const target = distanceAlongLine(corridorMetrics, stop.lngLat);
      const fired = replay({
        targetMeters: target,
        direction: "outbound",
        hasWalkAfter: false,
      });
      const getOff = fired.find((f) => f.cue === "getOff");
      expect(getOff, `no getOff at ${stop.name}`).toBeDefined();
      expect(
        Math.abs(target - getOff!.meters),
        `getOff out of band at ${stop.name}`,
      ).toBeLessThanOrEqual(GET_OFF_METERS);
    }
  });

  test("an inbound ride gets the same treatment on the return trace", () => {
    const stop = corridorStops[3]!;
    const target = distanceAlongLine(corridorMetrics, stop.lngLat);
    const fired = replay({ targetMeters: target, direction: "inbound", hasWalkAfter: true });
    expect(fired.map((f) => f.cue)).toEqual(["approaching", "getOff", "walk"]);
    const getOff = fired.find((f) => f.cue === "getOff")!;
    expect(Math.abs(target - getOff.meters)).toBeLessThanOrEqual(GET_OFF_METERS);
  });
});
