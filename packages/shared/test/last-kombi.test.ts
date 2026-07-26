import { describe, expect, test } from "vitest";
import {
  estimateLastKombi,
  formatMinuteOfDay,
  harareNow,
  lastKombiWarning,
  percentile,
  LAST_KOMBI_MIN_DAYS,
  LAST_KOMBI_MIN_WEEKDAY_DAYS,
  LAST_KOMBI_WARN_LEAD_MINUTES,
  LAST_KOMBI_WIDE_SPREAD_MINUTES,
  type ServiceDayEnd,
} from "../src/last-kombi";

// The countdown is a percentile plus three thresholds. What these tests
// defend is the honesty, not the arithmetic: thin history must say nothing,
// a weekday must be allowed to differ from the pooled week, and a wide spread
// must be visible rather than smoothed into a confident-looking time.

const at = (minute: number, weekday = 3, source: "real" | "synthetic" = "real") =>
  ({ weekday, lastFareMinute: minute, source }) satisfies ServiceDayEnd;

/** n days on one weekday, all ending at roughly the same minute. */
const dense = (n: number, minute: number, weekday = 3): ServiceDayEnd[] =>
  Array.from({ length: n }, (_, i) => at(minute + (i % 3) - 1, weekday));

describe("percentile", () => {
  test("a single observation is its own percentile", () => {
    expect(percentile([1240], 0.5)).toBe(1240);
    expect(percentile([1240], 0.9)).toBe(1240);
  });

  test("interpolates between neighbours the way percentile_cont does", () => {
    expect(percentile([0, 10], 0.5)).toBe(5);
    expect(percentile([0, 10, 20, 30], 0.5)).toBe(15);
    expect(percentile([0, 10, 20, 30], 0.1)).toBeCloseTo(3, 6);
  });

  test("an empty sample throws rather than inventing a number", () => {
    expect(() => percentile([], 0.5)).toThrow();
  });
});

describe("estimateLastKombi", () => {
  test("sparse history refuses to answer", () => {
    const days = dense(LAST_KOMBI_MIN_DAYS - 1, 1240);
    expect(estimateLastKombi(days, 3)).toBeNull();
  });

  test("one evening is never an answer", () => {
    expect(estimateLastKombi([at(1240)], 3)).toBeNull();
  });

  test("dense history on one weekday answers for that weekday", () => {
    const e = estimateLastKombi(dense(12, 1240), 3);
    expect(e?.scope).toBe("weekday");
    expect(e?.observedDays).toBe(12);
    expect(e?.usualMinute).toBe(1240);
  });

  test("a weekday with too few of its own evenings borrows the whole week", () => {
    const days = [
      ...dense(LAST_KOMBI_MIN_WEEKDAY_DAYS - 1, 1240, 5), // Friday, too few
      ...dense(8, 1180, 3), // Wednesdays
    ];
    const e = estimateLastKombi(days, 5);
    expect(e?.scope).toBe("pooled");
    expect(e?.observedDays).toBe(days.length);
  });

  test("Friday nights are allowed to outlast Tuesday nights", () => {
    const days = [...dense(6, 1320, 5), ...dense(6, 1180, 2)];
    expect(estimateLastKombi(days, 5)?.usualMinute).toBe(1320);
    expect(estimateLastKombi(days, 2)?.usualMinute).toBe(1180);
  });

  test("the spread reports how much the evenings actually move", () => {
    const steady = estimateLastKombi(dense(10, 1240), 3);
    expect(steady!.spreadMinutes).toBeLessThan(LAST_KOMBI_WIDE_SPREAD_MINUTES);

    const scattered = estimateLastKombi(
      [1100, 1130, 1200, 1240, 1280, 1320, 1360, 1380].map((m) => at(m)),
      3,
    );
    expect(scattered!.spreadMinutes).toBeGreaterThanOrEqual(
      LAST_KOMBI_WIDE_SPREAD_MINUTES,
    );
  });

  test("real and synthetic days are counted apart so the screen can say which", () => {
    const days = [...dense(4, 1240).map((d) => ({ ...d, source: "real" as const })),
      ...dense(6, 1240).map((d) => ({ ...d, source: "synthetic" as const }))];
    const e = estimateLastKombi(days, 3);
    expect(e?.realDays).toBe(4);
    expect(e?.syntheticDays).toBe(6);
  });
});

describe("lastKombiWarning", () => {
  const days = dense(10, 1240); // usually gone by 20:40

  test("no estimate means no warning, not a cautious guess", () => {
    const w = lastKombiWarning(dense(2, 1240), 3, 1200);
    expect(w.state).toBe("unknown");
    expect(w.estimate).toBeNull();
    expect(w.minutesLeft).toBeNull();
  });

  test("hours before the last kombi the warning stays quiet", () => {
    expect(lastKombiWarning(days, 3, 720).state).toBe("early");
  });

  test("inside the lead window the rider is told, with the time they have", () => {
    const w = lastKombiWarning(days, 3, 1240 - 30);
    expect(w.state).toBe("warn");
    expect(w.minutesLeft).toBe(30);
  });

  test("the lead window edge is inclusive", () => {
    expect(lastKombiWarning(days, 3, 1240 - LAST_KOMBI_WARN_LEAD_MINUTES).state).toBe(
      "warn",
    );
    expect(
      lastKombiWarning(days, 3, 1240 - LAST_KOMBI_WARN_LEAD_MINUTES - 1).state,
    ).toBe("early");
  });

  test("at the usual minute itself it is still a warning, not a verdict", () => {
    const w = lastKombiWarning(days, 3, 1240);
    expect(w.state).toBe("warn");
    expect(w.minutesLeft).toBe(0);
  });

  test("past the usual time the state changes but the claim never hardens", () => {
    const w = lastKombiWarning(days, 3, 1300);
    expect(w.state).toBe("past");
    expect(w.minutesLeft).toBe(-60);
  });

  test("a wide spread is flagged so the copy can admit it varies", () => {
    const scattered = [1100, 1130, 1200, 1240, 1280, 1320, 1360, 1380].map((m) =>
      at(m),
    );
    expect(lastKombiWarning(scattered, 3, 1200).wide).toBe(true);
    expect(lastKombiWarning(days, 3, 1200).wide).toBe(false);
  });
});

describe("clock helpers", () => {
  test("minutes render as a Harare wall clock", () => {
    expect(formatMinuteOfDay(1240)).toBe("8:40pm");
    expect(formatMinuteOfDay(0)).toBe("12:00am");
    expect(formatMinuteOfDay(720)).toBe("12:00pm");
    expect(formatMinuteOfDay(5)).toBe("12:05am");
  });

  test("Harare is UTC+2 all year, so the local clock is arithmetic", () => {
    // 2026-07-26 is a Sunday; 18:40 UTC is 20:40 in Harare
    const { minute, weekday } = harareNow(new Date("2026-07-26T18:40:00Z"));
    expect(minute).toBe(1240);
    expect(weekday).toBe(7);
  });

  test("an evening UTC instant can roll the Harare date into Monday", () => {
    const { minute, weekday } = harareNow(new Date("2026-07-26T22:30:00Z"));
    expect(minute).toBe(30);
    expect(weekday).toBe(1);
  });
});
