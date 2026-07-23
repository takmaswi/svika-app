// M2, guide mode: the viewer side rules for following a shared trace.
// Walking directions v1 are trace replay, not routing: the recorded points
// ARE the directions, shortcuts included. Everything here is plain
// geometry with named thresholds, documented in AI-USAGE-MAP.md as not AI.
//
// The rules:
//   1. The viewer's position is projected onto the trace polyline; the
//      perpendicular distance and the metres remaining to the end are the
//      only inputs any cue stands on.
//   2. Off path has hysteresis: you are off past OFF_PATH_METERS and only
//      back on within OFF_PATH_RETURN_METERS, so the cue never flaps at
//      the boundary.
//   3. Approaching and arrived fire on remaining metres, and only while
//      the viewer is actually near the path. Arrived is terminal.
//   4. Steps are derived, not typed: the trace is simplified (Douglas
//      Peucker), then split where the bearing swings past TURN_DEGREES or
//      the implied mode changes. Speed over a step decides walk or ride.

export interface GuidePoint {
  lat: number;
  lng: number;
  /** Epoch milliseconds; optional because a viewer position has no need of it. */
  recordedAt?: number;
}

export interface TraceProjection {
  /** Perpendicular metres from the position to the nearest trace segment. */
  distanceMeters: number;
  /** Index of the segment the position projects onto. */
  segmentIndex: number;
  /** Metres along the trace from its start to the projected point. */
  alongMeters: number;
  /** Metres left along the trace from the projected point to the end. */
  remainingMeters: number;
}

export type GuideCue = "on-path" | "off-path" | "approaching" | "arrived";

export type StepTurn = "start" | "left" | "right" | "continue";
export type StepMode = "walk" | "ride";

export interface GuideStep {
  turn: StepTurn;
  meters: number;
  mode: StepMode;
}

/** Drifting further than this from the trace is off path. */
export const OFF_PATH_METERS = 50;
/** Once off path, you are only back on within this: hysteresis. */
export const OFF_PATH_RETURN_METERS = 30;
/** Remaining metres at which the destination is announced. */
export const APPROACHING_METERS = 120;
/** Remaining metres that count as being there. */
export const ARRIVED_METERS = 25;
/** Bearing swing that makes a turn a turn. */
export const TURN_DEGREES = 40;
/** Simplification tolerance: wiggle under this never makes a step. */
export const SIMPLIFY_EPSILON_METERS = 12;
/** Average step speed at or above this is a ride, below it a walk. */
export const RIDE_SPEED_MPS = 3;

const METERS_PER_DEG_LAT = 111_320;

interface XY {
  x: number;
  y: number;
}

/** Equirectangular projection to metres around a reference latitude:
 *  honest at city scale, and cheap enough to run on every GPS tick. */
function toXY(p: GuidePoint, ref: GuidePoint): XY {
  const cos = Math.cos((ref.lat * Math.PI) / 180);
  return {
    x: (p.lng - ref.lng) * METERS_PER_DEG_LAT * cos,
    y: (p.lat - ref.lat) * METERS_PER_DEG_LAT,
  };
}

function dist(a: XY, b: XY): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Nearest point on segment ab to p, as a fraction t of the segment. */
function segmentT(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  return Math.max(0, Math.min(1, t));
}

export function projectOnTrace(
  trace: readonly GuidePoint[],
  position: GuidePoint,
): TraceProjection | null {
  if (trace.length < 2) return null;
  const ref = trace[0];
  const xy = trace.map((p) => toXY(p, ref));
  const pos = toXY(position, ref);

  let best: TraceProjection | null = null;
  let alongBefore = 0;
  let totalLength = 0;
  for (let i = 0; i < xy.length - 1; i++) {
    totalLength += dist(xy[i], xy[i + 1]);
  }
  for (let i = 0; i < xy.length - 1; i++) {
    const a = xy[i];
    const b = xy[i + 1];
    const t = segmentT(pos, a, b);
    const proj = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const d = dist(pos, proj);
    const segLen = dist(a, b);
    if (!best || d < best.distanceMeters) {
      const along = alongBefore + segLen * t;
      best = {
        distanceMeters: d,
        segmentIndex: i,
        alongMeters: along,
        remainingMeters: totalLength - along,
      };
    }
    alongBefore += segLen;
  }
  return best;
}

