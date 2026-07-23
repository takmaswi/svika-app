"use client";

// The live map: the visual heart of the rider app. Mbare Sun cartography
// (DESIGN.md §11), the real Heights <-> Rezende road as the dotted route, the
// 15 real stops, and kombis gliding along the actual line. Movement comes
// from the VehicleFeed adapter; today that is the simulated mock twin
// (declared in the disclosure register), and a real GPS feed swaps in
// without touching this component. Camera policy lives in docs/MAP-CAMERA.md;
// the movement pipeline is documented in docs/MAP-MOVEMENT.md.
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { clampFitPadding } from "@/lib/map/camera-fit";
import { corridorLine, corridorMetrics, corridorStops } from "@/lib/map/corridor-data";
import {
  measurePolyline,
  sliceAtDistances,
  type LngLat,
  type PolylineMetrics,
} from "@/lib/map/geometry";
import { SIM_EPOCH_MS, SIM_VEHICLES, simConfig } from "@/lib/map/sim-config";
import { MAP_COLORS, mapStyleUrl, mbareSunStyle, type MapTheme } from "@/lib/map/style";
import {
  SimulatedVehicleFeed,
  type VehicleFeed,
  type VehiclePosition,
} from "@/lib/map/vehicle-feed";

const TICK_MS = 1000;

// §11 route: stroke 5, dasharray 1 11 (in line-width units at width 5).
const ROUTE_WIDTH = 5;
const ROUTE_DASH = [0.2, 2.2];

// §12 entrance order on map screens: route draws, then pins, then kombis.
const DRAW_DELAY_MS = 400;
const DRAW_MS = 1300;
const PINS_AT_MS = DRAW_DELAY_MS + DRAW_MS;
const PIN_FADE_MS = 450;
const KOMBIS_AT_MS = PINS_AT_MS + PIN_FADE_MS;

export interface LiveMapLabels {
  ariaLabel: string;
  demoChip: string;
  unavailable: string;
  /** Camera toggle copy; required for the boarding camera. */
  viewWhole?: string;
  viewNear?: string;
}

/** A planned trip drawn over the corridor; see lib/map/plan-overlay.ts. */
export interface LiveMapOverlay {
  legs: { kind: "ride" | "walk"; coordinates: LngLat[] }[];
  origin: LngLat;
  destination: LngLat;
}

interface LiveMapProps {
  labels: LiveMapLabels;
  overlay?: LiveMapOverlay;
  /**
   * Camera policy (docs/MAP-CAMERA.md). "corridor" fits the whole route
   * (landing hero). "boarding" opens on the rank the home sheet quotes plus
   * the nearest kombi, whole corridor one tap away. An overlay always wins:
   * the camera frames the planned trip above the sheet.
   */
  camera?: "corridor" | "boarding";
}

/** The active Mbare Sun map theme, from the same signals the CSS tokens use. */
function currentMapTheme(): MapTheme {
  const forced = document.documentElement.dataset.theme;
  if (forced === "dark") return "night";
  if (forced === "light") return "day";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
}

function boundsOf(coords: LngLat[]): [LngLat, LngLat] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
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

function overlayBounds(overlay: LiveMapOverlay): [LngLat, LngLat] {
  return boundsOf([
    overlay.origin,
    overlay.destination,
    ...overlay.legs.flatMap((l) => l.coordinates),
  ]);
}

// The rank the home sheet quotes ("From {first stop}") plus the kombi
// nearest to it right now, so the opening frame always holds a moving kombi
// and the stops around the rank. Falls back to the rank stretch if the feed
// cannot answer (a real GPS feed with no fix yet).
function boardingBounds(feed: VehicleFeed): [LngLat, LngLat] {
  const rank = corridorLine.coordinates[0]!;
  const nearStops = corridorStops.slice(0, 2).map((s) => s.lngLat);
  const positions = feed.sample?.(Date.now()) ?? [];
  let nearest: LngLat | null = null;
  let best = Infinity;
  for (const p of positions) {
    const d = Math.hypot(p.lngLat[0] - rank[0], p.lngLat[1] - rank[1]);
    if (d < best) {
      best = d;
      nearest = p.lngLat;
    }
  }
  return boundsOf([rank, ...nearStops, ...(nearest ? [nearest] : [])]);
}

