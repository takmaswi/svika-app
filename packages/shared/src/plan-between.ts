// Launch Step 3: plan between any two ends, each a stop or a point (the
// rider's location, a place). Deterministic rules on top of the stop
// planner and planToPoint, no AI:
//
//   1. A point origin tries the nearest stops within WALK_SERVICE_METERS
//      (at most MAX_ALIGHT_CANDIDATES). Each gets an honest walking head
//      (straight line times the street factor, at the city pace).
//   2. Each candidate is scored like planToPoint: walk head minutes + ride
//      minutes + boardings times the boarding penalty + walk tail minutes.
//      Lowest wins; ties fall to the shorter head, then the lower fare, then
//      stop id so the answer is stable.
//   3. When no stop is in walking range of the origin, the nearest stop that
//      can make the trip serves, and reachableFrom is false so the screen
//      says so plainly. The destination side keeps planToPoint's rule.
import {
  BOARDING_PENALTY_MINUTES,
  planTrip,
  type Network,
  type NetworkStop,
  type TripPlan,
} from "./planner";
import {
  MAX_ALIGHT_CANDIDATES,
  WALK_SERVICE_METERS,
  haversineMeters,
  planToPoint,
  walkTail,
  type DestinationPoint,
  type WalkTailLeg,
} from "./plan-to-point";

export type TripEnd =
  | { kind: "stop"; stopId: string }
  | { kind: "point"; point: DestinationPoint };

export interface WalkHeadLeg {
  toStopId: string;
  meters: number;
  minutes: number;
}

export interface BetweenPlan {
  plan: TripPlan;
  boardStopId: string;
  alightStopId: string;
  /** The walk from a point origin to the boarding stop. */
  head: WalkHeadLeg | null;
  /** The walk from the alighting stop to a point destination. */
  tail: WalkTailLeg | null;
  /** False when no stop was in walking range of the origin point. */
  reachableFrom: boolean;
  /** False when no kombi serves the destination's walkable range. */
  reachableTo: boolean;
  totalMinutes: number;
}

interface Candidate {
  result: BetweenPlan;
  score: number;
}

function rideToEnd(network: Network, boardStopId: string, dest: TripEnd) {
  if (dest.kind === "stop") {
    if (dest.stopId === boardStopId) return null;
    const plan = planTrip(network, boardStopId, dest.stopId);
    return plan ? { plan, tail: null, reachableTo: true } : null;
  }
  const pp = planToPoint(network, boardStopId, dest.point);
  return pp ? { plan: pp.plan, tail: pp.walkTail, reachableTo: pp.connected } : null;
}

function candidateFor(
  network: Network,
  board: NetworkStop,
  origin: TripEnd,
  dest: TripEnd,
  reachableFrom: boolean,
): Candidate | null {
  const ride = rideToEnd(network, board.id, dest);
  if (!ride) return null;
  const walk = origin.kind === "point" ? walkTail(board, origin.point) : null;
  const head = walk
    ? { toStopId: board.id, meters: walk.meters, minutes: walk.minutes }
    : null;
  const totalMinutes =
    (head?.minutes ?? 0) + ride.plan.totalMinutes + (ride.tail?.minutes ?? 0);
  return {
    score: totalMinutes + ride.plan.boardings * BOARDING_PENALTY_MINUTES,
    result: {
      plan: ride.plan,
      boardStopId: ride.plan.originStopId,
      alightStopId: ride.plan.destinationStopId,
      head,
      tail: ride.tail,
      reachableFrom,
      reachableTo: ride.reachableTo,
      totalMinutes,
    },
  };
}

function better(a: Candidate, b: Candidate): boolean {
  if (a.score !== b.score) return a.score < b.score;
  const ah = a.result.head?.meters ?? 0;
  const bh = b.result.head?.meters ?? 0;
  if (ah !== bh) return ah < bh;
  if (a.result.plan.totalFareCents !== b.result.plan.totalFareCents) {
    return a.result.plan.totalFareCents < b.result.plan.totalFareCents;
  }
  return a.result.boardStopId < b.result.boardStopId;
}

export function planBetween(
  network: Network,
  origin: TripEnd,
  dest: TripEnd,
): BetweenPlan | null {
  if (origin.kind === "stop") {
    const board = network.stops.find((s) => s.id === origin.stopId);
    return board
      ? (candidateFor(network, board, origin, dest, true)?.result ?? null)
      : null;
  }

  const p = origin.point;
  const byDistance = network.stops
    .map((stop) => ({
      stop,
      straight: haversineMeters(p.lng, p.lat, stop.lng, stop.lat),
    }))
    .sort((a, b) => a.straight - b.straight);

  let best: Candidate | null = null;
  for (const c of byDistance
    .filter((x) => x.straight <= WALK_SERVICE_METERS)
    .slice(0, MAX_ALIGHT_CANDIDATES)) {
    const cand = candidateFor(network, c.stop, origin, dest, true);
    if (cand && (!best || better(cand, best))) best = cand;
  }
  if (best) return best.result;

  // nothing in walking range: the nearest stop that can make the trip
  for (const c of byDistance) {
    const cand = candidateFor(network, c.stop, origin, dest, false);
    if (cand) return cand.result;
  }
  return null;
}
