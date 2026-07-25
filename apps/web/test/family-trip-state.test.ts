import { describe, expect, test } from "vitest";
import {
  deriveTripState,
  FALLBACK_RIDE_MIN,
  STALL_BUFFER_MIN,
} from "../src/lib/family/trip-state";

const T0 = Date.parse("2026-07-25T08:00:00Z");
const min = (n: number) => n * 60_000;

describe("guardian trip state", () => {
  test("issued reads as booked, however old", () => {
    expect(deriveTripState("issued", T0, 40, T0 + min(300))).toBe("booked");
  });

  test("redeemed inside the expected window reads as riding", () => {
    expect(deriveTripState("redeemed", T0, 40, T0 + min(40))).toBe("riding");
  });

  test("redeemed past expected plus buffer flags late, on the boundary", () => {
    const edge = T0 + min(40 + STALL_BUFFER_MIN);
    expect(deriveTripState("redeemed", T0, 40, edge)).toBe("riding");
    expect(deriveTripState("redeemed", T0, 40, edge + 1)).toBe("late");
  });

  test("a route without a typical duration uses the fallback window", () => {
    const edge = T0 + min(FALLBACK_RIDE_MIN + STALL_BUFFER_MIN);
    expect(deriveTripState("redeemed", T0, null, edge)).toBe("riding");
    expect(deriveTripState("redeemed", T0, null, edge + 1)).toBe("late");
  });

  test("the rider's arrival tap wins over everything", () => {
    expect(deriveTripState("arrived", T0, 40, T0 + min(500))).toBe("arrived");
  });

  test("expired, cancelled and refunded read as ended without a check-in", () => {
    for (const s of ["expired", "cancelled", "refunded"]) {
      expect(deriveTripState(s, T0, 40, T0 + min(10))).toBe("ended");
    }
  });
});