// The camera never hides what matters under the chrome: top padding clears
// the chips and demo pill, bottom clears the peeking sheet (396px + margin).
const BOARDING_FIT: maplibregl.FitBoundsOptions = {
  padding: { top: 150, right: 40, bottom: 420, left: 40 },
  maxZoom: 15,
};
const CORRIDOR_HOME_FIT: maplibregl.FitBoundsOptions = {
  padding: { top: 150, right: 40, bottom: 420, left: 40 },
};

// Deviation from §10/§11 (docs/DESIGN-DEVIATIONS.md): on the live map the
// client's kombi asset IS the marker, standalone at its pre reskin 44px,
// rotating with the road. Bob, night glow and headlight beam stay. The
// marigold box language remains everywhere that is not a live map marker.
function makeKombiElement(entering: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `kombi-map-marker${entering ? " kombi-map-enter" : ""}`;
  el.dataset.testid = "kombi-marker";
  el.innerHTML = `
    <div class="kombi-map-bob svika-bob">
      <svg class="kombi-beam" width="140" height="140" viewBox="-70 -70 140 140" aria-hidden="true">
        <g transform="rotate(-90)">
          <path d="M13 -5 L68 -28 L68 28 L13 5 Z" fill="#F5B301" opacity="0.12"></path>
          <path d="M13 -4 L48 -16 L48 16 L13 4 Z" fill="#F5B301" opacity="0.15"></path>
        </g>
      </svg>
      <img class="kombi-map-img" src="/map/kombi-marker.svg" alt="" width="44" height="44" draggable="false" />
    </div>`;
  return el;
}

// The planned trip over the corridor: ride legs take THE route treatment,
// walking legs are dashed, and both ends get §11 stop pins.
function addOverlayLayers(
  map: maplibregl.Map,
  overlay: LiveMapOverlay,
  theme: MapTheme,
  hidden: boolean,
) {
  const c = MAP_COLORS[theme];
  const legFeatures = overlay.legs.map((l) => ({
    type: "Feature" as const,
    properties: { kind: l.kind },
    geometry: { type: "LineString" as const, coordinates: l.coordinates },
  }));
  map.addSource("plan-legs", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: hidden ? [] : legFeatures,
    },
  });
  map.addSource("plan-ends", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature" as const,
          properties: { end: "origin" },
          geometry: { type: "Point" as const, coordinates: overlay.origin },
        },
        {
          type: "Feature" as const,
          properties: { end: "destination" },
          geometry: { type: "Point" as const, coordinates: overlay.destination },
        },
      ],
    },
  });

  map.addLayer({
    id: "plan-ride-line",
    type: "line",
    source: "plan-legs",
    filter: ["==", ["get", "kind"], "ride"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": c.route,
      "line-width": ROUTE_WIDTH,
      "line-dasharray": ROUTE_DASH,
      "line-opacity": c.routeOpacity,
    },
  });
  map.addLayer({
    id: "plan-walk-line",
    type: "line",
    source: "plan-legs",
    filter: ["==", ["get", "kind"], "walk"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": c.walk,
      "line-width": 3.5,
      "line-dasharray": [0.1, 1.8],
    },
  });
  map.addLayer({
    id: "plan-ends",
    type: "circle",
    source: "plan-ends",
    paint: {
      "circle-radius": 7,
      "circle-color": c.stop,
      "circle-stroke-width": 3,
      "circle-stroke-color": c.stopStroke,
      "circle-opacity": hidden ? 0 : 1,
      "circle-stroke-opacity": hidden ? 0 : 1,
    },
  });
}

