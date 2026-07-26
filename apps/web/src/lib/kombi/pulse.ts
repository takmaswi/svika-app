// Rank pulse (batch V5): how full a kombi is getting at the rank, right now.
// A COUNT, not AI (AI-USAGE-MAP.md). The database returns fares cleared on a
// vehicle inside a short window (migration 0041) and the declared seats from
// the registry; this file turns that pair into one of four honest states with
// named thresholds. Nothing learns, nothing predicts, and nothing here says
// when a kombi will leave: "leaves soon" describes a nearly full vehicle,
// which is how a rank actually works, and the copy never promises a time.
//
// Counts describe a vehicle's ledger, never a person (CLAUDE.md law).

/** At this share of declared seats the kombi reads as filling, not starting. */
export const PULSE_FILLING_RATIO = 0.5;
/** At this share the kombi reads as nearly full and about to go. */
export const PULSE_ALMOST_RATIO = 0.85;

export type FillState =
  /** nothing cleared on this kombi inside the window */
  | "quiet"
  /** fares are coming in, under half the declared seats */
  | "loading"
  /** past half the declared seats */
  | "filling"
  /** at or past the almost-full threshold */
  | "almost"
  /** fares cleared, but the registry declares no seats to measure them against */
  | "unknown";

/** The pulse pair from the kombi_board RPC, plus the registry's seats. */
export interface PulseFacts {
  /** Redeemed fares stamped on this vehicle inside the window. */
  pulseFares: number;
  /** The window the database counted over, in minutes. */
  windowMinutes: number;
  /** Seats the registry declares; null when the vehicle never declared any. */
  declaredCapacity: number | null;
}

export interface RankPulse {
  state: FillState;
  /** The raw count, never clamped: see the note below. */
  fares: number;
  capacity: number | null;
  windowMinutes: number;
}

/**
 * Rule order: a silent kombi is quiet whatever its seats say; a kombi with no
 * declared seats can be counted but not measured; everything else is the
 * count against the seats.
 *
 * The count is deliberately NOT clamped to the declared seats. A vehicle that
 * clears more fares than it declared seats is a real contradiction, and hiding
 * it here would launder it. That contradiction belongs to the trust rail
 * (drift, see trust.ts), which surfaces it as a pattern on the ledger.
 */
export function derivePulse(facts: PulseFacts | null | undefined): RankPulse | null {
  if (!facts) return null;
  const fares = Math.max(0, Math.trunc(facts.pulseFares));
  const capacity =
    facts.declaredCapacity !== null && facts.declaredCapacity > 0
      ? facts.declaredCapacity
      : null;
  const windowMinutes = facts.windowMinutes;

  if (fares === 0) return { state: "quiet", fares, capacity, windowMinutes };
  if (capacity === null) return { state: "unknown", fares, capacity, windowMinutes };

  const ratio = fares / capacity;
  const state: FillState =
    ratio >= PULSE_ALMOST_RATIO
      ? "almost"
      : ratio >= PULSE_FILLING_RATIO
        ? "filling"
        : "loading";
  return { state, fares, capacity, windowMinutes };
}
