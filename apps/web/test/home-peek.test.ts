import { describe, expect, test } from "vitest";
import { homePeekState } from "../src/lib/commute/home-peek";
import type { CommutePattern } from "../src/lib/commute/patterns";

// 2026-07-10 is a Friday; CAT = UTC+2, so 06:00Z is 08:00 CAT.
const FRIDAY = 5;

function catMoment(catHour: number, catMinute = 0): Date {
  return new Date(Date.UTC(2026, 6, 10, catHour - 2, catMinute));
}

function pattern(overrides: Partial<CommutePattern> = {}): CommutePattern {
  const medianMinute = 7 * 60 + 45; // 07:45 CAT
  return {
    fromStopId: "heights",
    toStopId: "rezende",
    fromName: "2nd boom gate",
    toName: "Rezende Rank",
    rides: 12,
    days: [1, 2, 3, 4, FRIDAY],
    medianMinute,
    windowStart: medianMinute - 45,
    windowEnd: medianMinute + 45,
    ...overrides,
  };
}

describe("homePeekState", () => {
  test("no history means the search peek", () => {
    expect(homePeekState([], catMoment(8), { demo: false })).toEqual({
      kind: "search",
    });
  });

  test("inside the usual window the peek answers with the usual trip", () => {
    const state = homePeekState([pattern()], catMoment(8), { demo: false });
    expect(state).toMatchObject({
      kind: "commute",
      fromStopId: "heights",
      toStopId: "rezende",
      fromName: "2nd boom gate",
      toName: "Rezende Rank",
    });
  });

  test("after the window has passed the peek answers with the return trip", () => {
    const state = homePeekState([pattern()], catMoment(17, 30), { demo: false });
    expect(state).toMatchObject({
      kind: "return",
      fromStopId: "rezende",
      toStopId: "heights",
      fromName: "Rezende Rank",
      toName: "2nd boom gate",
    });
  });

  test("before the window opens the peek stays a search box", () => {
    expect(homePeekState([pattern()], catMoment(5), { demo: false })).toEqual({
      kind: "search",
    });
  });

  test("a pattern for other weekdays never drives today's peek", () => {
    const weekend = pattern({ days: [0, 6] });
    expect(homePeekState([weekend], catMoment(8), { demo: false })).toEqual({
      kind: "search",
    });
    expect(homePeekState([weekend], catMoment(17), { demo: false })).toEqual({
      kind: "search",
    });
  });

  test("with morning and evening patterns passed, the later one drives the return", () => {
    const morning = pattern();
    const eveningMedian = 17 * 60 + 15;
    const evening = pattern({
      fromStopId: "rezende",
      toStopId: "heights",
      fromName: "Rezende Rank",
      toName: "2nd boom gate",
      rides: 20,
      medianMinute: eveningMedian,
      windowStart: eveningMedian - 45,
      windowEnd: eveningMedian + 45,
    });
    // 22:00 CAT: both windows are gone; the evening pattern is the later
    // one, so its reverse (tomorrow's ride in) is the answer.
    const state = homePeekState([evening, morning], catMoment(22), { demo: false });
    expect(state).toMatchObject({
      kind: "return",
      fromStopId: "heights",
      toStopId: "rezende",
    });
  });

  test("ties on window end fall to the busier pattern", () => {
    const quiet = pattern({ rides: 6 });
    const busy = pattern({
      fromStopId: "avondale",
      toStopId: "town",
      fromName: "Avondale",
      toName: "Market Square Rank",
      rides: 15,
    });
    const state = homePeekState([busy, quiet], catMoment(17), { demo: false });
    expect(state).toMatchObject({ kind: "return", fromStopId: "town" });
  });

  test("an active window beats a passed one", () => {
    const morning = pattern();
    const middayMedian = 13 * 60;
    const midday = pattern({
      fromStopId: "avondale",
      toStopId: "town",
      fromName: "Avondale",
      toName: "Market Square Rank",
      rides: 6,
      medianMinute: middayMedian,
      windowStart: middayMedian - 45,
      windowEnd: middayMedian + 45,
    });
    const state = homePeekState([morning, midday], catMoment(13), { demo: false });
    expect(state).toMatchObject({ kind: "commute", fromStopId: "avondale" });
  });

  test("a demo persona with no matching moment still gets the busiest trip", () => {
    // 05:00 CAT on a weekend pattern: a real rider would see search, but the
    // stage clock is arbitrary, so the demo shows the busiest mined trip.
    const weekend = pattern({ days: [0, 6] });
    const state = homePeekState([weekend], catMoment(5), { demo: true });
    expect(state).toMatchObject({ kind: "commute", fromStopId: "heights" });
  });

  test("a demo persona inside a real window follows the real rule", () => {
    const state = homePeekState([pattern()], catMoment(8), { demo: true });
    expect(state).toMatchObject({ kind: "commute", fromStopId: "heights" });
  });

  test("a demo persona past the window gets the return trip like anyone", () => {
    const state = homePeekState([pattern()], catMoment(18), { demo: true });
    expect(state).toMatchObject({ kind: "return", fromStopId: "rezende" });
  });

  test("a demo persona with no history still searches", () => {
    expect(homePeekState([], catMoment(8), { demo: true })).toEqual({
      kind: "search",
    });
  });
});
