import { describe, expect, test } from "vitest";
import { dayPart, harareHour, QUICK_PLACES } from "../src/lib/door/greeting";
import { loadPlaces, resolvePlaceQuery } from "../src/lib/geocode/search";

describe("front door greeting", () => {
  test("reads the hour in Harare (UTC+2), not the server's zone", () => {
    expect(harareHour(new Date("2026-11-13T05:30:00Z"))).toBe(7);
    expect(harareHour(new Date("2026-11-13T22:30:00Z"))).toBe(0);
  });
  test("morning, afternoon, evening", () => {
    expect(dayPart(7)).toBe("morning");
    expect(dayPart(12)).toBe("afternoon");
    expect(dayPart(16)).toBe("afternoon");
    expect(dayPart(17)).toBe("evening");
    expect(dayPart(2)).toBe("evening");
  });
});

test("every quick place resolves exactly in the committed index, so a chip never misses", () => {
  for (const name of QUICK_PLACES) {
    expect(resolvePlaceQuery(loadPlaces(), name).match?.name).toBe(name);
  }
});
