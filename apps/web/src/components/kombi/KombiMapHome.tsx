"use client";

// The home map with tappable kombis: the client boundary that owns "which
// marker was tapped". The map itself is untouched Mbare Sun; this wrapper
// only wires the tap to the kombi card and polls the arrival endpoint while
// a card is open.
import { useState } from "react";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import type { LiveMapLabels } from "@/components/map/LiveMap";
import type { KombiProfile } from "@/lib/kombi/fleet";
import type { KombiStrings } from "@/lib/kombi/strings";
import { KombiCard } from "./KombiCard";
import type { TerminusNames } from "./KombiFacts";
import { useFleetEtas } from "./useFleetEtas";

interface KombiMapHomeProps {
  labels: LiveMapLabels;
  camera?: "corridor" | "boarding";
  profiles: KombiProfile[];
  stopId: string;
  stopName: string;
  direction: "outbound" | "inbound";
  terminus: TerminusNames;
  strings: KombiStrings;
}

export function KombiMapHome({
  labels,
  camera,
  profiles,
  stopId,
  stopName,
  direction,
  terminus,
  strings,
}: KombiMapHomeProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const etas = useFleetEtas(stopId, direction, selectedId !== null);
  const selected = profiles.find((p) => p.simId === selectedId) ?? null;

  return (
    <>
      <LiveMapLazy labels={labels} camera={camera} onKombiTap={setSelectedId} />
      {selected && (
        <KombiCard
          key={selected.simId}
          profile={selected}
          eta={etas[selected.simId]}
          stopName={stopName}
          terminus={terminus}
          strings={strings}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
