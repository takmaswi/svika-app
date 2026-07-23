"use client";

// The board rows: every kombi on the corridor as the same facts block the
// marker card shows, refreshed while the board is open. Glanceable, one
// card per vehicle, entrances staggered per section 12.
import type { KombiProfile } from "@/lib/kombi/fleet";
import type { KombiStrings } from "@/lib/kombi/strings";
import { KombiFacts, type TerminusNames } from "./KombiFacts";
import { useFleetEtas } from "./useFleetEtas";

interface KombiBoardProps {
  profiles: KombiProfile[];
  stopId: string;
  stopName: string;
  direction: "outbound" | "inbound";
  terminus: TerminusNames;
  strings: KombiStrings;
}

export function KombiBoard({
  profiles,
  stopId,
  stopName,
  direction,
  terminus,
  strings,
}: KombiBoardProps) {
  const etas = useFleetEtas(stopId, direction, true);

  return (
    <ul className="kombi-board-list" data-testid="kombi-board-list">
      {profiles.map((p, i) => (
        <li
          key={p.simId}
          className={`svika-card kombi-board-row svika-animate-fade-up svika-rise-${Math.min(i + 2, 6)}`}
          data-testid="kombi-board-row"
        >
          <KombiFacts
            profile={p}
            eta={etas[p.simId]}
            stopName={stopName}
            terminus={terminus}
            strings={strings}
          />
        </li>
      ))}
    </ul>
  );
}
