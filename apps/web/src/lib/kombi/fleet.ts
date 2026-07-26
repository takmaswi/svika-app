// The bridge between the simulated map fleet and the vehicle registry. The
// four moving markers are a simulation (declared in the disclosure
// register); the registry rows are seeded staging (packages/db/seed) until
// fieldwork brings real plates. The mapping is deterministic so a marker
// always opens the same card. A sim id with no registry row simply has no
// facts, and no facts means unverified: the default never needs data.
import { derivePulse, type RankPulse } from "./pulse";
import { deriveTrustState, type TrustFacts, type TrustState } from "./trust";

/** sim vehicle id -> staging registry plate, aligned with the seed. */
export const SIM_PLATE_BY_ID: Readonly<Record<string, string>> = {
  "sim-1": "AEZ 4821",
  "sim-2": "AFK 2903",
  "sim-3": "AGT 1157",
  "sim-4": "ADR 7346",
};

/** One row of the kombi_board RPC (aggregate counts, never a person). */
export interface KombiBoardRow {
  plate: string;
  capacity: number | null;
  verified_fares_30d: number;
  fare_days_30d: number;
  peak_hour_load_30d: number | null;
  drift_days_30d: number;
  last_verified_at: string | null;
  /** V5: fares cleared on this vehicle inside the short pulse window. */
  pulse_fares: number;
  /** V5: the window the database counted over, in minutes. */
  pulse_window_minutes: number;
}

export interface KombiProfile {
  simId: string;
  plate: string | null;
  facts: TrustFacts | null;
  trust: TrustState;
  /** Rank pulse; null when the vehicle has no registry row to count against. */
  pulse: RankPulse | null;
}

function toFacts(row: KombiBoardRow): TrustFacts {
  return {
    verifiedFares30d: row.verified_fares_30d,
    fareDays30d: row.fare_days_30d,
    declaredCapacity: row.capacity,
    peakHourLoad30d: row.peak_hour_load_30d,
    driftDays30d: row.drift_days_30d,
  };
}

/** Every sim vehicle gets a profile; registry misses stay unverified. */
export function joinFleetProfiles(
  simIds: string[],
  rows: KombiBoardRow[],
): KombiProfile[] {
  const byPlate = new Map(rows.map((r) => [r.plate, r]));
  return simIds.map((simId) => {
    const plate = SIM_PLATE_BY_ID[simId] ?? null;
    const row = plate ? byPlate.get(plate) : undefined;
    const facts = row ? toFacts(row) : null;
    return {
      simId,
      plate,
      facts,
      trust: deriveTrustState(facts),
      pulse: row
        ? derivePulse({
            pulseFares: row.pulse_fares,
            windowMinutes: row.pulse_window_minutes,
            declaredCapacity: row.capacity,
          })
        : null,
    };
  });
}
