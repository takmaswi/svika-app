// One hook owns the offline life of the hwindi surface: connectivity state,
// the cache pull for the picked route, local redemption with no network, the
// queued change credit, and the flush on reconnect. App.tsx stays a surface.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { sha256Hex } from "../lib/hash";
import {
  decideLocalRedeem,
  correctedNow,
  type Direction,
  type LocalDecision,
} from "../lib/offlineRedeem";
import * as store from "../lib/offlineStore";
import { flushQueue, pullCache, type FlushSummary } from "../lib/sync";

export interface LocalRedeemResult {
  outcome: "success" | "already_redeemed" | "invalid_code" | "rate_limited";
  ticketId?: string;
  fareCents?: number;
  paymentMethod?: "wallet" | "cash";
  stage?: string;
}

/** A supabase error that means "no network", not "the server said no". */
export function isNetworkError(err: { message?: string } | null): boolean {
  return Boolean(err?.message && /fetch|network|load failed/i.test(err.message));
}

export function useOfflineBoarding(
  routeId: string | null,
  direction: Direction,
  vehicleId: string | null = null,
) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [queued, setQueued] = useState(0);
  const [lastFlush, setLastFlush] = useState<FlushSummary | null>(null);
  const syncing = useRef(false);

  const refreshQueued = useCallback(async () => {
    setQueued((await store.listQueue()).length);
  }, []);

  const syncNow = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    syncing.current = true;
    try {
      const summary = await flushQueue(supabase);
      if (summary.results.length > 0 || summary.blocked) setLastFlush(summary);
      if (routeId) await pullCache(supabase, routeId, direction);
      await refreshQueued();
    } finally {
      syncing.current = false;
    }
  }, [routeId, direction, refreshQueued]);

  // connectivity listeners; regained signal starts a flush
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [syncNow]);

  // picking a route (or switching direction) refreshes the local cache
  useEffect(() => {
    void refreshQueued();
    if (routeId && navigator.onLine) void syncNow();
  }, [routeId, direction, syncNow, refreshQueued]);

  /** Redeem against the local cache; queue the event for sync. */
  const localRedeem = useCallback(
    async (code: string): Promise<LocalRedeemResult> => {
      if (!routeId) return { outcome: "invalid_code" };
      const skewMs = (await store.getMeta<number>("skewMs")) ?? 0;
      const at = correctedNow(Date.now(), skewMs);
      const cache = (await store.getCache()).filter(
        (r) => r.routeId === routeId && r.direction === direction,
      );
      const attempts = await store.listAttempts();
      const d: LocalDecision = await decideLocalRedeem({
        cache,
        attempts,
        code,
        nowMs: Date.now(),
        skewMs,
        hash: sha256Hex,
      });

      if (d.outcome === "success") {
        await store.markConsumed(d.row, at);
        await store.putEvent({
          kind: "redeem",
          clientEventId: crypto.randomUUID(),
          seq: await store.nextSeq(),
          routeId,
          direction,
          vehicleId,
          code,
          ticketId: d.row.ticketId,
          fareCents: d.row.fareCents,
          paymentMethod: d.row.paymentMethod,
          stage: d.stage,
          claimedAt: at,
        });
        await refreshQueued();
        return {
          outcome: "success",
          ticketId: d.row.ticketId,
          fareCents: d.row.fareCents,
          paymentMethod: d.row.paymentMethod,
          stage: d.stage,
        };
      }

      if (d.outcome !== "rate_limited") {
        await store.addAttempt({
          clientAttemptId: crypto.randomUUID(),
          routeId,
          direction,
          codeEntered: code,
          outcome: d.outcome,
          attemptedAt: at,
        });
      }
      return { outcome: d.outcome };
    },
    [routeId, direction, vehicleId, refreshQueued],
  );

  /** Record change to credit offline; settles through the ledger on sync. */
  const queueChange = useCallback(
    async (ticketId: string, noteCents: number, coveredFares: number, fareCents: number) => {
      const change = noteCents - fareCents * coveredFares;
      if (change <= 0) return null;
      const skewMs = (await store.getMeta<number>("skewMs")) ?? 0;
      await store.putEvent({
        kind: "change_credit",
        clientEventId: crypto.randomUUID(),
        seq: await store.nextSeq(),
        ticketId,
        noteCents,
        coveredFares,
        recordedAt: correctedNow(Date.now(), skewMs),
      });
      await refreshQueued();
      return change;
    },
    [refreshQueued],
  );

  return { online, queued, lastFlush, syncNow, localRedeem, queueChange };
}
