"use client";

// A light Mbare Sun map for journey traces: the recording screen (live
// trace growing under the rider), the saved trip detail (whole trace
// fitted), and the M2 guide viewer share it. Same checked in style, same
// tile source adapter chain and pmtiles protocol as LiveMap; none of the
// corridor, fleet or entrance machinery, because this screen's story is
// the trace itself.
//
// The trace draws in THE §11 route ink. The self position dot reuses the
// §7 live signal dot (it is literally a live dot); the marker element
// carries data-lng/data-lat so tests prove position in coordinates, not
// pixels.
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { clampFitPadding } from "@/lib/map/camera-fit";
import { ensurePmtilesProtocol } from "@/lib/map/pmtiles-protocol";
import { buildMbareSunStyle, MAP_COLORS, type MapTheme } from "@/lib/map/style";
import { providerChain, tileSourceFor } from "@/lib/map/tile-source";

// §11 route treatment, same numbers as LiveMap.
const ROUTE_WIDTH = 5;
const ROUTE_DASH = [0.2, 2.2];

const MAP_ENV = {
  provider: process.env.NEXT_PUBLIC_MAP_PROVIDER,
  maptilerKey: process.env.NEXT_PUBLIC_MAP_TILES_URL,
  pmtilesUrl: process.env.NEXT_PUBLIC_MAP_PMTILES_URL,
};

const HARARE_CENTER: [number, number] = [31.0522, -17.8292];
const FOLLOW_ZOOM = 16;

export interface TraceMapProps {
  labels: { ariaLabel: string; unavailable: string };
  /** The trace polyline, oldest first. */
  trace: [number, number][];
  /** The self position dot; null hides it. */
  position?: [number, number] | null;
  /**
   * "follow" keeps the camera on the position (recording, guiding);
   * "fit" frames the whole trace once (saved trip detail).
   */
  camera: "follow" | "fit";
  testId?: string;
}

function currentMapTheme(): MapTheme {
  const forced = document.documentElement.dataset.theme;
  if (forced === "dark") return "night";
  if (forced === "light") return "day";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
}

function traceBounds(trace: [number, number][]): [[number, number], [number, number]] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of trace) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function makePositionElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "svika-live-dot trace-self-dot";
  el.dataset.testid = "trace-self-dot";
  el.innerHTML = `
    <span class="svika-ripple-ring" aria-hidden="true"></span>
    <span class="svika-pulse-dot" aria-hidden="true"></span>`;
  return el;
}

export function TraceMap({ labels, trace, position, camera, testId }: TraceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const traceRef = useRef(trace);
  traceRef.current = trace;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const fittedRef = useRef(false);

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

    function addTraceLayers(m: maplibregl.Map) {
      const c = MAP_COLORS[theme];
      m.addSource("journey-trace", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: traceRef.current },
        },
      });
      m.addLayer({
        id: "journey-trace-line",
        type: "line",
        source: "journey-trace",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": c.route,
          "line-width": ROUTE_WIDTH,
          "line-dasharray": ROUTE_DASH,
          "line-opacity": c.routeOpacity,
        },
      });
    }

    try {
      map = new maplibregl.Map({
        container,
        style: styleForTheme(theme),
        center: trace.length > 0 ? trace[trace.length - 1] : HARARE_CENTER,
        zoom: FOLLOW_ZOOM,
        attributionControl: false,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: false }), "top-right");
      mapRef.current = map;

      map.on("style.load", () => {
        if (!map || disposed) return;
        addTraceLayers(map);
      });
      map.on("load", () => {
        if (disposed) return;
        setReady(true);
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
      markerRef.current?.remove();
      markerRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // mount once; trace and position flow through the effects below
  }, []);

  // the trace grows: push it into the source, and in fit mode frame it once
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("journey-trace") as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: trace },
    });
    if (camera === "fit" && !fittedRef.current && trace.length >= 2) {
      fittedRef.current = true;
      const box = map.getContainer();
      map.fitBounds(traceBounds(trace), {
        padding: clampFitPadding(box.clientWidth, box.clientHeight, 56),
        duration: 0,
        maxZoom: 16.5,
      });
    }
  }, [trace, ready, camera]);

  // the self position dot follows the rider
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!position) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({
        element: makePositionElement(),
        subpixelPositioning: true,
      })
        .setLngLat(position)
        .addTo(map);
    } else {
      markerRef.current.setLngLat(position);
    }
    const el = markerRef.current.getElement();
    el.dataset.lng = String(position[0]);
    el.dataset.lat = String(position[1]);
    if (camera === "follow") {
      map.easeTo({ center: position, duration: 800 });
    }
  }, [position, ready, camera]);

  if (failed) {
    return (
      <div className="live-map live-map-unavailable" data-testid={testId ?? "trace-map"}>
        <p className="svika-body">{labels.unavailable}</p>
      </div>
    );
  }

  return (
    <div
      className="live-map"
      data-testid={testId ?? "trace-map"}
      data-map-ready={ready}
      data-trace-count={trace.length}
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
