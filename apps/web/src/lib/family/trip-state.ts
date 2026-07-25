// Guardian mode's reading of a child's trip (batch V3). Plain rules over
// the 0036 RPC row, computed at render: no model, no vendor, and the copy
// these states select flags situations, never people (product law).

export type GuardianTripState =
  | "booked" // issued: paid, not boarded yet
  | "riding" // redeemed, inside the expected window
  | "late" // redeemed and past expected + buffer: flag the situation
  | "arrived" // the rider's own safe arrival tap
  | "ended"; // the ticket ended without an arrival check-in

/** Grace past the route's typical duration before a trip reads as late. */
export const STALL_BUFFER_MIN = 15;
/** When a route has no typical duration recorded. */
export const FALLBACK_RIDE_MIN = 60;

export function deriveTripState(
  status: string,
  statusAtMs: number,
  expectedMinutes: number | null,
  nowMs: number,
): GuardianTripState {
  if (status === "arrived") return "arrived";
  if (status === "issued") return "booked";
  if (status === "redeemed") {
    const windowMs =
      ((expectedMinutes ?? FALLBACK_RIDE_MIN) + STALL_BUFFER_MIN) * 60_000;
    return nowMs > statusAtMs + windowMs ? "late" : "riding";
  }
  return "ended";
}
