// Live fare board (batch V4): what riders on this route actually paid today.
//
// NOT AI (AI-USAGE-MAP.md). The database does a group by
// (public.fares_paid_today, migration 0045) and every rule that turns those
// buckets into a line a rider reads lives here, in plain code, unit tested.
//
// History, not editorial. This file computes what was paid; it never says
// whether that was fair, never compares a route to another, and never
// predicts the next hour. A rider looking at a fare board should be able to
// tell exactly what they are being shown and over what.

/** One bucket from the RPC: tickets bought at one fare in one local hour. */
export interface FareBucket {
  /** Local hour of day, 0..23 (Africa/Harare). */
  hour: number;
  fareCents: number;
  tickets: number;
}

export interface FareHour {
  hour: number;
  tickets: number;
  /** The fare most riders paid in that hour. */
  typicalCents: number;
}

export interface FareBoard {
  /** Tickets counted across the whole day so far. */
  tickets: number;
  /** The fare the most riders paid today. */
  typicalCents: number;
  lowCents: number;
  highCents: number;
  /** True when riders did not all pay the same thing today. */
  varied: boolean;
  /** Every hour that carried at least one fare, in order. */
  hours: FareHour[];
  /** The busiest hour of the day so far, or null on an empty board. */
  busiestHour: number | null;
}

/**
 * The fare most riders paid in a set of buckets. Ties go to the LOWER fare
 * deliberately: when the evidence is split, the board should not be the thing
 * that nudges the going rate upwards.
 */
function mostPaid(buckets: readonly FareBucket[]): number {
  let best = buckets[0]!;
  for (const b of buckets) {
    if (b.tickets > best.tickets) best = b;
    else if (b.tickets === best.tickets && b.fareCents < best.fareCents) best = b;
  }
  return best.fareCents;
}

/**
 * Summarise a day's buckets. Returns null for an empty day rather than a
 * board full of zeroes: a route nobody has paid for today has nothing to say,
 * and saying nothing is the honest version of that.
 */
export function summariseFareBoard(
  buckets: readonly FareBucket[],
): FareBoard | null {
  const real = buckets.filter((b) => b.tickets > 0 && b.fareCents > 0);
  if (real.length === 0) return null;

  const byHour = new Map<number, FareBucket[]>();
  for (const b of real) {
    const list = byHour.get(b.hour) ?? [];
    list.push(b);
    byHour.set(b.hour, list);
  }

  const hours: FareHour[] = [...byHour.entries()]
    .map(([hour, list]) => ({
      hour,
      tickets: list.reduce((sum, b) => sum + b.tickets, 0),
      typicalCents: mostPaid(list),
    }))
    .sort((a, b) => a.hour - b.hour);

  const tickets = real.reduce((sum, b) => sum + b.tickets, 0);
  const fares = real.map((b) => b.fareCents);
  const busiest = hours.reduce((best, h) => (h.tickets > best.tickets ? h : best), hours[0]!);

  return {
    tickets,
    typicalCents: mostPaid(real),
    lowCents: Math.min(...fares),
    highCents: Math.max(...fares),
    varied: Math.min(...fares) !== Math.max(...fares),
    hours,
    busiestHour: busiest.hour,
  };
}
