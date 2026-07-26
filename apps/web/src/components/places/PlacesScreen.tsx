"use client";

// Name the city (batch M3). Personal first, promote by consensus: whatever
// a rider types here is visible to them alone until three independent
// riders agree, so the screen says so in plain words. The recommended
// names row is one indexed nearest neighbour query (rules, not AI); the
// wordlist screens a name on the phone before the server screens it again;
// community names carry a report door and the copy flags names, never the
// people who typed them.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppLanguage } from "@svika/shared";
import { isPlaceNameClean } from "@svika/shared";
import { t, type DictKey } from "@/lib/dict";
import { createClient } from "@/lib/supabase/client";
import { PlacesMapLazy } from "./PlacesMapLazy";
import type { PlaceLabel, ShortcutLine } from "./PlacesMap";
import { BackIcon } from "@/components/icons";

const HARARE_CENTER: [number, number] = [31.0522, -17.8292];
// the nearby window: about 2 km each way at Harare's latitude
const NEARBY_BOX = 0.02;
const KINDS = ["stop", "place", "gate", "landmark"] as const;
type PlaceKind = (typeof KINDS)[number];

interface Recommendation {
  place_id: string;
  name: string;
  kind: PlaceKind;
  scope: "suggested" | "public";
  distance_m: number;
}

type Outcome = "success" | "blocked_word" | "rate_limited" | "invalid" | null;

function parseAt(at: string | undefined): [number, number] | null {
  if (!at) return null;
  const m = at.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lng, lat];
}

