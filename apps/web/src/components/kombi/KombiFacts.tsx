// The kombi facts block, shared by the marker card and the board rows so
// the two surfaces can never drift apart: plate, trust chip, direction,
// the live wait for the rider's stop, declared seats, the trust record in
// counts, and the standing provenance line. Trust copy names patterns on a
// vehicle's fare ledger, never a person (CLAUDE.md law); red here means
// unverified against facts, not a character score.
import type { KombiProfile } from "@/lib/kombi/fleet";
import type { VehicleEta } from "@/lib/kombi/vehicle-eta";
import type { KombiStrings } from "@/lib/kombi/strings";

export interface TerminusNames {
  outbound: string;
  inbound: string;
}

interface KombiFactsProps {
  profile: KombiProfile;
  /** undefined while the first fetch is in flight; null never happens. */
  eta?: VehicleEta;
  stopName: string;
  terminus: TerminusNames;
  strings: KombiStrings;
}

function etaBasis(strings: KombiStrings, eta: VehicleEta): string {
  if (eta.isMock) return strings.etaDemo;
  if (eta.rides === 1) return strings.etaFromRide;
  return strings.etaFromRides.replace("{count}", String(eta.rides));
}

export function KombiFacts({ profile, eta, stopName, terminus, strings }: KombiFactsProps) {
  const { facts, trust } = profile;
  const capacity = facts?.declaredCapacity ?? null;
  return (
    <div className="kombi-facts">
      <div className="kombi-facts-head">
        <span className="kombi-plate" data-testid="kombi-plate">
          {profile.plate ?? strings.plateUnknown}
        </span>
        <span
          className={`kombi-trust-chip kombi-trust-${trust}`}
          data-testid="kombi-trust"
          data-trust={trust}
        >
          {strings.trustChip[trust]}
        </span>
      </div>
      {eta && (
        <p className="svika-meta kombi-towards">
          {strings.towards.replace("{name}", terminus[eta.direction])}
        </p>
      )}
      <div className="kombi-fact-rows">
        <div className="kombi-fact-row" data-testid="kombi-eta">
          <span className="peek-label">
            {strings.arrives.replace("{stop}", stopName)}
          </span>
          {eta === undefined ? (
            <span className="peek-mono kombi-eta-value">—</span>
          ) : eta.minutes !== null ? (
            <span className="kombi-eta-cell">
              <span className="peek-mono kombi-eta-value">
                ~{eta.minutes} {strings.minutes}
              </span>
              <span className="peek-route-sub">{etaBasis(strings, eta)}</span>
            </span>
          ) : (
            <span className="svika-meta kombi-away">{strings.away}</span>
          )}
        </div>
        <div className="kombi-fact-row">
          <span className="peek-label">{strings.seats}</span>
          {capacity !== null ? (
            <span className="peek-mono kombi-eta-value">{capacity}</span>
          ) : (
            <span className="svika-meta">{strings.seatsUnknown}</span>
          )}
        </div>
      </div>
      <div className="kombi-trust-block">
        <p className="peek-label">{strings.trustTitle}</p>
        {trust === "unverified" && (
          <p className="svika-body kombi-trust-line">{strings.trustNone}</p>
        )}
        {trust !== "unverified" && facts && (
          <p className="svika-body kombi-trust-line">
            {strings.trustFares
              .replace("{count}", String(facts.verifiedFares30d))
              .replace("{days}", String(facts.fareDays30d))}
          </p>
        )}
        {trust === "drift" && facts && (
          <p className="svika-body kombi-trust-line">
            {strings.trustDriftLine.replace("{days}", String(facts.driftDays30d))}
          </p>
        )}
        <p className="svika-meta kombi-trust-law">{strings.trustLaw}</p>
      </div>
      <p className="svika-meta kombi-provenance" data-testid="kombi-provenance">
        {strings.provenance}
      </p>
    </div>
  );
}
