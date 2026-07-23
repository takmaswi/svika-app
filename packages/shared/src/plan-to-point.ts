// D1, destination first planning: from an origin stop to any point on the
// map, not just a stop. Deterministic rules, documented here and in
// AI-USAGE-MAP.md; this is arithmetic and the existing Dijkstra planner,
// not AI, and the docs say so.
//
// The rules:
//   1. Candidate alight stops are the nearest stops to the destination
//      within WALK_SERVICE_METERS straight line, capped at
//      MAX_ALIGHT_CANDIDATES. The origin itself never counts.
//   2. Each candidate that the planner can reach is scored by
//      plan.totalMinutes + boardings * BOARDING_PENALTY_MINUTES + the
//      walking tail's minutes. Lowest wins; ties fall to the shorter tail,
//      then the lower fare, then stop id so the result is stable.
//   3. Walking tails are honest estimates over straight line distance: the
//      street factor stretches it (streets are not crow flight) and the
//      pace is a city walking speed. The UI shows the trade in metres.
//   4. When no candidate within service range is reachable (or none
//      exists), the plan does not pretend: connected is false, and the
//      reachable stop nearest the destination serves with its long walk
//      shown plainly.
import {
  BOARDING_PENALTY_MINUTES,
  planTrip,
  type Network,
  type NetworkStop,
  type TripPlan,
} from "./planner";

export interface DestinationPoint {
  name: string;
  lng: number;
  lat: number;
}

export interface WalkTailLeg {
  fromStopId: string;
  meters: number;
  minutes: number;
}

export interface PointPlan {
  plan: TripPlan;
  alightStopId: string;
  walkTail: WalkTailLeg;
  /** False when no kombi serves the destination's walkable range. */
  connected: boolean;
}

/** A stop within this straight line range "serves" the destination: about
 *  a twenty minute walk at pace, and forgiving of large places (a campus,
 *  a suburb) whose corpus point is their centre, not their gate. */
export const WALK_SERVICE_METERS = 1500;
/** How many nearby stops the planner tries. */
export const MAX_ALIGHT_CANDIDATES = 5;
/** Streets are not crow flight: straight line metres stretched by this. */
export const STREET_FACTOR = 1.25;
/** City walking pace. */
export const WALK_METERS_PER_MINUTE = 75;

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(
  aLng: number,
  aLat: number,
  bLng: number,
  bLat: number,
): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** The honest walking tail from a stop to the destination point. */
export function walkTail(stop: NetworkStop, dest: DestinationPoint): WalkTailLeg {
  const straight = haversineMeters(stop.lng, stop.lat, dest.lng, dest.lat);
  const meters = Math.round(straight * STREET_FACTOR);
  return {
    fromStopId: stop.id,
    meters,
    minutes: Math.ceil(meters / WALK_METERS_PER_MINUTE),
  };
}

interface Scored {
  plan: TripPlan;
  stop: NetworkStop;
  tail: WalkTailLeg;
  score: number;
}

function better(a: Scored, b: Scored): boolean {
  if (a.score !== b.score) return a.score < b.score;
  if (a.tail.meters !== b.tail.meters) return a.tail.meters < b.tail.meters;
  if (a.plan.totalFareCents !== b.plan.totalFareCents) {
    return a.plan.totalFareCents < b.plan.totalFareCents;
  }
  return a.stop.id < b.stop.id;
}

export function planToPoint(
  network: Network,
  originStopId: string,
  dest: DestinationPoint,
): PointPlan | null {
  if (!network.stops.some((s) => s.id === originStopId)) return null;

  const byDistance = network.stops
    .filter((s) => s.id !== originStopId)
    .map((stop) => ({
      stop,
      straight: haversineMeters(stop.lng, stop.lat, dest.lng, dest.lat),
    }))
    .sort((a, b) => a.straight - b.straight);

  const score = (stop: NetworkStop): Scored | null => {
    const plan = planTrip(network, originStopId, stop.id);
    if (!plan) return null;
    const tail = walkTail(stop, dest);
    return {
      plan,
      stop,
      tail,
      score:
        plan.totalMinutes + plan.boardings * BOARDING_PENALTY_MINUTES + tail.minutes,
    };
  };

  let best: Scored | null = null;
  for (const c of byDistance
    .filter((x) => x.straight <= WALK_SERVICE_METERS)
    .slice(0, MAX_ALIGHT_CANDIDATES)) {
    const s = score(c.stop);
    if (s && (!best || better(s, best))) best = s;
  }
  if (best) {
    return {
      plan: best.plan,
      alightStopId: best.stop.id,
      walkTail: best.tail,
      connected: true,
    };
  }

  // no kombi serves the destination's walkable range: the nearest reachable
  // stop serves, and the caller must say so plainly
  for (const c of byDistance) {
    const s = score(c.stop);
    if (!s) continue;
    return {
      plan: s.plan,
      alightStopId: s.stop.id,
      walkTail: s.tail,
      connected: false,
    };
  }
  return null;
}
