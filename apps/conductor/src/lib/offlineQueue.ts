// The offline event queue: everything a conductor did with no signal, in the
// order it happened, waiting to replay to the server. Pure logic; storage
// lives in offlineStore. Every event carries a client generated id, the
// server's idempotency key, so a queue that drops mid-flush and replays can
// never double-settle.
import type { Direction } from "./offlineRedeem";

export interface QueuedRedeem {
  kind: "redeem";
  clientEventId: string;
  /** insertion order; the flush replays strictly in this order */
  seq: number;
  routeId: string;
  direction: Direction;
  /** V5: the kombi the shift declared; null when the hwindi skipped it. */
  vehicleId?: string | null;
  code: string;
  ticketId: string;
  fareCents: number;
  paymentMethod: "wallet" | "cash";
  stage: "redeemed" | "loaded" | "collected";
  /** corrected epoch ms the conductor cleared it */
  claimedAt: number;
}

export interface QueuedChangeCredit {
  kind: "change_credit";
  clientEventId: string;
  seq: number;
  ticketId: string;
  noteCents: number;
  coveredFares: number;
  /** corrected epoch ms the conductor recorded it */
  recordedAt: number;
}

export type QueuedEvent = QueuedRedeem | QueuedChangeCredit;

/**
 * Add an event unless it is already queued: same client id, or (for a
 * redeem) the same code on the same route + direction. The consumed marker
 * in the cache already blocks a double clear; this is the belt to that
 * braces.
 */
export function enqueue(
  queue: readonly QueuedEvent[],
  item: QueuedEvent,
): QueuedEvent[] {
  const duplicate = queue.some(
    (q) =>
      q.clientEventId === item.clientEventId ||
      (q.kind === "redeem" &&
        item.kind === "redeem" &&
        q.code === item.code &&
        q.routeId === item.routeId &&
        q.direction === item.direction),
  );
  if (duplicate) return [...queue];
  return [...queue, item];
}

/** Strict insertion order: a ticket's redeem always replays before its change. */
export function drainOrder(queue: readonly QueuedEvent[]): QueuedEvent[] {
  return [...queue].sort((a, b) => a.seq - b.seq);
}
