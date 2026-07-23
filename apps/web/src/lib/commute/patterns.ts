// Spine 2, commute alerts: the pattern miner. Deliberately plain statistics
// over the rider's own ticket history (grouping, distinct day counting and a
// median), computed in the app server under the rider's own RLS scope. No
// model, no cross rider learning; docs/SPINE-2-COMMUTE-ALERTS.md explains
// why and names the baseline this beats. All maths in Harare local time
// (CAT, UTC+2, no daylight saving).

export const CAT_OFFSET_MINUTES = 120;
export const LOOKBACK_DAYS = 28;
/** A pattern needs this many rides on the same stop pair to count. */
export const MIN_RIDES = 5;
/** ...spread over at least this many distinct days of the week. */
export const MIN_DISTINCT_DAYS = 3;
/** The usual window is the median departure plus or minus this. */
export const WINDOW_HALF_MINUTES = 45;
/** "Near" for the alert: the live wait is at most this many minutes. Sits
 *  just above the demo fleet's worst arrival gap (~19 min on the 67 min
 *  cycle), so the alert reads the actual next arrival; the guard exists so
 *  sparse service (one kombi, 40 min out) stays silent instead of crying
 *  near. See docs/SPINE-2-COMMUTE-ALERTS.md. */
export const ALERT_ETA_MINUTES = 20;

const MINUTES_PER_DAY = 24 * 60;

export interface RideFact {
  fromStopId: string;
  toStopId: string;
  fromName: string;
  toName: string;
  /** ISO timestamp of purchase, treated as the departure moment. */
  purchasedAt: string;
}

export interface CommutePattern {
  fromStopId: string;
  toStopId: string;
  fromName: string;
  toName: string;
  rides: number;
  /** Distinct CAT days of week seen (0 = Sunday). */
  days: number[];
  medianMinute: number;
  windowStart: number;
  windowEnd: number;
}

export function catMinutes(iso: string): { minuteOfDay: number; dayOfWeek: number } {
  const utc = new Date(iso);
  const shifted = new Date(utc.getTime() + CAT_OFFSET_MINUTES * 60_000);
  return {
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    dayOfWeek: shifted.getUTCDay(),
  };
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * Mines recurring trips from the rider's own history: same stop pair, at
 * least MIN_RIDES rides across MIN_DISTINCT_DAYS distinct days of the week
 * inside the lookback, with the usual window around the median departure.
 * Busiest pattern first.
 */
export function mineCommutePatterns(rides: RideFact[], now: Date): CommutePattern[] {
  const cutoff = now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60_000;
  const groups = new Map<string, RideFact[]>();
  for (const ride of rides) {
    const at = new Date(ride.purchasedAt).getTime();
    if (Number.isNaN(at) || at < cutoff || at > now.getTime()) continue;
    const key = `${ride.fromStopId}|${ride.toStopId}`;
    const group = groups.get(key) ?? [];
    groups.set(key, [...group, ride]);
  }

  const patterns: CommutePattern[] = [];
  for (const group of groups.values()) {
    if (group.length < MIN_RIDES) continue;
    const stamps = group.map((r) => catMinutes(r.purchasedAt));
    const days = [...new Set(stamps.map((s) => s.dayOfWeek))].sort();
    if (days.length < MIN_DISTINCT_DAYS) continue;
    const minutes = stamps.map((s) => s.minuteOfDay).sort((a, b) => a - b);
    const mid = median(minutes);
    const first = group[0]!;
    patterns.push({
      fromStopId: first.fromStopId,
      toStopId: first.toStopId,
      fromName: first.fromName,
      toName: first.toName,
      rides: group.length,
      days,
      medianMinute: mid,
      windowStart: Math.max(0, mid - WINDOW_HALF_MINUTES),
      windowEnd: Math.min(MINUTES_PER_DAY - 1, mid + WINDOW_HALF_MINUTES),
    });
  }
  return patterns.sort((a, b) => b.rides - a.rides);
}

/** The pattern whose usual day and window contain this moment, if any. */
export function activePattern(
  patterns: CommutePattern[],
  now: Date,
): CommutePattern | null {
  const { minuteOfDay, dayOfWeek } = catMinutes(now.toISOString());
  return (
    patterns.find(
      (p) =>
        p.days.includes(dayOfWeek) &&
        minuteOfDay >= p.windowStart &&
        minuteOfDay <= p.windowEnd,
    ) ?? null
  );
}

/**
 * Which mined pattern drives the home commute alert.
 *
 * A real rider sees it only when the moment sits in the usual window
 * (activePattern), exactly as before. A demo persona runs on whatever wall
 * clock the stage happens to have, and its fixture history can straddle a
 * reseed (leaving two clusters whose median lands between them), so the
 * "is it the usual time" gate is waived and the busiest mined pattern drives
 * the alert on any clock. The live ETA gate (etaSaysNear) and the honest
 * basis label are untouched, so what shows is still the real route and the
 * real minutes; real riders are never widened.
 */
export function alertPattern(
  patterns: CommutePattern[],
  now: Date,
  opts: { demo: boolean },
): CommutePattern | null {
  if (opts.demo) return patterns[0] ?? null;
  return activePattern(patterns, now);
}

/** "The usual kombi is near": the live wait fits inside the threshold. */
export function etaSaysNear(etaMinutes: number): boolean {
  return etaMinutes <= ALERT_ETA_MINUTES;
}
