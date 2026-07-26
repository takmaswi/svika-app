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
import { TraceMapLazy } from "@/components/map/TraceMapLazy";
import { BackIcon } from "@/components/icons";

interface LiveShare {
  id: string;
  token: string;
}

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
  isPartner,
}: {
  lang: AppLanguage;
  id: string;
  saved?: string;
  /** A live partner consent; the partner door only opens for the rest. */
  isPartner: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [detail, setDetail] = useState<Detail | null | "missing">(null);
  const [share, setShare] = useState<LiveShare | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareRevoked, setShareRevoked] = useState(false);
  const [shortcutState, setShortcutState] = useState<
    "none" | "exists" | "flagged" | "invalid" | "rate_limited"
  >("none");
  const [shortcutBusy, setShortcutBusy] = useState(false);

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
        // an existing live guide link surfaces so the door reads its state
        const { data: liveShare } = await supabase
          .from("journey_shares")
          .select("id, token")
          .eq("journey_id", id)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled && liveShare) {
          setShare({ id: liveShare.id as string, token: liveShare.token as string });
        }
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

  // a walking trip already flagged shows its state instead of the door
  useEffect(() => {
    if (!detail || detail === "missing" || detail.localOnly) return;
    if (detail.mode === "kombi") return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("shortcut_paths")
        .select("id")
        .eq("source_journey_id", id)
        .maybeSingle();
      if (!cancelled && data) setShortcutState("exists");
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, id, detail]);

  const flagShortcut = async () => {
    if (shortcutBusy) return;
    setShortcutBusy(true);
    const { data, error } = await supabase.rpc("flag_journey_shortcut", {
      p_journey: id,
    });
    setShortcutBusy(false);
    if (error) {
      setShortcutState("invalid");
      return;
    }
    const outcome = data?.[0]?.outcome as string | undefined;
    if (outcome === "success") setShortcutState("flagged");
    else if (outcome === "rate_limited") setShortcutState("rate_limited");
    else setShortcutState("invalid");
  };

  const createShare = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    const { data, error } = await supabase.rpc("create_journey_share", {
      p_journey: id,
    });
    if (!error && data?.[0]?.share_token) {
      const { data: row } = await supabase
        .from("journey_shares")
        .select("id, token")
        .eq("token", data[0].share_token as string)
        .single();
      if (row) setShare({ id: row.id as string, token: row.token as string });
      setShareRevoked(false);
    }
    setShareBusy(false);
  };

  const revokeShare = async () => {
    if (!share || shareBusy) return;
    setShareBusy(true);
    const { error } = await supabase.rpc("revoke_journey_share", {
      p_share: share.id,
    });
    if (!error) {
      setShare(null);
      setShareRevoked(true);
    }
    setShareBusy(false);
  };

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

      {/* the gentle partner door (batch Partner): offered once, right after
          a trip is saved, to a rider who is not a partner yet. A link to
          the full explanation, never a switch here: nobody opts into
          sending data from a card they were not looking for */}
      {saved && !isPartner && (
        <section
          className="svika-card wallet-panel svika-animate-fade-up"
          data-testid="partner-door"
        >
          <h2 className="svika-title">{t(lang, "partner.savedDoorH")}</h2>
          <p className="svika-body">{t(lang, "partner.savedDoorB")}</p>
          <Link
            className="auth-link touch-target"
            href="/app/partner"
            data-testid="partner-door-link"
          >
            {t(lang, "partner.savedDoorCta")}
          </Link>
        </section>
      )}

      <div className="journey-map svika-animate-fade-up">
        <TraceMapLazy
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

      {detail !== null && !detail.localOnly && (
        <section
          className="svika-card wallet-panel svika-animate-fade-up svika-rise-3"
          data-testid="journey-share-section"
        >
          <h2 className="svika-title">{t(lang, "journey.shareH")}</h2>
          <p className="svika-body">{t(lang, "journey.shareB")}</p>
          {share ? (
            <>
              <p className="svika-meta">{t(lang, "share.linkLabel")}</p>
              <p className="share-url svika-mono-code" data-testid="journey-share-url">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/share/journey/${share.token}`
                  : `/share/journey/${share.token}`}
              </p>
              <button
                className="auth-link touch-target"
                type="button"
                disabled={shareBusy}
                onClick={() => void revokeShare()}
                data-testid="journey-share-revoke"
              >
                {t(lang, "journey.shareRevoke")}
              </button>
            </>
          ) : (
            <button
              className="auth-submit touch-target"
              type="button"
              disabled={shareBusy}
              onClick={() => void createShare()}
              data-testid="journey-share-create"
            >
              {t(lang, "journey.shareCta")}
            </button>
          )}
          {shareRevoked && (
            <p className="wallet-ok svika-body" data-testid="journey-share-revoked">
              {t(lang, "journey.shareRevoked")}
            </p>
          )}
        </section>
      )}

      {/* M3: a saved walking trip can become a shortcut; the trace is the
          shape, personal first, community by consensus like every name */}
      {detail !== null && !detail.localOnly && detail.mode !== "kombi" && (
        <section
          className="svika-card wallet-panel svika-animate-fade-up svika-rise-4"
          data-testid="journey-shortcut-section"
        >
          <h2 className="svika-title">{t(lang, "journey.shortcutH")}</h2>
          <p className="svika-body">{t(lang, "journey.shortcutB")}</p>
          {shortcutState === "none" && (
            <button
              className="auth-submit touch-target"
              type="button"
              disabled={shortcutBusy}
              onClick={() => void flagShortcut()}
              data-testid="journey-shortcut-flag"
            >
              {t(lang, "journey.shortcutCta")}
            </button>
          )}
          {(shortcutState === "flagged" || shortcutState === "exists") && (
            <p className="wallet-ok svika-body" data-testid="journey-shortcut-done">
              {t(lang, "journey.shortcutDone")}{" "}
              <Link className="auth-link" href="/app/places">
                {t(lang, "places.title")}
              </Link>
            </p>
          )}
          {shortcutState === "invalid" && (
            <p className="svika-body auth-error" data-testid="journey-shortcut-note">
              {t(lang, "journey.shortcutInvalid")}
            </p>
          )}
          {shortcutState === "rate_limited" && (
            <p className="svika-body auth-error" data-testid="journey-shortcut-note">
              {t(lang, "journey.shortcutRate")}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
