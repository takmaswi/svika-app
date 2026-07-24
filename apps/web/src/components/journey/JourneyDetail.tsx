"use client";

// A saved trip: the recorded trace on the map (route ink, whole trace
// fitted) with its named summary. Server rows come through RLS; a journey
// kept on this phone renders from IndexedDB with the on-device chip. The
// share door (batch M2) attaches here.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AppLanguage } from "@svika/shared";
import { t, type DictKey } from "@/lib/dict";
import { createClient } from "@/lib/supabase/client";
import { getJourney, listPoints } from "@/lib/journey/store";
import { TraceMap } from "@/components/map/TraceMap";
import { BackIcon } from "@/components/icons";

interface Detail {
  name: string | null;
  mode: "kombi" | "walk" | "mixed";
  startedAt: number;
  endedAt: number | null;
  distanceM: number;
  trace: [number, number][];
  localOnly: boolean;
}

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return `${minutes}`;
}

export function JourneyDetail({
  lang,
  id,
  saved,
}: {
  lang: AppLanguage;
  id: string;
  saved?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [detail, setDetail] = useState<Detail | null | "missing">(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [journeyRes, pointsRes] = await Promise.all([
        supabase
          .from("rider_journeys")
          .select("name, mode, started_at, ended_at, distance_m")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("rider_journey_points")
          .select("lat, lng, seq")
          .eq("journey_id", id)
          .order("seq", { ascending: true }),
      ]);
      if (cancelled) return;
      const j = journeyRes.data;
      if (j) {
        setDetail({
          name: (j.name as string | null) ?? null,
          mode: j.mode as Detail["mode"],
          startedAt: new Date(j.started_at as string).getTime(),
          endedAt: j.ended_at ? new Date(j.ended_at as string).getTime() : null,
          distanceM: (j.distance_m as number | null) ?? 0,
          trace: (pointsRes.data ?? []).map((p) => [
            p.lng as number,
            p.lat as number,
          ]),
          localOnly: false,
        });
        return;
      }
      // not on the server: a trip kept on this phone
      const local = await getJourney(id);
      if (!local || local.status !== "complete") {
        setDetail("missing");
        return;
      }
      const points = await listPoints(id);
      if (cancelled) return;
      setDetail({
        name: local.name ?? null,
        mode: local.mode,
        startedAt: local.startedAt,
        endedAt: local.endedAt ?? null,
        distanceM: local.distanceM,
        trace: points.map((p) => [p.lng, p.lat]),
        localOnly: true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, id]);

  if (detail === "missing") {
    return (
      <main className="shell" data-testid="journey-detail" data-state="missing">
        <header className="screen-head">
          <Link
            href="/app/journeys"
            className="back-btn"
            aria-label={t(lang, "common.back")}
          >
            <BackIcon />
          </Link>
          <h1 className="svika-headline">{t(lang, "journey.detailFallback")}</h1>
        </header>
        <p className="svika-body empty-note">{t(lang, "journey.listEmpty")}</p>
      </main>
    );
  }

  return (
    <main
      className="shell"
      data-testid="journey-detail"
      data-loaded={detail !== null}
    >
      <header className="screen-head">
        <Link
          href="/app/journeys"
          className="back-btn"
          aria-label={t(lang, "common.back")}
        >
          <BackIcon />
        </Link>
        <h1 className="svika-headline" data-testid="journey-title">
          {detail?.name ?? t(lang, "journey.detailFallback")}
        </h1>
      </header>

      {saved === "1" && (
        <p className="wallet-ok svika-body" data-testid="journey-saved-note">
          {t(lang, "journey.saved")}
        </p>
      )}
      {(saved === "local" || detail?.localOnly) && (
        <p className="svika-body journey-local-note" data-testid="journey-local-note">
          {t(lang, "journey.localNote")}
        </p>
      )}

      <div className="journey-map svika-animate-fade-up">
        <TraceMap
          labels={{
            ariaLabel: t(lang, "map.ariaLabel"),
            unavailable: t(lang, "map.unavailable"),
          }}
          trace={detail?.trace ?? []}
          camera="fit"
          testId="journey-trace-map"
        />
      </div>

      {detail !== null && (
        <section className="svika-card wallet-panel svika-animate-fade-up svika-rise-2">
          <dl className="record-summary">
            <div className="record-summary-row">
              <dt className="svika-meta">{t(lang, "journey.distance")}</dt>
              <dd className="svika-mono-code" data-testid="journey-distance">
                {formatDistance(detail.distanceM)}
              </dd>
            </div>
            {detail.endedAt && (
              <div className="record-summary-row">
                <dt className="svika-meta">{t(lang, "journey.duration")}</dt>
                <dd className="svika-mono-code">
                  {formatDuration(detail.endedAt - detail.startedAt)}{" "}
                  {t(lang, "common.minutes")}
                </dd>
              </div>
            )}
            <div className="record-summary-row">
              <dt className="svika-meta">{t(lang, "journey.points")}</dt>
              <dd className="svika-mono-code" data-testid="journey-points-count">
                {detail.trace.length}
              </dd>
            </div>
            <div className="record-summary-row">
              <dt className="svika-meta">{t(lang, "journey.modeLabel")}</dt>
              <dd className="svika-body">
                {t(lang, `journey.mode.${detail.mode}` as DictKey)}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </main>
  );
}