/** The next cue given where the viewer stands and the cue they last had. */
export function guideCue(
  trace: readonly GuidePoint[],
  position: GuidePoint,
  previous: GuideCue,
): GuideCue {
  if (previous === "arrived") return "arrived";
  const proj = projectOnTrace(trace, position);
  if (!proj) return previous;

  const offLine =
    previous === "off-path" ? OFF_PATH_RETURN_METERS : OFF_PATH_METERS;
  const nearPath = proj.distanceMeters <= offLine;
  if (nearPath && proj.remainingMeters <= ARRIVED_METERS) return "arrived";
  if (nearPath && proj.remainingMeters <= APPROACHING_METERS) {
    return "approaching";
  }
  return nearPath ? "on-path" : "off-path";
}

/** Douglas Peucker over projected metres; keeps original points. */
function simplify(points: readonly XY[], epsilon: number): number[] {
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    const a = points[first];
    const b = points[last];
    let maxDist = 0;
    let maxIndex = -1;
    for (let i = first + 1; i < last; i++) {
      const t = segmentT(points[i], a, b);
      const proj = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const d = dist(points[i], proj);
      if (d > maxDist) {
        maxDist = d;
        maxIndex = i;
      }
    }
    if (maxDist > epsilon && maxIndex > 0) {
      keep[maxIndex] = true;
      stack.push([first, maxIndex], [maxIndex, last]);
    }
  }
  const kept: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) kept.push(i);
  }
  return kept;
}

/** Bearing of a segment in degrees clockwise from north. */
function bearingDeg(a: XY, b: XY): number {
  return (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
}

/** Signed swing from one bearing to the next, normalised to [-180, 180]. */
function bearingDelta(from: number, to: number): number {
  let d = to - from;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function segmentMode(
  from: GuidePoint,
  to: GuidePoint,
  meters: number,
): StepMode {
  const t0 = from.recordedAt;
  const t1 = to.recordedAt;
  if (t0 === undefined || t1 === undefined || t1 <= t0) return "walk";
  return meters / ((t1 - t0) / 1000) >= RIDE_SPEED_MPS ? "ride" : "walk";
}

/** Steps derived from the trace by turns and mode changes: plain geometry. */
export function deriveSteps(trace: readonly GuidePoint[]): GuideStep[] {
  if (trace.length < 2) return [];
  const ref = trace[0];
  const xy = trace.map((p) => toXY(p, ref));
  const kept = simplify(xy, SIMPLIFY_EPSILON_METERS);
  if (kept.length < 2) return [];

  const steps: GuideStep[] = [];
  let current: GuideStep | null = null;
  let prevBearing: number | null = null;
  for (let k = 0; k < kept.length - 1; k++) {
    const i = kept[k];
    const j = kept[k + 1];
    const meters = dist(xy[i], xy[j]);
    if (meters === 0) continue;
    const bearing = bearingDeg(xy[i], xy[j]);
    const mode = segmentMode(trace[i], trace[j], meters);

    let turn: StepTurn | null = null;
    if (!current) {
      turn = "start";
    } else {
      const delta = prevBearing === null ? 0 : bearingDelta(prevBearing, bearing);
      if (Math.abs(delta) >= TURN_DEGREES) {
        turn = delta < 0 ? "left" : "right";
      } else if (mode !== current.mode) {
        turn = "continue";
      }
    }

    if (turn !== null || !current) {
      current = { turn: turn ?? "start", meters, mode };
      steps.push(current);
    } else {
      current.meters += meters;
    }
    prevBearing = bearing;
  }
  return steps.map((s) => ({ ...s, meters: Math.round(s.meters) }));
}
