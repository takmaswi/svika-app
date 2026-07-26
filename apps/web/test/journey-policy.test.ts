import { describe, expect, test } from "vitest";
import { MIN_MOVE_METERS, STILL_SPEED_MPS } from "@svika/shared";
import {
  nextPhase,
  planBatches,
  STILL_STREAK_TO_NAP,
  SYNC_BATCH_SIZE,
  toRpcPoint,
  type PhaseState,
} from "../src/lib/journey/policy";
import type { LocalPoint } from "../src/lib/journey/store";

const watching: PhaseState = { phase: "watching", stillStreak: 0 };
const still = { speedMps: 0, movedM: 0 };
const moving = { speedMps: 2, movedM: 20 };

describe("battery phases", () => {
  test("a streak of still fixes sends the recorder to sleep", () => {
    let s = watching;
    for (let i = 0; i < STILL_STREAK_TO_NAP; i++) s = nextPhase(s, still);
    expect(s.phase).toBe("napping");
  });

  test("movement resets the still streak", () => {
    let s = nextPhase(watching, still);
    s = nextPhase(s, moving);
    for (let i = 0; i < STILL_STREAK_TO_NAP - 1; i++) s = nextPhase(s, still);
    expect(s.phase).toBe("watching");
  });

  test("a napping recorder wakes on real movement only", () => {
    const napping: PhaseState = { phase: "napping", stillStreak: 0 };
    expect(
      nextPhase(napping, { speedMps: 0, movedM: MIN_MOVE_METERS - 1 }).phase,
    ).toBe("napping");
    expect(
      nextPhase(napping, { speedMps: 1, movedM: MIN_MOVE_METERS + 1 }).phase,
    ).toBe("watching");
    expect(STILL_SPEED_MPS).toBeGreaterThan(0);
  });
});

function pt(seq: number): LocalPoint {
  return {
    journeyId: "j",
    seq,
    lat: -17.8,
    lng: 31,
    accuracyM: 10,
    recordedAt: seq * 1000,
  };
}

describe("sync batching", () => {
  test("only the unsynced tail uploads, in order", () => {
    const points = [pt(2), pt(0), pt(1), pt(3)];
    const batches = planBatches(points, 1);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.map((p) => p.seq)).toEqual([2, 3]);
  });

  test("a long tail splits into server sized batches", () => {
    const points = Array.from({ length: 450 }, (_, i) => pt(i));
    const batches = planBatches(points, -1);
    expect(batches.map((b) => b.length)).toEqual([SYNC_BATCH_SIZE, SYNC_BATCH_SIZE, 50]);
    expect(SYNC_BATCH_SIZE).toBeLessThanOrEqual(500);
  });

  test("nothing pending means no batches", () => {
    expect(planBatches([pt(0), pt(1)], 1)).toHaveLength(0);
  });

  test("the RPC row carries the 0033 column names plus 0047's leg", () => {
    expect(toRpcPoint(pt(7))).toEqual({
      seq: 7,
      lat: -17.8,
      lng: 31,
      accuracy_m: 10,
      recorded_at: new Date(7000).toISOString(),
      leg_index: 0,
    });
  });

  test("a point recorded before legs existed still uploads, on leg 0", () => {
    // migration 0047 made leg_index optional at the door and defaulted the
    // column, so an IndexedDB row written by the M1 recorder is still valid
    const { legIndex: _dropped, ...legacy } = pt(3);
    expect(toRpcPoint(legacy).leg_index).toBe(0);
  });

  test("the leg a point was captured on rides with it", () => {
    expect(toRpcPoint({ ...pt(4), legIndex: 2 }).leg_index).toBe(2);
  });
});
