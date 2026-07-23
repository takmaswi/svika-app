// Kombi trust states: fixed rules over counts from the fare ledger, never a
// model and never a person (AI-USAGE-MAP.md). The default is unverified — a
// kombi earns nothing by existing; verified fares recorded by conductors are
// the only way up, and facts that contradict the declared capacity are the
// only way to red. "drift" means unverified against facts (the recorded
// loads do not match the declared seats); it is a pattern on a vehicle's
// ledger, never a score on a human being.

/** Redeemed fares in the window before a kombi's history counts as a record. */
export const VERIFIED_MIN_FARES = 10;
/** Distinct days with a redeemed fare before the record reads as a habit. */
export const VERIFIED_MIN_DAYS = 3;
/** Days of loads above declared seats before the contradiction is a pattern. */
export const DRIFT_MIN_DAYS = 1;

export type TrustState = "unverified" | "verified" | "drift";

/** Aggregate counts for one vehicle, straight from the kombi_board RPC. */
export interface TrustFacts {
  /** Redeemed ticket events tied to this vehicle in the last 30 days. */
  verifiedFares30d: number;
  /** Distinct days carrying at least one redeemed fare in the window. */
  fareDays30d: number;
  /** Seats the registry declares for this vehicle; null when unknown. */
  declaredCapacity: number | null;
  /** The busiest single hour's redeemed fares in the window. */
  peakHourLoad30d: number | null;
  /** Days whose busiest hour exceeded the declared seats. */
  driftDays30d: number;
}

/**
 * Rule order: drift beats verified beats unverified. A contradiction between
 * recorded loads and declared seats must surface even on a thin history, and
 * no volume of fares may bury it.
 */
export function deriveTrustState(facts: TrustFacts | null | undefined): TrustState {
  if (!facts) return "unverified";
  if (facts.declaredCapacity !== null && facts.driftDays30d >= DRIFT_MIN_DAYS) {
    return "drift";
  }
  if (
    facts.verifiedFares30d >= VERIFIED_MIN_FARES &&
    facts.fareDays30d >= VERIFIED_MIN_DAYS
  ) {
    return "verified";
  }
  return "unverified";
}
