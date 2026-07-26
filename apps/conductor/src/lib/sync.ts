// Reconnect: replay the offline queue to the server in order, then sync the
// failed attempt log, then refresh the code cache and clock skew.
//
// Money rules, mirrored from the server:
//   - every event carries its client id; the server receipt makes replay a
//     no-op, so removing an event only AFTER the server answered is safe
//   - any transport error stops the flush and keeps the rest queued: a fare
//     event is never dropped on an error, only on a server verdict
//   - rate_limited also stops the flush; the server wrote no receipt, so the
//     event replays after the cooldown
import type { SupabaseClient } from "@supabase/supabase-js";
import { drainOrder, type QueuedEvent } from "./offlineQueue";
import type { CachedCode, Direction } from "./offlineRedeem";
import * as store from "./offlineStore";

export interface SyncOutcome {
  clientEventId: string;
  kind: QueuedEvent["kind"];
  outcome: string;
  flagged: boolean;
}

export interface FlushSummary {
  results: SyncOutcome[];
  /** true when the flush stopped early (network error or rate limit) */
  blocked: boolean;
}

interface SyncRedeemRow {
  outcome: string;
  flagged: boolean | null;
}

interface SyncChangeRow {
  outcome: string;
}

export async function flushQueue(supabase: SupabaseClient): Promise<FlushSummary> {
  const events = drainOrder(await store.listQueue());
  const results: SyncOutcome[] = [];

  for (const ev of events) {
    if (ev.kind === "redeem") {
      const { data, error } = await supabase.rpc("sync_offline_redemption", {
        p_client_event_id: ev.clientEventId,
        p_route: ev.routeId,
        p_direction: ev.direction,
        p_code: ev.code,
        p_redeemed_at: new Date(ev.claimedAt).toISOString(),
        // V5: the kombi the shift declared when the fare was cleared, not
        // whichever one the phone is on at sync time
        p_vehicle: ev.vehicleId ?? null,
      });
      if (error) return { results, blocked: true };
      const row = (data as SyncRedeemRow[] | null)?.[0];
      if (!row || row.outcome === "rate_limited") return { results, blocked: true };
      await store.removeEvent(ev.clientEventId);
      results.push({
        clientEventId: ev.clientEventId,
        kind: ev.kind,
        outcome: row.outcome,
        flagged: row.flagged === true,
      });
    } else {
      const { data, error } = await supabase.rpc("sync_offline_change_credit", {
        p_client_event_id: ev.clientEventId,
        p_ticket: ev.ticketId,
        p_note_cents: ev.noteCents,
        p_covered_fares: ev.coveredFares,
        p_recorded_at: new Date(ev.recordedAt).toISOString(),
      });
      if (error) return { results, blocked: true };
      const row = (data as SyncChangeRow[] | null)?.[0];
      if (!row) return { results, blocked: true };
      await store.removeEvent(ev.clientEventId);
      results.push({
        clientEventId: ev.clientEventId,
        kind: ev.kind,
        outcome: row.outcome,
        flagged: row.outcome === "rejected",
      });
    }
  }

  // the audit trail: failed keypad entries made offline
  const attempts = await store.listAttempts();
  if (attempts.length > 0) {
    const { error } = await supabase.rpc("log_offline_attempts", {
      p_attempts: attempts.map((a) => ({
        client_attempt_id: a.clientAttemptId,
        route_id: a.routeId,
        direction: a.direction,
        code_entered: a.codeEntered,
        outcome: a.outcome,
        attempted_at: new Date(a.attemptedAt).toISOString(),
      })),
    });
    if (!error) {
      await store.removeAttempts(attempts.map((a) => a.clientAttemptId));
    }
  }

  return { results, blocked: false };
}

interface PullRow {
  outcome: "ok" | "route_not_assigned";
  ticket_id: string | null;
  purpose: CachedCode["purpose"];
  code_salt: string;
  code_hash: string;
  fare_cents: number;
  payment_method: CachedCode["paymentMethod"];
  kind: CachedCode["kind"];
  valid_from: string;
  valid_until: string;
  server_time: string;
}

/**
 * Download the pending codes for this route + direction and measure clock
 * skew against the server. Returns null on any failure (the old cache and
 * skew stay in place). A route the conductor is not assigned to answers
 * with a refusal marker: the local cache is cleared, nothing is kept.
 */
export async function pullCache(
  supabase: SupabaseClient,
  routeId: string,
  direction: Direction,
): Promise<{ rows: number; skewMs: number; refused?: boolean } | null> {
  const { data, error } = await supabase.rpc("pull_offline_cache", {
    p_route: routeId,
    p_direction: direction,
  });
  if (error) return null;
  const all = (data as PullRow[] | null) ?? [];
  if (all.some((r) => r.outcome === "route_not_assigned")) {
    await store.replaceCache([]);
    const skewMs = (await store.getMeta<number>("skewMs")) ?? 0;
    return { rows: 0, skewMs, refused: true };
  }
  const rows = all.filter(
    (r): r is PullRow & { ticket_id: string } => r.ticket_id !== null,
  );

  let skewMs = (await store.getMeta<number>("skewMs")) ?? 0;
  const first = rows[0];
  if (first) {
    skewMs = new Date(first.server_time).getTime() - Date.now();
    await store.setMeta("skewMs", skewMs);
  }

  await store.replaceCache(
    rows.map((r) => ({
      ticketId: r.ticket_id,
      purpose: r.purpose,
      codeSalt: r.code_salt,
      codeHash: r.code_hash,
      fareCents: r.fare_cents,
      paymentMethod: r.payment_method,
      kind: r.kind,
      validFromMs: new Date(r.valid_from).getTime(),
      validUntilMs: new Date(r.valid_until).getTime(),
      routeId,
      direction,
    })),
  );
  await store.setMeta("lastSyncAt", Date.now());
  return { rows: rows.length, skewMs };
}
