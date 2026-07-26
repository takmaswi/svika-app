// Legs: the shape of a trip, kept pure so it is testable without a phone.
//
// A journey is a chain of legs and a leg is a maximal run of one mode:
// walk to the road, wait for a kombi, ride it, walk to the next rank, ride
// again, walk to the door. The recorder never declares how many legs there
// will be; boarding opens a riding leg with its own route, direction and
// fare note, getting off closes it and opens a walking one, and that can
// happen any number of times.
//
// This is the field logger's one genuinely good idea (tools/gps-logger,
// now superseded), rebuilt without its bugs: no IDs minted here, no clock
// read here, no I/O here. Callers pass the timestamp in, so every
// transition is deterministic.

import type { LocalJourneyMode } from "./store";

export type LegMode = "walking" | "waiting" | "riding";
export type LegDirection = "outbound" | "inbound";

export interface LocalLeg {
  journeyId: string;
  legIndex: number;
  mode: LegMode;
  /** Riding legs only: free text, the way a person says the route. */
  routeName: string | null;
  direction: LegDirection | null;
  /** Riding legs only: what the rider actually paid, in cents. */
  fareCents: number | null;
  /** Epoch ms. */
  startedAt: number;
  endedAt: number | null;
}

export interface BoardDetails {
  routeName: string;
  direction: LegDirection;
  fareCents: number | null;
}

/** The walking leg every recording opens with. */
export function openingLeg(journeyId: string, at: number): LocalLeg {
  return {
    journeyId,
    legIndex: 0,
    mode: "walking",
    routeName: null,
    direction: null,
    fareCents: null,
    startedAt: at,
    endedAt: null,
  };
}

/**
 * Close the open leg and open the next one in `mode`. Route, direction and
 * fare are kept for riding legs and dropped everywhere else, so a walking
 * leg can never carry a route it did not have (the database says the same
 * thing in a check constraint).
 *
 * Returns a new array; the input is never mutated.
 */
export function transitionLegs(
  legs: readonly LocalLeg[],
  at: number,
  mode: LegMode,
  details?: BoardDetails,
): LocalLeg[] {
  const open = legs[legs.length - 1];
  if (!open) return legs.map((l) => ({ ...l }));
  const riding = mode === "riding";
  const next: LocalLeg = {
    journeyId: open.journeyId,
    legIndex: open.legIndex + 1,
    mode,
    routeName: riding ? (details?.routeName.trim() || null) : null,
    direction: riding ? (details?.direction ?? null) : null,
    fareCents: riding ? (details?.fareCents ?? null) : null,
    // a leg that opens before the one it follows would produce a negative
    // duration; clamp rather than store a lie
    startedAt: Math.max(at, open.startedAt),
    endedAt: null,
  };
  return [
    ...legs.slice(0, -1),
    { ...open, endedAt: Math.max(at, open.startedAt) },
    next,
  ];
}

/** Close the open leg without opening another: the recording stopped. */
export function closeLegs(legs: readonly LocalLeg[], at: number): LocalLeg[] {
  const open = legs[legs.length - 1];
  if (!open) return [];
  if (open.endedAt !== null) return legs.map((l) => ({ ...l }));
  return [
    ...legs.slice(0, -1),
    { ...open, endedAt: Math.max(at, open.startedAt) },
  ];
}

/** The leg a point captured now belongs to. */
export function currentLegIndex(legs: readonly LocalLeg[]): number {
  return legs[legs.length - 1]?.legIndex ?? 0;
}

export function currentLegMode(legs: readonly LocalLeg[]): LegMode {
  return legs[legs.length - 1]?.mode ?? "walking";
}

/**
 * What the trip turned out to be, read off the legs the rider tagged.
 * No riding leg is a walk; one kombi is a kombi trip; two or more is a
 * transfer, which is exactly what `mixed` means to the network. A rider who
 * tagged nothing keeps the mode they picked before starting: deriving from
 * a single untagged leg would only overwrite their answer with a guess.
 */
export function journeyModeFor(
  legs: readonly LocalLeg[],
  picked: LocalJourneyMode,
): LocalJourneyMode {
  if (legs.length < 2) return picked;
  const rides = legs.filter((l) => l.mode === "riding").length;
  if (rides === 0) return "walk";
  return rides === 1 ? "kombi" : "mixed";
}

/** The RPC payload row for one leg (migration 0047 save_rider_journey_legs). */
export function toRpcLeg(leg: LocalLeg): {
  leg_index: number;
  mode: LegMode;
  route_name: string | null;
  direction: LegDirection | null;
  fare_cents: number | null;
  started_at: string;
  ended_at: string | null;
} {
  return {
    leg_index: leg.legIndex,
    mode: leg.mode,
    route_name: leg.routeName,
    direction: leg.direction,
    fare_cents: leg.fareCents,
    started_at: new Date(leg.startedAt).toISOString(),
    ended_at: leg.endedAt === null ? null : new Date(leg.endedAt).toISOString(),
  };
}

/**
 * Cents from what a person types into a fare field. Accepts "1.50", "1,50",
 * "150c" and "$1.50"; refuses anything that is not a plain amount rather
 * than guessing. Null means "did not say", which is a legitimate answer.
 */
export function parseFareCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isFinite(cents) || cents < 0 || cents > 100_000) return null;
  return cents;
}
