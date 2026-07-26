// The battery policy and the sync batching, kept pure so they are testable.
//
// Battery: the GPS radio is the drain, so the recorder has two phases.
// While the rider moves it WATCHES (continuous fixes, gated by the shared
// sampling rules). After STILL_STREAK_TO_NAP consecutive still fixes it
// NAPS: the watch is released so the radio can sleep, and a timer wakes it
// for one fix every DELAY_STILL_MS. Real movement on a nap fix wakes the
// watch again. Thresholds live in @svika/shared journey-trace.
import {
  MIN_MOVE_METERS,
  STILL_SPEED_MPS,
  type TracePoint,
} from "@svika/shared";
import type { LocalPoint } from "./store";

export type RecorderPhase = "watching" | "napping";

export interface PhaseState {
  phase: RecorderPhase;
  /** Consecutive still fixes seen while watching. */
  stillStreak: number;
}

/** Still fixes in a row before the watch releases the GPS. */
export const STILL_STREAK_TO_NAP = 3;

/** The next phase after a fix with this ground speed and displacement. */
export function nextPhase(
  state: PhaseState,
  fix: { speedMps: number; movedM: number },
): PhaseState {
  if (state.phase === "napping") {
    return fix.movedM >= MIN_MOVE_METERS
      ? { phase: "watching", stillStreak: 0 }
      : state;
  }
  if (fix.speedMps < STILL_SPEED_MPS && fix.movedM < MIN_MOVE_METERS) {
    const stillStreak = state.stillStreak + 1;
    return stillStreak >= STILL_STREAK_TO_NAP
      ? { phase: "napping", stillStreak: 0 }
      : { phase: "watching", stillStreak };
  }
  return { phase: "watching", stillStreak: 0 };
}

/** Server batch ceiling is 500 (migration 0033); stay comfortably under. */
export const SYNC_BATCH_SIZE = 200;

/** The unsynced tail of the trace, sliced into upload batches in order. */
export function planBatches(
  points: readonly LocalPoint[],
  syncedThrough: number,
  batchSize = SYNC_BATCH_SIZE,
): LocalPoint[][] {
  const pending = points
    .filter((p) => p.seq > syncedThrough)
    .sort((a, b) => a.seq - b.seq);
  const batches: LocalPoint[][] = [];
  for (let i = 0; i < pending.length; i += batchSize) {
    batches.push(pending.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * The RPC payload row for a local point. `leg_index` is optional at the
 * server door (migration 0047), so a point recorded before legs existed
 * still uploads and lands on leg 0 exactly as it always did.
 */
export function toRpcPoint(p: LocalPoint): {
  seq: number;
  lat: number;
  lng: number;
  accuracy_m: number;
  recorded_at: string;
  leg_index: number;
} {
  return {
    seq: p.seq,
    lat: p.lat,
    lng: p.lng,
    accuracy_m: p.accuracyM,
    recorded_at: new Date(p.recordedAt).toISOString(),
    leg_index: p.legIndex ?? 0,
  };
}

/** A stored point as the shared trace shape (for distance and guide maths). */
export function toTracePoint(p: LocalPoint): TracePoint {
  return {
    lat: p.lat,
    lng: p.lng,
    accuracyM: p.accuracyM,
    recordedAt: p.recordedAt,
  };
}
