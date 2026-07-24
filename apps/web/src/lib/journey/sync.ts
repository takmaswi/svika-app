// Sync a locally recorded journey to the server, offline first: everything
// already sits in IndexedDB, upload is a replay that can stop and resume at
// any point. First sync wins at the server (0033: on conflict do nothing);
// when a replayed batch lands fewer rows than it carried the journey is
// flagged conflicted, never silently trusted. No consent, no upload: the
// server refuses the journey row itself, and the caller keeps the trace
// local when it hears that.
import type { SupabaseClient } from "@supabase/supabase-js";
import { planBatches, toRpcPoint } from "./policy";
import { getJourney, listPoints, putJourney } from "./store";

export type SyncOutcome =
  | { ok: true }
  | { ok: false; reason: "consent" | "unreachable" }
  | { ok: false; reason: "gone" };

const isConsentRefusal = (message: string | undefined) =>
  (message ?? "").includes("journey consent missing");

export async function syncJourney(
  supabase: SupabaseClient,
  journeyId: string,
): Promise<SyncOutcome> {
  let journey = await getJourney(journeyId);
  if (!journey) return { ok: false, reason: "gone" };

  // a discarded recording that never reached the server just stays gone
  if (journey.status === "discarded" && !journey.serverKnown) return { ok: true };

  if (!journey.serverKnown) {
    const { error } = await supabase.rpc("upsert_rider_journey", {
      p_journey: journey.id,
      p_mode: journey.mode,
      p_started_at: new Date(journey.startedAt).toISOString(),
    });
    if (error) {
      return {
        ok: false,
        reason: isConsentRefusal(error.message) ? "consent" : "unreachable",
      };
    }
    journey = { ...journey, serverKnown: true };
    await putJourney(journey);
  }

  if (journey.status !== "discarded") {
    const points = await listPoints(journey.id);
    for (const batch of planBatches(points, journey.syncedThrough)) {
      const appended: { data: unknown; error: { message: string } | null } =
        await supabase.rpc("append_rider_journey_points", {
          p_journey: journey.id,
          p_points: batch.map(toRpcPoint),
        });
      if (appended.error) return { ok: false, reason: "unreachable" };
      const inserted = typeof appended.data === "number" ? appended.data : 0;
      journey = {
        ...journey,
        syncedThrough: batch[batch.length - 1]!.seq,
        conflict: journey.conflict || inserted < batch.length,
      };
      await putJourney(journey);
    }
  }

  if (!journey.statusSynced && journey.status === "complete") {
    const { error } = await supabase.rpc("complete_rider_journey", {
      p_journey: journey.id,
      p_name: journey.name ?? "",
      p_mode: journey.mode,
      p_ended_at: new Date(journey.endedAt ?? Date.now()).toISOString(),
      p_distance_m: Math.round(journey.distanceM),
    });
    if (error) return { ok: false, reason: "unreachable" };
    journey = { ...journey, statusSynced: true };
    await putJourney(journey);
  }

  if (!journey.statusSynced && journey.status === "discarded") {
    const { error } = await supabase.rpc("discard_rider_journey", {
      p_journey: journey.id,
    });
    if (error) return { ok: false, reason: "unreachable" };
    journey = { ...journey, statusSynced: true };
    await putJourney(journey);
  }

  return { ok: true };
}
