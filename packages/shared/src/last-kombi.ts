// Last kombi countdown (batch V7): when does this route's service actually
// die in the evening, and should the rider be told right now?
//
// NOT AI (AI-USAGE-MAP.md). A percentile over observed days plus three
// thresholds. The database hands over one observation per day (the minute the
// last fare cleared, from public.service_day_ends); everything that decides
// anything is here, in plain code, unit tested on both sparse and dense
// history.
//
// The honesty rules this file exists to enforce:
//   - thin history says nothing at all rather than guessing from two evenings
//   - the answer is always "usually", never a departure time and never a
//     promise; the spread is carried alongside so wide-varying routes can say
//     so out loud
//   - a warning is only worth showing while the rider can still act on it

/** Days needed for one weekday's own answer before it beats the pooled one. */
export const LAST_KOMBI_MIN_WEEKDAY_DAYS = 4;
/** Days needed, pooled across weekdays, before there is any answer at all. */
export const LAST_KOMBI_MIN_DAYS = 6;
/** How long before the usual last kombi the warning becomes useful. */
export const LAST_KOMBI_WARN_LEAD_MINUTES = 90;
/** A p10 to p90 spread this wide means the route's evenings are not a habit. */
export const LAST_KOMBI_WIDE_SPREAD_MINUTES = 60;

/** One observed day: the minute of day the last fare cleared on this route. */
export interface ServiceDayEnd {
  /** ISO weekday, 1 = Monday .. 7 = Sunday, in Harare local time. */
  weekday: number;
  /** Local minute of day, 0..1439. */
  lastFareMinute: number;
  /** Where the observation came from; synthetic days are disclosed on screen. */
  source: "real" | "synthetic";
}

export interface LastKombiEstimate {
  /** The usual last kombi, as a local minute of day. */
  usualMinute: number;
  /** p90 minus p10 over the same days: how much the evenings move about. */
  spreadMinutes: number;
  /** Days the estimate stands on. */
  observedDays: number;
  realDays: number;
  syntheticDays: number;
  /** Whether this weekday had enough days of its own, or was pooled. */
  scope: "weekday" | "pooled";
}

export type LastKombiState =
  /** Not enough evenings to say anything. Show nothing. */
  | "unknown"
  /** Known, but too early for the warning to be useful. */
  | "early"
  /** Inside the lead window and still before the usual time: act now. */
  | "warn"
  /** Past the usual time. Still not a promise, in either direction. */
  | "past";

export interface LastKombiWarning {
  state: LastKombiState;
  estimate: LastKombiEstimate | null;
  /** Minutes from now to the usual last kombi; negative once it has passed. */
  minutesLeft: number | null;
  /** True when the spread is too wide for the estimate to read as reliable. */
  wide: boolean;
}

/**
 * Linear interpolated percentile over a sorted numeric sample, the same
 * definition Postgres percentile_cont uses. Kept here rather than in SQL so
 * the rule that riders read is the rule the tests exercise.
 */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new Error("percentile of an empty sample");
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * Math.min(Math.max(p, 0), 1);
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  if (low === high) return sorted[low]!;
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (pos - low);
}

/**
 * The estimate for one weekday. A weekday with enough evenings of its own
 * answers for itself (Friday nights are not Tuesday nights); otherwise the
 * whole sample answers, and says so through `scope`. Below the pooled floor
 * there is no answer, which is a result, not a failure.
 */
export function estimateLastKombi(
  days: readonly ServiceDayEnd[],
  weekday: number,
): LastKombiEstimate | null {
  const ownDay = days.filter((d) => d.weekday === weekday);
  const sample =
    ownDay.length >= LAST_KOMBI_MIN_WEEKDAY_DAYS ? ownDay : [...days];
  if (sample.length < LAST_KOMBI_MIN_DAYS) return null;

  const minutes = sample.map((d) => d.lastFareMinute).sort((a, b) => a - b);
  return {
    usualMinute: Math.round(percentile(minutes, 0.5)),
    spreadMinutes: Math.round(percentile(minutes, 0.9) - percentile(minutes, 0.1)),
    observedDays: sample.length,
    realDays: sample.filter((d) => d.source === "real").length,
    syntheticDays: sample.filter((d) => d.source === "synthetic").length,
    scope: ownDay.length >= LAST_KOMBI_MIN_WEEKDAY_DAYS ? "weekday" : "pooled",
  };
}

/**
 * Whether to warn, given the estimate and the local time now. The warning
 * only appears inside the lead window: a rider told at noon that the last
 * kombi goes at 8:40pm learns nothing they can use, and a screen that always
 * warns is a screen nobody reads.
 */
export function lastKombiWarning(
  days: readonly ServiceDayEnd[],
  weekday: number,
  nowMinute: number,
): LastKombiWarning {
  const estimate = estimateLastKombi(days, weekday);
  if (!estimate) {
    return { state: "unknown", estimate: null, minutesLeft: null, wide: false };
  }
  const minutesLeft = estimate.usualMinute - nowMinute;
  const wide = estimate.spreadMinutes >= LAST_KOMBI_WIDE_SPREAD_MINUTES;
  const state: LastKombiState =
    minutesLeft < 0
      ? "past"
      : minutesLeft <= LAST_KOMBI_WARN_LEAD_MINUTES
        ? "warn"
        : "early";
  return { state, estimate, minutesLeft, wide };
}

/** Local minute of day as a 12 hour clock time, e.g. 1240 -> "8:40pm". */
export function formatMinuteOfDay(minute: number): string {
  const wrapped = ((Math.round(minute) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  const suffix = hour24 < 12 ? "am" : "pm";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(mins).padStart(2, "0")}${suffix}`;
}

/** Harare is UTC+2 with no daylight saving, so the local clock is arithmetic. */
export const HARARE_UTC_OFFSET_MINUTES = 120;

/** Local minute of day and ISO weekday in Harare for an instant. */
export function harareNow(at: Date): { minute: number; weekday: number } {
  const shifted = new Date(at.getTime() + HARARE_UTC_OFFSET_MINUTES * 60_000);
  const minute = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  const dow = shifted.getUTCDay(); // 0 = Sunday
  return { minute, weekday: dow === 0 ? 7 : dow };
}