function addCorridorLayers(
  map: maplibregl.Map,
  theme: MapTheme,
  muted: boolean,
  hidden: boolean,
) {
  const c = MAP_COLORS[theme];
  map.addSource("corridor-route", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        // during the entrance the route grows from the rank (§12 svk-draw);
        // a muted corridor under a plan is context and never animates
        coordinates:
          hidden && !muted
            ? sliceAtDistances(corridorMetrics, 0, 1)
            : corridorLine.coordinates,
      },
    },
  });
  map.addSource("corridor-stops", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: corridorStops.map((s) => ({
        type: "Feature" as const,
        properties: { name: s.name, order: s.order },
        geometry: { type: "Point" as const, coordinates: s.lngLat },
      })),
    },
  });

  // THE route: dotted char by day, dotted white by night (§11). Under a plan
  // overlay the corridor fades to context so the trip reads.
  map.addLayer({
    id: "corridor-route-line",
    type: "line",
    source: "corridor-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": c.route,
      "line-width": ROUTE_WIDTH,
      "line-dasharray": ROUTE_DASH,
      "line-opacity": muted ? c.routeOpacity * 0.35 : c.routeOpacity,
    },
  });
  map.addLayer({
    id: "corridor-stop-dots",
    type: "circle",
    source: "corridor-stops",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4, 15, 7],
      "circle-color": c.stop,
      "circle-stroke-color": c.stopStroke,
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 11, 2, 15, 3],
      "circle-opacity": hidden ? 0 : muted ? 0.5 : 1,
      "circle-stroke-opacity": hidden ? 0 : muted ? 0.5 : 1,
    },
  });
  map.addLayer({
    id: "corridor-stop-labels",
    type: "symbol",
    source: "corridor-stops",
    minzoom: 12,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["IBM Plex Mono SemiBold"],
      "text-size": 9,
      "text-letter-spacing": 0.07,
      "text-offset": [0, 1.3],
      "text-anchor": "top",
      "text-max-width": 9,
    },
    paint: {
      "text-color": c.streetLabel,
      "text-halo-color": c.base,
      "text-halo-width": 1.4,
      "text-opacity": hidden ? 0 : 1,
    },
  });
}

