"use client";

// My trips: the rider's saved journeys. Server rows come through RLS (only
// ever their own); journeys kept on this phone (saved without upload
// consent) merge in from IndexedDB and wear the on-device chip. Server
// wins on a shared id; a local sync conflict flag survives the merge.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AppLanguage } from "@svika/shared";
import { t, type DictKey } from "@/lib/dict";
import { createClient } from "@/lib/supabase/client";
import { listJourneys } from "@/lib/journey/store";
import { BackIcon } from "@/components/icons";

interface TripRow {
  id: string;
  name: string | null;
  mode: "kombi" | "walk" | "mixed";
  startedAt: number;
  distanceM: number;
  localOnly: boolean;
  conflict: boolean;
}

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function JourneysList({ lang }: { lang: AppLanguage }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<TripRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [server, local] = await Promise.all([
        supabase
          .from("rider_journeys")
          .select("id, name, mode, status, started_at, distance_m")
          .eq("status", "complete")
          .order("started_at", { ascending: false }),
        listJourneys(),
      ]);
      if (cancelled) return;
      const conflicts = new Map(local.map((j) => [j.id, j.conflict]));
      const serverRows: TripRow[] = (server.data ?? []).map((j) => ({
        id: j.id as string,
        name: (j.name as string | null) ?? null,
        mode: j.mode as TripRow["mode"],
        startedAt: new Date(j.started_at as string).getTime(),
        distanceM: (j.distance_m as number | null) ?? 0,
        localOnly: false,
        conflict: conflicts.get(j.id as string) ?? false,
      }));
      const serverIds = new Set(serverRows.map((r) => r.id));
      const localRows: TripRow[] = local
        .filter((j) => j.status === "complete" && !serverIds.has(j.id))
        .map((j) => ({
          id: j.id,
          name: j.name ?? null,
          mode: j.mode,
          startedAt: j.startedAt,
          distanceM: j.distanceM,
          localOnly: true,
          conflict: j.conflict,
        }));
      setRows(
        [...serverRows, ...localRows].sort((a, b) => b.startedAt - a.startedAt),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <main className="shell" data-testid="journeys-list" data-loaded={rows !== null}>
      <header className="screen-head">
        <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "journey.listTitle")}</h1>
      </header>

      {rows !== null && rows.length === 0 && (
        <p className="svika-body empty-note" data-testid="journeys-empty">
          {t(lang, "journey.listEmpty")}
        </p>
      )}

      <ul className="journey-list">
        {(rows ?? []).map((row, i) => (
          <li key={row.id}>
            <Link
              className={`journey-card svika-card touch-target svika-animate-fade-up svika-rise-${Math.min(i + 1, 7)}`}
              href={`/app/journeys/${row.id}`}
              data-testid="journey-card"
            >
              <span className="journey-card-body">
                <span className="journey-card-name">
                  {row.name ?? t(lang, "journey.detailFallback")}
                </span>
                <span className="svika-meta journey-card-sub">
                  {new Date(row.startedAt).toLocaleDateString("en-ZW", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  ·{" "}
                  {new Date(row.startedAt).toLocaleTimeString("en-ZW", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {t(lang, `journey.mode.${row.mode}` as DictKey)}
                </span>
                {(row.localOnly || row.conflict) && (
                  <span className="journey-card-chips">
                    {row.localOnly && (
                      <span className="journey-chip" data-testid="journey-local-chip">
                        {t(lang, "journey.localChip")}
                      </span>
                    )}
                    {row.conflict && (
                      <span className="journey-chip">
                        {t(lang, "journey.conflictChip")}
                      </span>
                    )}
                  </span>
                )}
              </span>
              <span className="svika-mono-code journey-card-distance">
                {formatDistance(row.distanceM)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
