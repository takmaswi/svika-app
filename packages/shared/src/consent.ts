// First use consent gating, shared by the rider web app and the conductor
// PWA. The latest consent_records row decides: accepted opens the app,
// withdrawn or nothing at all keeps every surface blocked.

/** Bumped when the privacy notice changes enough to need a fresh accept. */
export const CONSENT_VERSION = "v1";

/**
 * The emergency details consent stream (profile page). Its accepted and
 * withdrawn records live in the same table but must never move the app
 * gate, so every gate query filters on CONSENT_VERSION.
 */
export const EMERGENCY_CONSENT_VERSION = "emergency-v1";

/**
 * The journey recording consent stream (batch M1). Accepting it is what
 * lets a recorded trace upload; without it the trace stays on the device.
 * Same table, same append only records, and every gate query filters by
 * its own version so the streams never move each other.
 */
export const JOURNEY_CONSENT_VERSION = "journey-v1";

export interface ConsentRecord {
  action: "accepted" | "withdrawn";
  created_at: string;
}

/** True when the newest record says accepted. Input order does not matter. */
export function hasActiveConsent(records: readonly ConsentRecord[]): boolean {
  let latest: ConsentRecord | null = null;
  for (const record of records) {
    if (!latest || record.created_at > latest.created_at) latest = record;
  }
  return latest?.action === "accepted";
}