export function PlacesScreen({
  lang,
  isGuest,
  at,
}: {
  lang: AppLanguage;
  isGuest: boolean;
  at?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const fromParam = useMemo(() => parseAt(at), [at]);
  const [pin, setPin] = useState<[number, number] | null>(fromParam);
  const [names, setNames] = useState<PlaceLabel[]>([]);
  const [shortcuts, setShortcuts] = useState<ShortcutLine[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PlaceKind>("place");
  const [acceptedFrom, setAcceptedFrom] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const askedGeo = useRef(false);

  // no pin from the link: start from the rider, or from town
  useEffect(() => {
    if (pin || askedGeo.current) return;
    askedGeo.current = true;
    if (!navigator.geolocation) {
      setPin(HARARE_CENTER);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (fix) => setPin([fix.coords.longitude, fix.coords.latitude]),
      () => setPin(HARARE_CENTER),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }, [pin]);

  const center = pin ?? HARARE_CENTER;

  const refreshNearby = useCallback(async () => {
    const [lng, lat] = pin ?? HARARE_CENTER;
    const [namesRes, shortcutsRes] = await Promise.all([
      supabase
        .from("place_names_live")
        .select("id, name, scope, lat, lng")
        .gte("lat", lat - NEARBY_BOX)
        .lte("lat", lat + NEARBY_BOX)
        .gte("lng", lng - NEARBY_BOX)
        .lte("lng", lng + NEARBY_BOX)
        .order("created_at", { ascending: true })
        .limit(40),
      supabase
        .from("shortcut_paths_live")
        .select("id, scope, path_geojson")
        .order("created_at", { ascending: true })
        .limit(40),
    ]);
    setNames(
      ((namesRes.data ?? []) as PlaceLabel[]).map((row) => ({
        id: row.id,
        name: row.name,
        scope: row.scope,
        lat: row.lat,
        lng: row.lng,
      })),
    );
    const lines: ShortcutLine[] = [];
    for (const row of shortcutsRes.data ?? []) {
      try {
        const geo = JSON.parse(row.path_geojson as string) as {
          type: string;
          coordinates: [number, number][];
        };
        if (geo.type !== "LineString" || geo.coordinates.length < 2) continue;
        const [firstLng, firstLat] = geo.coordinates[0]!;
        if (
          Math.abs(firstLat - lat) > NEARBY_BOX * 2 ||
          Math.abs(firstLng - lng) > NEARBY_BOX * 2
        ) {
          continue;
        }
        lines.push({
          id: row.id as string,
          scope: row.scope as ShortcutLine["scope"],
          coordinates: geo.coordinates,
        });
      } catch {
        // a malformed row renders nothing rather than killing the screen
      }
    }
    setShortcuts(lines);
  }, [supabase, pin]);

  useEffect(() => {
    void refreshNearby();
  }, [refreshNearby]);

  // recommended naming: one nearest neighbour query when the pin settles
  useEffect(() => {
    if (isGuest || !pin) {
      setRecs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("recommend_place_names", {
        p_lat: pin[1],
        p_lng: pin[0],
      });
      if (!cancelled) setRecs((data ?? []) as Recommendation[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, pin, isGuest, outcome]);

  const pickRecommendation = (rec: Recommendation) => {
    setName(rec.name);
    setKind(rec.kind);
    setAcceptedFrom(rec.place_id);
    setOutcome(null);
  };

  const save = async () => {
    if (busy || !pin) return;
    const trimmed = name.trim();
    if (!acceptedFrom) {
      if (trimmed.length < 2 || trimmed.length > 60) {
        setOutcome("invalid");
        return;
      }
      // the phone screens first; the server screens again and has the last word
      if (!isPlaceNameClean(trimmed)) {
        setOutcome("blocked_word");
        return;
      }
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("submit_place_name", {
      p_name: acceptedFrom ? null : trimmed,
      p_kind: kind,
      p_lat: pin[1],
      p_lng: pin[0],
      p_accepted_from: acceptedFrom,
    });
    setBusy(false);
    if (error) {
      setOutcome("invalid");
      return;
    }
    const result = (data?.[0]?.outcome ?? "invalid") as Outcome;
    setOutcome(result);
    if (result === "success") {
      setName("");
      setAcceptedFrom(null);
      void refreshNearby();
    }
  };

  const report = async (placeId: string) => {
    const { data, error } = await supabase.rpc("report_place_name", {
      p_place: placeId,
    });
    if (!error && data?.[0]?.outcome === "success") {
      // the row keeps its reported note for this visit even when the third
      // report just hid the name; the map catches up on the next load
      setReported((prev) => new Set(prev).add(placeId));
    }
  };

  const communityNearby = names.filter((n) => n.scope !== "personal");

  return (
    <main className="shell places-screen" data-testid="places-screen">
      <header className="screen-head">
        <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "places.title")}</h1>
      </header>
      <p className="svika-body places-intro svika-animate-fade-up">
        {t(lang, "places.intro")}
      </p>

      <div className="places-map-frame svika-animate-fade-up svika-rise-2">
        <PlacesMapLazy
          labels={{
            ariaLabel: t(lang, "map.ariaLabel"),
            unavailable: t(lang, "map.unavailable"),
          }}
          center={center}
          pin={pin}
          onPick={(lngLat) => {
            setPin(lngLat);
            setOutcome(null);
            setAcceptedFrom(null);
          }}
          names={names}
          shortcuts={shortcuts}
        />
        <p className="svika-meta places-pin-hint">{t(lang, "places.pinHint")}</p>
      </div>

      {isGuest ? (
        <section className="svika-card wallet-panel svika-animate-fade-up svika-rise-3">
          <p className="svika-body">{t(lang, "guest.why.name")}</p>
          <Link
            className="auth-submit touch-target"
            href="/login?why=name&next=/app/places"
            data-testid="places-guest-door"
          >
            {t(lang, "places.guestCta")}
          </Link>
        </section>
      ) : (
        <section
          className="svika-card wallet-panel svika-animate-fade-up svika-rise-3"
          data-testid="places-name-card"
        >
          {recs.length > 0 && (
            <>
              <p className="svika-meta">{t(lang, "places.recommendH")}</p>
              <div className="places-recommend-row" data-testid="place-recommend-row">
                {recs.map((rec) => (
                  <button
                    key={rec.place_id}
                    type="button"
                    className="place-recommend-chip touch-target"
                    data-testid="place-recommend"
                    data-selected={acceptedFrom === rec.place_id}
                    onClick={() => pickRecommendation(rec)}
                  >
                    {rec.name}
                    <span className="svika-mono-code place-recommend-distance">
                      {rec.distance_m} m
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          <label className="svika-meta places-name-label" htmlFor="place-name">
            {t(lang, "places.nameLabel")}
          </label>
          <input
            id="place-name"
            className="places-name-input"
            data-testid="place-name-input"
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              setAcceptedFrom(null);
              setOutcome(null);
            }}
          />

          <p className="svika-meta places-kind-label">{t(lang, "places.kindLabel")}</p>
          <div className="places-kind-row" role="radiogroup">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                className="place-kind-chip touch-target"
                data-selected={kind === k}
                onClick={() => setKind(k)}
              >
                {t(lang, `places.kind.${k}` as DictKey)}
              </button>
            ))}
          </div>

          <button
            className="auth-submit touch-target"
            type="button"
            disabled={busy || !pin}
            onClick={() => void save()}
            data-testid="place-save"
          >
            {t(lang, "places.saveCta")}
          </button>

          {outcome && (
            <p
              className={outcome === "success" ? "wallet-ok svika-body" : "svika-body auth-error"}
              data-testid="place-outcome"
              data-outcome={outcome}
            >
              {t(lang, `places.outcome.${outcome}` as DictKey)}
            </p>
          )}
        </section>
      )}

      {communityNearby.length > 0 && (
        <section className="svika-card wallet-panel svika-animate-fade-up svika-rise-4">
          <h2 className="svika-title">{t(lang, "places.nearbyH")}</h2>
          <ul className="places-nearby-list">
            {communityNearby.map((row) => (
              <li key={row.id} className="places-nearby-row" data-testid="place-nearby-row">
                <span className="svika-body places-nearby-name">{row.name}</span>
                <span className="svika-meta places-nearby-scope">
                  {t(lang, `places.scope.${row.scope}` as DictKey)}
                </span>
                {reported.has(row.id) ? (
                  <span className="svika-meta" data-testid="place-reported">
                    {t(lang, "places.reported")}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="auth-link touch-target places-report-btn"
                    data-testid="place-report"
                    onClick={() => void report(row.id)}
                  >
                    {t(lang, "places.report")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
