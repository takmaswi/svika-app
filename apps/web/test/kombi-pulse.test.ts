import { describe, expect, test } from "vitest";
import {
  derivePulse,
  PULSE_ALMOST_RATIO,
  PULSE_FILLING_RATIO,
  type PulseFacts,
} from "../src/lib/kombi/pulse";

// Rank pulse is a count against declared seats, nothing more. These tests pin
// the four states, the silent default, and the one rule that matters most for
// honesty: a count above the declared seats is never quietly clamped away.

const seats16: PulseFacts = {
  pulseFares: 0,
  windowMinutes: 20,
  declaredCapacity: 16,
};

describe("derivePulse", () => {
  test("no facts at all is no pulse: the card shows nothing rather than a guess", () => {
    expect(derivePulse(null)).toBeNull();
    expect(derivePulse(undefined)).toBeNull();
  });

  test("nothing cleared in the window is quiet", () => {
    expect(derivePulse(seats16)?.state).toBe("quiet");
  });

  test("a silent kombi with no declared seats is still quiet", () => {
    expect(derivePulse({ ...seats16, declaredCapacity: null })?.state).toBe("quiet");
  });

  test("fares under half the declared seats read as loading", () => {
    expect(derivePulse({ ...seats16, pulseFares: 1 })?.state).toBe("loading");
    expect(derivePulse({ ...seats16, pulseFares: 7 })?.state).toBe("loading");
  });

  test("the filling threshold is inclusive at half the seats", () => {
    const atThreshold = Math.ceil(16 * PULSE_FILLING_RATIO);
    expect(derivePulse({ ...seats16, pulseFares: atThreshold })?.state).toBe("filling");
    expect(derivePulse({ ...seats16, pulseFares: atThreshold - 1 })?.state).toBe(
      "loading",
    );
  });

  test("the almost threshold is inclusive and outranks filling", () => {
    const atThreshold = Math.ceil(16 * PULSE_ALMOST_RATIO);
    expect(derivePulse({ ...seats16, pulseFares: atThreshold })?.state).toBe("almost");
    expect(derivePulse({ ...seats16, pulseFares: atThreshold - 1 })?.state).toBe(
      "filling",
    );
  });

  test("every seat cleared is almost, not a new state", () => {
    expect(derivePulse({ ...seats16, pulseFares: 16 })?.state).toBe("almost");
  });

  test("more fares than declared seats is reported raw, never clamped", () => {
    const pulse = derivePulse({ ...seats16, pulseFares: 21 });
    expect(pulse?.state).toBe("almost");
    // the contradiction belongs to the trust rail; hiding it here would
    // launder a real signal into a tidy number
    expect(pulse?.fares).toBe(21);
    expect(pulse?.capacity).toBe(16);
  });

  test("fares with no declared seats can be counted but not measured", () => {
    const pulse = derivePulse({ ...seats16, pulseFares: 9, declaredCapacity: null });
    expect(pulse?.state).toBe("unknown");
    expect(pulse?.fares).toBe(9);
    expect(pulse?.capacity).toBeNull();
  });

  test("a declared capacity of zero cannot be measured against either", () => {
    expect(derivePulse({ ...seats16, pulseFares: 3, declaredCapacity: 0 })?.state).toBe(
      "unknown",
    );
  });

  test("the window travels with the pulse so the copy never invents one", () => {
    expect(derivePulse({ ...seats16, pulseFares: 4, windowMinutes: 20 })?.windowMinutes)
      .toBe(20);
  });

  test("a negative or fractional count is trimmed to a whole floor of zero", () => {
    expect(derivePulse({ ...seats16, pulseFares: -3 })?.state).toBe("quiet");
    expect(derivePulse({ ...seats16, pulseFares: 4.9 })?.fares).toBe(4);
  });
});
