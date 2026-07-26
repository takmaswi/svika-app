"use client";

// The places map (batch M3): where the city gets its names. Same checked in
// Mbare Sun style, tile adapter chain and pmtiles protocol as TraceMap; on
// top of the basemap it renders
//   * nickname chips: the §7 map place chip (char rect, mono 9px white
//     text) for community names; a rider's own personal names use the soft
//     ink variant so they read quieter than agreed names (spec gap flagged
//     in the gate report, not improvised silently: same chip anatomy, only
//     the fill differs),
//   * shortcut lines: dashed walk tone (§2), the same treatment as the plan
//     walking tail, personal and community alike,
//   * the naming pin: the D1 walk tone place pin (deviation 5), moved by
//     tapping the map.
// Chips carry data-place-name / data-scope so tests prove rendering in
// coordinates and content, never pixels.
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { ensurePmtilesProtocol } from "@/lib/map/pmtiles-protocol";
import { buildMbareSunStyle, MAP_COLORS, type MapTheme } from "@/lib/map/style";
import { providerChain, tileSourceFor } from "@/lib/map/tile-source";

const MAP_ENV = {
  provider: process.env.NEXT_PUBLIC_MAP_PROVIDER,
  maptilerKey: process.env.NEXT_PUBLIC_MAP_TILES_URL,
  pmtilesUrl: process.env.NEXT_PUBLIC_MAP_PMTILES_URL,
};

const PLACES_ZOOM = 15;
// plan walk leg treatment (§2 walk tone, finer dash), same numbers as LiveMap
const WALK_WIDTH = 3.5;
const WALK_DASH = [0.1, 1.8];

export interface PlaceLabel {
  id: string;
  name: string;
  scope: "personal" | "suggested" | "public";
  lat: number;
  lng: number;
}

export interface ShortcutLine {
  id: string;
  scope: "personal" | "suggested" | "public";
  coordinates: [number, number][];
}

export interface PlacesMapProps {
  labels: { ariaLabel: string; unavailable: string };
  center: [number, number];
  pin: [number, number] | null;
  onPick?: (lngLat: [number, number]) => void;
  names: PlaceLabel[];
  shortcuts: ShortcutLine[];
  testId?: string;
}

function currentMapTheme(): MapTheme {
  const forced = document.documentElement.dataset.theme;
  if (forced === "dark") return "night";
  if (forced === "light") return "day";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
}

function makePinElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "place-pick-pin";
  el.dataset.testid = "place-pick-pin";
  return el;
}

function makeChipElement(place: PlaceLabel): HTMLDivElement {
  const el = document.createElement("div");
  el.className =
    place.scope === "personal" ? "map-place-chip map-place-chip-personal" : "map-place-chip";
  el.textContent = place.name;
  el.dataset.testid = "map-place-chip";
  el.dataset.placeName = place.name;
  el.dataset.scope = place.scope;
  return el;
}

