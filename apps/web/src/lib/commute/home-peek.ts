// V1, answer-first home: the peek state chooser. Pure rules over the mined
// commute patterns (patterns.ts), no new intelligence:
//
//   1. A pattern whose usual day and window contain this moment answers with
//      the usual trip (activePattern, unchanged).
//   2. Otherwise, a pattern whose window already passed today answers with
//      the return trip: the pair reversed. The latest passed window wins,
//      busiest on a tie, so after both legs of a commute the answer is the
//      next ride in.
//   3. A demo persona whose stage clock matches nothing still gets the
//      busiest mined trip (same waiver as alertPattern); a real rider with
//      no recognised moment falls back to the search peek.
import { activePattern, catMinutes, type CommutePattern } from "./patterns";

export interface HomePeekTrip {
  kind: "commute" | "return";
  fromStopId: string;
  toStopId: string;
  fromName: string;
  toName: string;
}

export type HomePeekState = HomePeekTrip | { kind: "search" };

export function homePeekState(
  patterns: CommutePattern[],
  now: Date,
  opts: { demo: boolean },
): HomePeekState {
  const active = activePattern(patterns, now);
  if (active) {
    return {
      kind: "commute",
      fromStopId: active.fromStopId,
      toStopId: active.toStopId,
      fromName: active.fromName,
      toName: active.toName,
    };
  }

  const { minuteOfDay, dayOfWeek } = catMinutes(now.toISOString());
  const passed = patterns
    .filter((p) => p.days.includes(dayOfWeek) && minuteOfDay > p.windowEnd)
    .sort((a, b) => b.windowEnd - a.windowEnd || b.rides - a.rides);
  const latest = passed[0];
  if (latest) {
    return {
      kind: "return",
      fromStopId: latest.toStopId,
      toStopId: latest.fromStopId,
      fromName: latest.toName,
      toName: latest.fromName,
    };
  }

  const busiest = patterns[0];
  if (opts.demo && busiest) {
    return {
      kind: "commute",
      fromStopId: busiest.fromStopId,
      toStopId: busiest.toStopId,
      fromName: busiest.fromName,
      toName: busiest.toName,
    };
  }

  return { kind: "search" };
}
