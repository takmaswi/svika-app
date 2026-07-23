import { describe, expect, test } from "vitest";
import {
  deriveTrustState,
  DRIFT_MIN_DAYS,
  VERIFIED_MIN_DAYS,
  VERIFIED_MIN_FARES,
  type TrustFacts,
} from "../src/lib/kombi/trust";

// The trust surface is rules and counts, never a model and never a person.
// These tests pin the three states and, above all, the default: a kombi with
// no verified fare history is unverified, full stop.

const quiet: TrustFacts = {
  verifiedFares30d: 0,
  fareDays30d: 0,
  declaredCapacity: 16,
  peakHourLoad30d: null,
  driftDays30d: 0,
};

const busy: TrustFacts = {
  verifiedFares30d: VERIFIED_MIN_FARES,
  fareDays30d: VERIFIED_MIN_DAYS,
  declaredCapacity: 16,
  peakHourLoad30d: 12,
  driftDays30d: 0,
};

describe("deriveTrustState", () => {
  test("no facts at all is unverified: the default needs no data", () => {
    expect(deriveTrustState(null)).toBe("unverified");
    expect(deriveTrustState(undefined)).toBe("unverified");
  });

  test("a registry row with zero fare history is unverified", () => {
    expect(deriveTrustState(quiet)).toBe("unverified");
  });

  test("history below the fare threshold stays unverified", () => {
    expect(
      deriveTrustState({ ...busy, verifiedFares30d: VERIFIED_MIN_FARES - 1 }),
    ).toBe("unverified");
  });

  test("history on too few distinct days stays unverified", () => {
    expect(deriveTrustState({ ...busy, fareDays30d: VERIFIED_MIN_DAYS - 1 })).toBe(
      "unverified",
    );
  });

  test("enough fares across enough days with no drift is verified", () => {
    expect(deriveTrustState(busy)).toBe("verified");
  });

  test("capacity drift days flip the state to drift", () => {
    expect(deriveTrustState({ ...busy, driftDays30d: DRIFT_MIN_DAYS })).toBe("drift");
  });

  test("drift outranks verified: facts contradicting the declaration win", () => {
    expect(
      deriveTrustState({
        ...busy,
        verifiedFares30d: VERIFIED_MIN_FARES * 10,
        fareDays30d: 30,
        driftDays30d: DRIFT_MIN_DAYS,
      }),
    ).toBe("drift");
  });

  test("drift needs a declared capacity to contradict", () => {
    expect(
      deriveTrustState({
        ...busy,
        declaredCapacity: null,
        driftDays30d: DRIFT_MIN_DAYS,
      }),
    ).toBe("verified");
  });

  test("drift on thin history still shows as drift, not verified", () => {
    expect(
      deriveTrustState({ ...quiet, verifiedFares30d: 2, fareDays30d: 1, driftDays30d: 1 }),
    ).toBe("drift");
  });
});