export function LiveMap({ labels, overlay, camera = "corridor" }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const feedRef = useRef<VehicleFeed | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [wide, setWide] = useState(false);

  // Cache the corridor's MapTiler tiles so the map loads fast on a cheap phone
  // and repeat views do not burn the MapTiler quota. The worker only ever
  // touches MapTiler requests; Supabase, app pages and everything else pass
  // straight through (see public/sw.js). Registered here so it only loads on
  // map bearing screens.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // no cache is fine; the map still loads straight from MapTiler
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const key = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "";
    if (!container || key.trim() === "") {
      setFailed(true);
      return;
    }

    let disposed = false;
    let map: maplibregl.Map | null = null;
    let unsubscribe: (() => void) | null = null;
    let raf = 0;
    let entranceRaf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let theme = currentMapTheme();
    let rawStyle: unknown = null;
    let entrancePending = false;
    const markers = new Map<string, maplibregl.Marker>();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const themeObserver = new MutationObserver(applyTheme);

    // Repaints the whole canvas when the theme flips; style.load re-adds the
    // corridor and plan layers, markers restyle through CSS tokens.
    function applyTheme() {
      const next = currentMapTheme();
      if (disposed || !map || !rawStyle || next === theme) return;
      theme = next;
      map.setStyle(mbareSunStyle(rawStyle, theme) as maplibregl.StyleSpecification);
    }

    // §12: route draws (1.3s after a .4s beat), pins fade in, kombis arrive.
    // The corridor grows by road distance, so the dots appear in road order.
    function playEntrance(m: maplibregl.Map) {
      entrancePending = false;
      const drawTarget: PolylineMetrics | null = overlay ? null : corridorMetrics;
      const legMetrics = overlay
        ? overlay.legs.map((l) =>
            l.coordinates.length >= 2 ? measurePolyline(l.coordinates) : null,
          )
        : [];
      const t0 = performance.now() + DRAW_DELAY_MS;
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const grow = () => {
        if (disposed) return;
        const p = Math.min(Math.max((performance.now() - t0) / DRAW_MS, 0), 1);
        const f = ease(p);
        if (drawTarget) {
          const src = m.getSource("corridor-route") as
            | maplibregl.GeoJSONSource
            | undefined;
          src?.setData({
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: sliceAtDistances(
                drawTarget,
                0,
                Math.max(drawTarget.totalMeters * f, 1),
              ),
            },
          });
        } else if (overlay) {
          const src = m.getSource("plan-legs") as maplibregl.GeoJSONSource | undefined;
          src?.setData({
            type: "FeatureCollection",
            features: overlay.legs.map((l, i) => {
              const lm = legMetrics[i];
              return {
                type: "Feature" as const,
                properties: { kind: l.kind },
                geometry: {
                  type: "LineString" as const,
                  coordinates: lm
                    ? sliceAtDistances(lm, 0, Math.max(lm.totalMeters * f, 1))
                    : l.coordinates,
                },
              };
            }),
          });
        }
        if (p < 1) entranceRaf = requestAnimationFrame(grow);
      };
      entranceRaf = requestAnimationFrame(grow);

      timers.push(
        setTimeout(() => {
          if (disposed || !map) return;
          const fade = (layer: string, props: [string, unknown][]) => {
            if (!map?.getLayer(layer)) return;
            for (const [prop, value] of props) {
              map.setPaintProperty(layer, `${prop}-transition`, {
                duration: PIN_FADE_MS,
              });
              map.setPaintProperty(layer, prop, value);
            }
          };
          fade("corridor-stop-dots", [
            ["circle-opacity", overlay ? 0.5 : 1],
            ["circle-stroke-opacity", overlay ? 0.5 : 1],
          ]);
          fade("corridor-stop-labels", [["text-opacity", 1]]);
          fade("plan-ends", [
            ["circle-opacity", 1],
            ["circle-stroke-opacity", 1],
          ]);
        }, PINS_AT_MS),
      );
    }

    async function start() {
      const res = await fetch(mapStyleUrl(key));
      if (!res.ok) throw new Error(`map style fetch failed: ${res.status}`);
      rawStyle = await res.json();
      if (disposed || !container) return;

      // The fixed epoch keeps these markers in step with the server side
      // ETA caller, which measures from the same simulated fleet.
      const feed: VehicleFeed = new SimulatedVehicleFeed(simConfig, SIM_VEHICLES, {
        tickMs: TICK_MS,
        epochMs: SIM_EPOCH_MS,
      });
      feedRef.current = feed;

      const bounds = overlay
        ? overlayBounds(overlay)
        : camera === "boarding"
          ? boardingBounds(feed)
          : boundsOf(corridorLine.coordinates);
      const rawFit = overlay
        ? // under a plan the bottom sheet peeks over the map; the trip must
          // fit in the visible band above it
          { padding: { top: 72, left: 48, right: 48, bottom: 356 } }
        : camera === "boarding"
          ? BOARDING_FIT
          : { padding: 48 };
      // in a short container paddings that meet the box strand fitBounds on
      // the world view, so clamp them
      const fitBoundsOptions = {
        ...rawFit,
        padding: clampFitPadding(
          container.clientWidth,
          container.clientHeight,
          rawFit.padding ?? 0,
        ),
      };

      entrancePending = !reducedMotion;
      map = new maplibregl.Map({
        container,
        style: mbareSunStyle(rawStyle, theme) as maplibregl.StyleSpecification,
        bounds,
        fitBoundsOptions,
        // added by hand below: bottom right would hide under the peek sheet
        attributionControl: false,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");
      mapRef.current = map;
      map.touchPitch.disable();

      // Fires on the first style and again after every theme swap. A theme
      // swap mid entrance lands everything in its final state.
      map.on("style.load", () => {
        if (!map || disposed) return;
        const hidden = entrancePending;
        addCorridorLayers(map, theme, Boolean(overlay), hidden);
        if (overlay) addOverlayLayers(map, overlay, theme, hidden);
      });

      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      darkQuery.addEventListener("change", applyTheme);

      map.on("load", () => {
        if (!map || disposed) return;
        setReady(true);

        const entering = !reducedMotion;
        if (entering) playEntrance(map);

        const apply = (positions: VehiclePosition[], stampData: boolean) => {
          if (!map || disposed) return;
          for (const pos of positions) {
            let marker = markers.get(pos.id);
            if (!marker) {
              marker = new maplibregl.Marker({
                element: makeKombiElement(entering),
                rotationAlignment: "map",
                pitchAlignment: "map",
                // fractional pixel transforms: without this MapLibre rounds
                // the projected point and slow kombis tick pixel by pixel
                subpixelPositioning: true,
              })
                .setLngLat(pos.lngLat)
                .setRotation(pos.headingDeg)
                .addTo(map);
              markers.set(pos.id, marker);
            } else {
              marker.setLngLat(pos.lngLat).setRotation(pos.headingDeg);
            }
            if (stampData) {
              // e2e reads these to prove movement in coordinates, not pixels
              const el = marker.getElement();
              el.dataset.lng = String(pos.lngLat[0]);
              el.dataset.lat = String(pos.lngLat[1]);
              el.dataset.heading = String(Math.round(pos.headingDeg));
            }
          }
        };

        const begin = () => {
          if (disposed) return;
          if (reducedMotion || !feed.sample) {
            // Discrete once-a-second steps: no gliding under reduced motion,
            // and a future real GPS feed lands here until it earns smoothing.
            unsubscribe = feed.subscribe((positions) => apply(positions, true));
          } else {
            // The simulation is a pure function of wall clock time, so every
            // frame samples the exact position along the recorded road line:
            // no interpolation between ticks, no cut corners, no teleporting.
            const sample = feed.sample.bind(feed);
            let lastStamp = 0;
            const frame = () => {
              if (disposed) return;
              const stamp = performance.now() - lastStamp > TICK_MS;
              if (stamp) lastStamp = performance.now();
              apply(sample(Date.now()), stamp);
              raf = requestAnimationFrame(frame);
            };
            raf = requestAnimationFrame(frame);
          }
        };
        // §12: kombis join after the route has drawn and the pins are in
        if (entering) timers.push(setTimeout(begin, KOMBIS_AT_MS));
        else begin();
      });

      map.on("error", () => {
        // Tile or glyph hiccups should never take the home page down; the
        // map keeps whatever it has already drawn.
      });
    }

    start().catch(() => {
      if (!disposed) setFailed(true);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(entranceRaf);
      for (const t of timers) clearTimeout(t);
      themeObserver.disconnect();
      darkQuery.removeEventListener("change", applyTheme);
      unsubscribe?.();
      map?.remove();
      mapRef.current = null;
      feedRef.current = null;
    };
  }, []);

  // One tap between the boarding view and the whole corridor; the pinch
  // gesture stays live throughout. Reduced motion jumps without easing.
  const toggleView = () => {
    const map = mapRef.current;
    const feed = feedRef.current;
    if (!map || !feed) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : 900;
    const box = map.getContainer();
    const clamp = (padding: maplibregl.PaddingOptions | number) =>
      clampFitPadding(box.clientWidth, box.clientHeight, padding);
    if (wide) {
      map.fitBounds(boardingBounds(feed), {
        ...BOARDING_FIT,
        padding: clamp(BOARDING_FIT.padding ?? 0),
        duration,
      });
    } else {
      map.fitBounds(boundsOf(corridorLine.coordinates), {
        ...CORRIDOR_HOME_FIT,
        padding: clamp(CORRIDOR_HOME_FIT.padding ?? 0),
        duration,
      });
    }
    setWide((v) => !v);
  };

  if (failed) {
    return (
      <div className="live-map live-map-unavailable" data-testid="live-map">
        <p className="svika-body">{labels.unavailable}</p>
      </div>
    );
  }

  return (
    <div className="live-map" data-testid="live-map" data-map-ready={ready}>
      <div
        ref={containerRef}
        className="live-map-canvas"
        role="img"
        aria-label={labels.ariaLabel}
      />
      <span className="live-map-chip svika-glass" data-testid="demo-chip">
        <span className="svika-live-dot">
          <span className="svika-ripple-ring" aria-hidden />
          <span className="svika-pulse-dot" aria-hidden />
        </span>
        {labels.demoChip}
      </span>
      {camera === "boarding" && ready && labels.viewWhole && labels.viewNear && (
        <button
          type="button"
          className="live-map-view-toggle svika-glass touch-target"
          data-testid="map-view-toggle"
          onClick={toggleView}
        >
          {wide ? labels.viewNear : labels.viewWhole}
        </button>
      )}
    </div>
  );
}
