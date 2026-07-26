// D2 implicit feedback: did we get you there right?
//
// When a rider recorded their journey (M1) over a planned trip, the planned
// alight stop and walking tail can be compared against what actually
// happened. This is deliberately geometry rules with named constants, no
// model: the output is a mismatch table the planner rules can be tuned
// from, and the honest seed for a future learned ranker (which would then
// need its baseline and metrics table per the AI law before it ships).
//
// The rules, in plain words:
//   * the actual alight point is the last trace point that was still moving
//     at riding speed; everything after it is the actual walk,
//   * a verdict is only offered when the trace shows a ride then an arrival
//     near where the plan ends; a walk-only or unfinished trace says
//     nothing rather than guessing,
//   * early versus late is read against the reference point the plan was
//     heading for (the walking tail destination, or where the rider
//     actually ended for a stop to stop trip): alighting farther from it
//     than the planned stop is early, closer is late. A v1 simplification,
//     documented, not hidden,
//   * a walk longer than one and a half times the promise (plus dead band)
//     is a long walk, including the stop to stop case where the promise
//     was no walk at all.
//
// No output here ever names a conductor or a vehicle; a mismatch belongs
// to the plan that produced it.
import { haversineMeters } from "./plan-to-point";

export interface MismatchLatLng {
  lat: number;
  lng: number;
}

export interface MismatchTracePoint {
  lat: number;
  lng: number;
  /** ms epoch */
  recordedAt: number;
}

export interface PlannedArrival {
  /** the planned alight stop (tickets.to_stop_id, resolved to coordinates) */
  alightStop: MismatchLatLng;
  /** the walking tail destination (trip_walk_tails), null for stop to stop */
  destination: MismatchLatLng | null;
  /** the walk the plan promised, in metres (0 without a tail) */
  plannedWalkM: number;
}

export type MismatchKind = "early_alight" | "late_alight" | "long_walk";

export interface PlanTraceMismatch {
  kind: MismatchKind;
  /** metres between the planned stop and where the ride actually ended */
  alightOffsetM: number | null;
  plannedWalkM: number;
  /** metres actually walked after the ride ended */
  actualWalkM: number | null;
}

/** moving at or above this is riding, not walking */
const RIDE_SPEED_MPS = 4;
/** an alight this close to the planned stop is the planned stop */
const ALIGHT_TOLERANCE_M = 150;
/** a walk beyond factor x promise (and past the dead band) is long */
const LONG_WALK_FACTOR = 1.5;
const LONG_WALK_DEAD_BAND_M = 200;
/** the trace must end this close to the plan's end to say anything */
const ARRIVAL_RADIUS_M = 500;
/** fewer points than this is not a trace worth reading */
const MIN_TRACE_POINTS = 5;

function segmentSpeed(a: MismatchTracePoint, b: MismatchTracePoint): number {
  const seconds = (b.recordedAt - a.recordedAt) / 1000;
  if (seconds <= 0) return 0;
  return haversineMeters(a.lng, a.lat, b.lng, b.lat) / seconds;
}

function pathMeters(points: MismatchTracePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(
      points[i - 1]!.lng,
      points[i - 1]!.lat,
      points[i]!.lng,
      points[i]!.lat,
    );
  }
  return total;
}

export function detectPlanTraceMismatches(
  planned: PlannedArrival,
  trace: MismatchTracePoint[],
): PlanTraceMismatch[] {
  if (trace.length < MIN_TRACE_POINTS) return [];
  const end = trace[trace.length - 1]!;
  const reference = planned.destination ?? { lat: end.lat, lng: end.lng };

  // an unfinished trace says nothing rather than guessing
  if (
    haversineMeters(end.lng, end.lat, reference.lng, reference.lat) >
    ARRIVAL_RADIUS_M
  ) {
    return [];
  }

  // the last point still moving at riding speed ends the ride
  let lastRideIdx = -1;
  for (let i = 1; i < trace.length; i++) {
    if (segmentSpeed(trace[i - 1]!, trace[i]!) >= RIDE_SPEED_MPS) {
      lastRideIdx = i;
    }
  }
  // no ride in the trace: a walk-only recording cannot judge an alight
  if (lastRideIdx < 1) return [];

  const mismatches: PlanTraceMismatch[] = [];
  const actualAlight = trace[lastRideIdx]!;
  const alightOffsetM = Math.round(
    haversineMeters(
      actualAlight.lng,
      actualAlight.lat,
      planned.alightStop.lng,
      planned.alightStop.lat,
    ),
  );
  const actualWalkM = Math.round(pathMeters(trace.slice(lastRideIdx)));

  if (alightOffsetM > ALIGHT_TOLERANCE_M) {
    const plannedToRef = haversineMeters(
      planned.alightStop.lng,
      planned.alightStop.lat,
      reference.lng,
      reference.lat,
    );
    const actualToRef = haversineMeters(
      actualAlight.lng,
      actualAlight.lat,
      reference.lng,
      reference.lat,
    );
    mismatches.push({
      kind: actualToRef > plannedToRef ? "early_alight" : "late_alight",
      alightOffsetM,
      plannedWalkM: planned.plannedWalkM,
      actualWalkM,
    });
  }

  const longWalkThreshold = Math.max(
    planned.plannedWalkM * LONG_WALK_FACTOR,
    planned.plannedWalkM + LONG_WALK_DEAD_BAND_M,
  );
  if (actualWalkM > longWalkThreshold) {
    mismatches.push({
      kind: "long_walk",
      alightOffsetM,
      plannedWalkM: planned.plannedWalkM,
      actualWalkM,
    });
  }

  return mismatches;
}
