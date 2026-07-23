// M1, journey tracking: the capture side rules. Plain geometry and named
// thresholds, documented here and in AI-USAGE-MAP.md; nothing here is AI.
//
// The rules:
//   1. A fix with worse than ACCURACY_REJECT_METERS accuracy is noise
//      (indoors, cold start) and never enters the trace.
//   2. Sampling adapts to speed to protect the battery: a moving kombi is
//      sampled tightest so turns survive, a walker a little wider, a rider
//      standing at the rank sparsest of all.
//   3. Standing jitter (movement under MIN_MOVE_METERS within the
//      heartbeat window) is dropped; a heartbeat point is kept every
//      HEARTBEAT_MS regardless so a stationary stretch is still a fact.
//   4. Distance never counts teleports: a hop implying more than
//      TELEPORT_SPEED_MPS is a GPS glitch, not a journey.
import { haversineMeters } from "./plan-to-point";

export interface TracePoint {
  lat: number;
  lng: number;
  accuracyM: number;
  /** Epoch milliseconds. */
  recordedAt: number;
}

/** Fixes with worse accuracy than this are dropped as noise. */
export const ACCURACY_REJECT_METERS = 50;
/** Below this speed the rider is standing still. */
export const STILL_SPEED_MPS = 0.5;
/** Above this speed the rider is in a vehicle, not walking. */
export const MOVING_SPEED_MPS = 3.5;
/** Sample delay while standing still: sparse, battery first. */
export const DELAY_STILL_MS = 20_000;
/** Sample delay while walking. */
export const DELAY_WALKING_MS = 6_000;
/** Sample delay while riding: tight, so corners survive. */
export const DELAY_MOVING_MS = 3_000;
/** Movement under this within the heartbeat window is standing jitter. */
export const MIN_MOVE_METERS = 8;
/** Keep a point at least this often even when standing still. */
export const HEARTBEAT_MS = 45_000;
/** A hop implying more than this speed is a GPS glitch, not travel. */
export const TELEPORT_SPEED_MPS = 45;

/** Ground speed between two fixes, metres per second. */
export function speedMps(prev: TracePoint, next: TracePoint): number {
  const seconds = (next.recordedAt - prev.recordedAt) / 1000;
  if (seconds <= 0) return 0;
  return haversineMeters(prev.lng, prev.lat, next.lng, next.lat) / seconds;
}

/** How long to wait before the next sample at this speed. */
export function sampleDelayMs(speed: number): number {
  if (speed < STILL_SPEED_MPS) return DELAY_STILL_MS;
  if (speed < MOVING_SPEED_MPS) return DELAY_WALKING_MS;
  return DELAY_MOVING_MS;
}

/** Whether a candidate fix earns a place in the trace. */
export function shouldKeepPoint(
  prev: TracePoint | null,
  candidate: TracePoint,
): boolean {
  if (candidate.accuracyM > ACCURACY_REJECT_METERS) return false;
  if (!prev) return true;
  const moved = haversineMeters(
    prev.lng,
    prev.lat,
    candidate.lng,
    candidate.lat,
  );
  if (moved >= MIN_MOVE_METERS) return true;
  // heartbeat: a stationary stretch is still a fact worth one point
  return candidate.recordedAt - prev.recordedAt >= HEARTBEAT_MS;
}

/** Distance along the trace, teleport glitches excluded. */
export function traceDistanceMeters(points: readonly TracePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const next = points[i];
    const hop = haversineMeters(prev.lng, prev.lat, next.lng, next.lat);
    const seconds = (next.recordedAt - prev.recordedAt) / 1000;
    if (seconds > 0 && hop / seconds > TELEPORT_SPEED_MPS) continue;
    total += hop;
  }
  return total;
}
