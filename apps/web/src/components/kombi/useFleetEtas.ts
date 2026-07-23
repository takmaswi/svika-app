"use client";

// Polls the per-vehicle arrival endpoint while a kombi surface is open.
// Fifteen seconds keeps the number honest without hammering a cheap phone's
// radio; the fetch aborts cleanly on unmount and a miss keeps the last
// answer instead of blanking the card.
import { useEffect, useState } from "react";
import type { VehicleEta } from "@/lib/kombi/vehicle-eta";

const POLL_MS = 15_000;

export function useFleetEtas(
  stopId: string,
  direction: "outbound" | "inbound",
  active: boolean,
): Record<string, VehicleEta> {
  const [etas, setEtas] = useState<Record<string, VehicleEta>>({});

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await fetch(
          `/app/kombis/eta?stop=${encodeURIComponent(stopId)}&dir=${direction}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { vehicles?: VehicleEta[] };
        if (disposed || !Array.isArray(body.vehicles)) return;
        setEtas(Object.fromEntries(body.vehicles.map((v) => [v.id, v])));
      } catch {
        // keep the previous answer; the poll tries again
      }
    };

    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [stopId, direction, active]);

  return etas;
}