export function PlacesMap({
  labels,
  center,
  pin,
  onPick,
  names,
  shortcuts,
  testId,
}: PlacesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);
  const chipMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setFailed(true);
      return;
    }
    let disposed = false;
    let map: maplibregl.Map | null = null;
    let theme = currentMapTheme();
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const themeObserver = new MutationObserver(applyTheme);

    const origin = window.location.origin;
    const chain = providerChain(MAP_ENV);
    let providerIdx = 0;
    let tileLoaded = false;
    if (chain.includes("selfhosted")) ensurePmtilesProtocol();
    const styleForTheme = (t: MapTheme) =>
      buildMbareSunStyle(t, {
        source: tileSourceFor(chain[providerIdx]!, MAP_ENV, origin),
        origin,
      });

    function applyTheme() {
      const next = currentMapTheme();
      if (disposed || !map || next === theme) return;
      theme = next;
      map.setStyle(styleForTheme(theme));
    }

    function addShortcutLayers(m: maplibregl.Map) {
      const c = MAP_COLORS[theme];
      m.addSource("shortcut-lines", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: shortcutsRef.current.map((s) => ({
            type: "Feature" as const,
            properties: { scope: s.scope },
            geometry: { type: "LineString" as const, coordinates: s.coordinates },
          })),
        },
      });
      m.addLayer({
        id: "shortcut-lines-walk",
        type: "line",
        source: "shortcut-lines",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": c.walk,
          "line-width": WALK_WIDTH,
          "line-dasharray": WALK_DASH,
        },
      });
    }

    try {
      map = new maplibregl.Map({
        container,
        style: styleForTheme(theme),
        center,
        zoom: PLACES_ZOOM,
        attributionControl: false,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: false }), "top-right");
      mapRef.current = map;

      map.on("style.load", () => {
        if (!map || disposed) return;
        addShortcutLayers(map);
      });
      map.on("load", () => {
        if (disposed) return;
        setReady(true);
      });
      map.on("click", (e) => {
        onPickRef.current?.([e.lngLat.lng, e.lngLat.lat]);
      });
      map.on("sourcedata", (e) => {
        if (e.sourceId && (e as { tile?: unknown }).tile) tileLoaded = true;
      });
      map.on("error", () => {
        if (disposed || !map || tileLoaded) return;
        if (providerIdx < chain.length - 1) {
          providerIdx += 1;
          map.setStyle(styleForTheme(theme));
        }
      });

      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      darkQuery.addEventListener("change", applyTheme);
    } catch {
      setFailed(true);
    }

    return () => {
      disposed = true;
      themeObserver.disconnect();
      darkQuery.removeEventListener("change", applyTheme);
      pinMarkerRef.current?.remove();
      pinMarkerRef.current = null;
      for (const marker of chipMarkersRef.current.values()) marker.remove();
      chipMarkersRef.current.clear();
      map?.remove();
      mapRef.current = null;
    };
    // mount once; pin, names and shortcuts flow through the effects below
  }, []);

  // the naming pin follows the rider's tap
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!pin) {
      pinMarkerRef.current?.remove();
      pinMarkerRef.current = null;
      return;
    }
    if (!pinMarkerRef.current) {
      pinMarkerRef.current = new maplibregl.Marker({
        element: makePinElement(),
        subpixelPositioning: true,
      })
        .setLngLat(pin)
        .addTo(map);
    } else {
      pinMarkerRef.current.setLngLat(pin);
    }
    const el = pinMarkerRef.current.getElement();
    el.dataset.lng = String(pin[0]);
    el.dataset.lat = String(pin[1]);
  }, [pin, ready]);

  // nickname chips reconcile by id: names arrive, promote, hide
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const seen = new Set<string>();
    for (const place of names) {
      seen.add(place.id);
      const existing = chipMarkersRef.current.get(place.id);
      if (existing) {
        existing.setLngLat([place.lng, place.lat]);
      } else {
        chipMarkersRef.current.set(
          place.id,
          new maplibregl.Marker({ element: makeChipElement(place) })
            .setLngLat([place.lng, place.lat])
            .addTo(map),
        );
      }
    }
    for (const [id, marker] of chipMarkersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        chipMarkersRef.current.delete(id);
      }
    }
  }, [names, ready]);

  // shortcut lines re-render as data changes (and re-add on theme swap via
  // style.load in the mount effect)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("shortcut-lines") as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: shortcuts.map((s) => ({
        type: "Feature" as const,
        properties: { scope: s.scope },
        geometry: { type: "LineString" as const, coordinates: s.coordinates },
      })),
    });
  }, [shortcuts, ready]);

  if (failed) {
    return (
      <div className="live-map live-map-unavailable" data-testid={testId ?? "places-map"}>
        <p className="svika-body">{labels.unavailable}</p>
      </div>
    );
  }

  return (
    <div
      className="live-map places-map"
      data-testid={testId ?? "places-map"}
      data-map-ready={ready}
      data-name-count={names.length}
      data-shortcut-count={shortcuts.length}
    >
      <div
        ref={containerRef}
        className="live-map-canvas"
        role="img"
        aria-label={labels.ariaLabel}
      />
    </div>
  );
}
