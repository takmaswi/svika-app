// Partner recorded trips, shaped as the ingest already understands.
//
// Batch Partner replaced the standalone field logger with the in app
// recorder, so the ride data pipeline no longer receives files: it reads
// rows. This module is the adapter, and it is deliberately thin. A partner
// trip becomes exactly the same ParsedBundle a gps-logger export produced,
// which means buildIngestPlan, the 60 m stop snap and the segment
// derivation are untouched, and a partner ride and a 2026-07-07 corridor
// ride are treated identically by everything downstream.
//
// Two rules the shape enforces:
//
//   * `waiting` is not a mode the pipeline has. public.gps_pings allows
//     walking and riding only (migration 0019), and a wait is standing
//     still, so it lands as walking. Only riding pings ever reach the
//     segment derivation, so this changes nothing it touches.
//   * a point whose leg has no row falls back to walking rather than
//     inheriting a neighbour's mode. Guessing a ping was on a kombi is how
//     a walk becomes a fake segment time.
//
// Nothing here decides consent. The caller selects only journeys carrying a
// partner_consent_version, which the server doors set and only a live
// accepted partner consent can produce (migration 0047).

import type { ParsedBundle, BundlePing } from "./bundle.ts";

export interface PartnerJourneyRow {
  id: string;
  name: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface PartnerLegRow {
  leg_index: number;
  mode: "walking" | "waiting" | "riding";
}

export interface PartnerPointRow {
  seq: number;
  leg_index: number;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  recorded_at: string;
}

/** Prefixed so a partner trip can never collide with a bundle's source_ref. */
export function partnerSourceRef(journeyId: string): string {
  return `partner:${journeyId}`;
}

/** The pipeline knows two modes; a wait is time spent standing still. */
function pipelineMode(mode: PartnerLegRow["mode"] | undefined): string {
  return mode === "riding" ? "riding" : "walking";
}

export function toParsedBundle(
  journey: PartnerJourneyRow,
  legs: readonly PartnerLegRow[],
  points: readonly PartnerPointRow[],
): ParsedBundle {
  const modeByLeg = new Map(legs.map((l) => [l.leg_index, l.mode]));
  const pings: BundlePing[] = [...points]
    .sort((a, b) => a.seq - b.seq)
    .map((p) => ({
      seq: p.seq,
      legIndex: p.leg_index,
      mode: pipelineMode(modeByLeg.get(p.leg_index)),
      recordedAtIso: p.recorded_at,
      recordedAtMs: Date.parse(p.recorded_at),
      lat: p.lat,
      lng: p.lng,
      accuracyM: p.accuracy_m,
      // the in app recorder does not keep these three; the pipeline columns
      // are nullable and nothing derived reads them
      speedMps: null,
      headingDeg: null,
      altitudeM: null,
    }));

  return {
    journey: {
      sourceRef: partnerSourceRef(journey.id),
      label: journey.name ?? "",
      startedAtMs: Date.parse(journey.started_at),
      endedAtMs: journey.ended_at === null ? null : Date.parse(journey.ended_at),
    },
    pings,
  };
}

/**
 * Whether a partner trip is worth handing to the plan builder at all. A
 * trip with no riding leg is a walk, and a trip with one riding ping cannot
 * have a direction inferred from it; both are skipped by name rather than
 * thrown at inferDirection to fail.
 */
export function ingestableReason(bundle: ParsedBundle): string | null {
  const riding = bundle.pings.filter((p) => p.mode === "riding");
  if (riding.length === 0) return "no riding leg";
  if (riding.length < 2) return "fewer than two riding points";
  if (!Number.isFinite(bundle.journey.startedAtMs)) return "unreadable start time";
  return null;
}
