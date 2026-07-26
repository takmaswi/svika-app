// Sync a locally recorded journey to the server, offline first: everything
// already sits in IndexedDB, upload is a replay that can stop and resume at
// any point. First sync wins at the server (0033: on conflict do nothing);
// when a replayed batch lands fewer rows than it carried the journey is
// flagged conflicted, never silently trusted. No consent, no upload: the
// server refuses the journey row itself, and the caller keeps the trace
// local when it hears that.
//
// Partner contributions (batch Partner) ride the same replay with a second
// wall in front of them. Legs, marked stops and fare notes go up only when
// the rider holds a live partner consent, and the two doors refuse them
// outright otherwise (migration 0047), so a rider who never opted in has
// them nowhere but their own phone. That refusal is not an error the rider
// needs to see: the trip itself still syncs, only the partner layer stays
// behind.
import type { SupabaseClient } from "@supabase/supabase-js";
import { toRpcLeg } from "./legs";
import { planBatches, toRpcPoint } from "./policy";
import {
  getJourney,
  listLegs,
  listMarks,
  listPoints,
  putJourney,
} from "./store";

export type SyncOutcome =
  | { ok: true }
  | { ok: false; reason: "consent" | "unreachable" }
  | { ok: false; reason: "gone" };

const isConsentRefusal = (message: string | undefined) =>
  (message ?? "").includes("journey consent missing");

const isPartnerRefusal = (message: string | undefined) =>
  (message ?? "").includes("partner consent missing");

/** Not a partner is the default, not a failure; the three read apart. */
export type PartnerOutcome = "contributed" | "not_partner" | "unreachable";

/**
 * Push the partner layer of a recording: the leg chain first (it settles as
 * a set, because the leg you are on has no end until you leave it), then
 * each marked stop (idempotent on its seq, so a replay after a dropped
 * connection adds nothing).
 *
 * Both doors need the journey still recording, so this runs before the
 * complete call, never after.
 */
async function syncPartnerLayer(
  supabase: SupabaseClient,
  journeyId: string,
): Promise<PartnerOutcome> {
  const legs = await listLegs(journeyId);
  const marks = await listMarks(journeyId);
  if (legs.length === 0 && marks.length === 0) return "not_partner";

  if (legs.length > 0) {
    const { error } = await supabase.rpc("save_rider_journey_legs", {
      p_journey: journeyId,
      p_legs: legs.map(toRpcLeg),
    });
    if (error) {
      return isPartnerRefusal(error.message) ? "not_partner" : "unreachable";
    }
  }
  for (const mark of marks) {
    const { error } = await supabase.rpc("add_rider_journey_mark", {
      p_journey: journeyId,
      p_mark_seq: mark.markSeq,
      p_leg_index: mark.legIndex,
      p_kind: mark.kind,
      p_name: mark.name,
      p_lat: mark.lat,
      p_lng: mark.lng,
      p_accuracy_m: mark.accuracyM,
      p_recorded_at: new Date(mark.recordedAt).toISOString(),
      p_marked_at: new Date(mark.markedAt).toISOString(),
    });
    if (error) {
      return isPartnerRefusal(error.message) ? "not_partner" : "unreachable";
    }
  }
  return "contributed";
}

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

  // The partner layer settles while the journey is still recording, because
  // both its doors refuse a saved trip (0047, the 0033 posture).
  //
  // It is only marked done once the trip itself is done. A recording syncs
  // every twenty seconds, and a leg or a marked stop can arrive after any
  // one of those passes; latching on the first success would strand
  // everything the rider tagged afterwards. Re pushing is free: the leg set
  // settles and a mark is idempotent on its seq.
  if (journey.status !== "discarded" && !journey.partnerSynced) {
    const outcome = await syncPartnerLayer(supabase, journey.id);
    if (outcome === "unreachable") return { ok: false, reason: "unreachable" };
    if (outcome === "contributed" && journey.status === "complete") {
      journey = { ...journey, partnerSynced: true };
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
