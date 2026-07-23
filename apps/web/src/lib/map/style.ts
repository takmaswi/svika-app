// The Mbare Sun map, native. The style is authored here from the DESIGN.md
// §2/§11 tokens instead of repainting a vendor style at runtime: the map
// starts from a checked in style document, no style fetch, no transform.
// Tiles follow the OpenMapTiles schema (Planetiler pipeline in
// tools/map-tiles), so the same style renders over the self hosted Harare
// PMTiles extract, the MapTiler fallback, or the mock fixture; the tile
// source is injected by lib/map/tile-source.ts. Glyphs (IBM Plex, §11) and
// the sprite sheet are self hosted under /map/. Pure functions, no map
// objects: the style is unit tested as data (test/map-style.test.ts).

import type {
  ExpressionSpecification,
  LayerSpecification,
  StyleSpecification,
  VectorSourceSpecification,
} from "maplibre-gl";

export type MapTheme = "day" | "night";

/** DESIGN.md §2 and §11 map colours, verbatim, per theme. */
export const MAP_COLORS = {
  day: {
    base: "#F4F5F1",
    building: "#EAECE5",
    roadCasing: "#E1E3DA",
    road: "#FFFFFF",
    minorRoad: "#FFFFFF",
    park: "#D9E8CC",
    streetLabel: "#6E766A",
    parkLabel: "#6E766A",
    route: "#161D18",
    routeOpacity: 0.85,
    stop: "#E84C30",
    stopStroke: "#FFFFFF",
    walk: "#575F53",
  },
  night: {
    base: "#121710",
    building: "#1B211A",
    roadCasing: "#222B22",
    road: "#333E33",
    minorRoad: "#2A342B",
    park: "#1B3423",
    streetLabel: "#7E877E",
    parkLabel: "#6F8F74",
    route: "#FFFFFF",
    routeOpacity: 0.75,
    stop: "#E84C30",
    stopStroke: "#FFFFFF",
    walk: "rgba(255, 255, 255, 0.55)",
  },
} as const;

// §11 type: street labels are IBM Plex Mono; places take the brand body
// font. Both stacks are self hosted (tools/map-tiles/build-glyphs.mjs).
export const STREET_LABEL_FONT = ["IBM Plex Mono SemiBold"];
export const PLACE_LABEL_FONT = ["IBM Plex Sans Regular"];

/** The id of the openmaptiles vector source every layer reads from. */
export const MAP_SOURCE_ID = "openmaptiles";

/** The flat building layer id and its 3D twin (toggled by LiveMap). */
export const BUILDING_LAYER_ID = "building";
export const BUILDING_3D_LAYER_ID = "building-3d";

// OpenMapTiles `transportation` classes, grouped into the §11 families.
const MAJOR_ROAD_CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary"];
const MINOR_ROAD_CLASSES = ["minor", "service"];
const PATH_CLASSES = ["path", "track"];

// Road width curves. §11 fixes the street level ratio (casing 17 / fill 11 /
// minor 5 at the reference screens' scale, which is ~z16); the curves land
// on those values there and taper sanely when zoomed out. Casing is drawn
// as a constant edge each side of the fill via line-gap-width, so it hugs
// the fill's own curve at every zoom (same treatment the runtime repaint
// proved).
const MAJOR_ROAD_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  6, 0.6,
  10, 1.2,
  13, 3,
  15, 7,
  16, 11,
  18, 20,
];
const MINOR_ROAD_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  12, 0.5,
  14, 2,
  16, 5,
  18, 10,
];
const PATH_WIDTH: ExpressionSpecification = [
  "interpolate", ["linear"], ["zoom"], 14, 1, 16, 2.5, 18, 5,
];

function roadFilter(classes: string[]): ExpressionSpecification {
  return [
    "all",
    ["==", ["geometry-type"], "LineString"],
    ["in", ["get", "class"], ["literal", classes]],
  ];
}

export interface MapStyleOptions {
  /**
   * The openmaptiles vector source, supplied by the tile source adapter
   * (self hosted PMTiles by default, MapTiler fallback, mock in tests).
   */
  source: VectorSourceSpecification;
  /**
   * Absolute origin the glyph and sprite URLs hang off (MapLibre needs
   * absolute URLs when the style is an object). window.location.origin in
   * the app; any placeholder in tests.
   */
  origin: string;
}

/**
 * The Mbare Sun style for a theme, layer order per §11: base → park →
 * buildings → road casing → road fill → minor roads → street labels.
 * Water joins the park family (no spec value of its own — recorded spec
 * gap; the corridor has no visible water). The route, stop pins and kombi
 * markers are runtime layers LiveMap draws on top.
 */
export function buildMbareSunStyle(theme: MapTheme, opts: MapStyleOptions): StyleSpecification {
  const c = MAP_COLORS[theme];
  const layers: LayerSpecification[] = [
    {
      id: "background",
      type: "background",
      paint: { "background-color": c.base },
    },
    {
      id: "landcover-green",
      type: "fill",
      source: MAP_SOURCE_ID,
      "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["grass", "wood"]]],
      paint: { "fill-color": c.park },
    },
    {
      id: "park",
      type: "fill",
      source: MAP_SOURCE_ID,
      "source-layer": "park",
      paint: { "fill-color": c.park },
    },
    {
      id: "water",
      type: "fill",
      source: MAP_SOURCE_ID,
      "source-layer": "water",
      paint: { "fill-color": c.park },
    },
    {
      id: "waterway",
      type: "line",
      source: MAP_SOURCE_ID,
      "source-layer": "waterway",
      paint: { "line-color": c.park, "line-width": 1.5 },
    },
    {
      id: BUILDING_LAYER_ID,
      type: "fill",
      source: MAP_SOURCE_ID,
      "source-layer": "building",
      minzoom: 13,
      paint: { "fill-color": c.building },
    },
    {
      id: BUILDING_3D_LAYER_ID,
      type: "fill-extrusion",
      source: MAP_SOURCE_ID,
      "source-layer": "building",
      minzoom: 13,
      // Off by default: 3D is a progressive enhancement LiveMap toggles on
      // capable devices only. Heights come from OSM where mapped
      // (render_height), with a modest single storey default where absent.
      layout: { visibility: "none" },
      paint: {
        "fill-extrusion-color": c.building,
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      },
    },
    {
      id: "road-minor-casing",
      type: "line",
      source: MAP_SOURCE_ID,
      "source-layer": "transportation",
      filter: roadFilter(MINOR_ROAD_CLASSES),
      minzoom: 12,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": c.roadCasing,
        "line-width": 2.5,
        "line-gap-width": MINOR_ROAD_WIDTH,
      },
    },
    {
      id: "road-casing",
      type: "line",
      source: MAP_SOURCE_ID,
      "source-layer": "transportation",
      filter: roadFilter(MAJOR_ROAD_CLASSES),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": c.roadCasing,
        "line-width": 3,
        "line-gap-width": MAJOR_ROAD_WIDTH,
      },
    },
    {
      id: "road-path",
      type: "line",
      source: MAP_SOURCE_ID,
      "source-layer": "transportation",
      filter: roadFilter(PATH_CLASSES),
      minzoom: 14,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": c.minorRoad,
        "line-width": PATH_WIDTH,
        ...(theme === "day" ? { "line-opacity": 0.9 } : {}),
      },
    },
    {
      id: "road-minor",
      type: "line",
      source: MAP_SOURCE_ID,
      "source-layer": "transportation",
      filter: roadFilter(MINOR_ROAD_CLASSES),
      minzoom: 12,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": c.minorRoad, "line-width": MINOR_ROAD_WIDTH },
    },
    {
      id: "road",
      type: "line",
      source: MAP_SOURCE_ID,
      "source-layer": "transportation",
      filter: roadFilter(MAJOR_ROAD_CLASSES),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": c.road, "line-width": MAJOR_ROAD_WIDTH },
    },
    {
      id: "railway",
      type: "line",
      source: MAP_SOURCE_ID,
      "source-layer": "transportation",
      filter: roadFilter(["rail", "transit"]),
      minzoom: 12,
      paint: { "line-color": c.roadCasing, "line-width": 1.5 },
    },
    {
      id: "park-label",
      type: "symbol",
      source: MAP_SOURCE_ID,
      "source-layer": "park",
      minzoom: 13,
      filter: ["has", "name"],
      layout: {
        "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
        "text-font": [...PLACE_LABEL_FONT],
        "text-size": 10.5,
        "text-max-width": 8,
      },
      paint: {
        "text-color": c.parkLabel,
        "text-halo-color": c.base,
        "text-halo-width": 1.2,
      },
    },
    {
      id: "street-label",
      type: "symbol",
      source: MAP_SOURCE_ID,
      "source-layer": "transportation_name",
      minzoom: 13,
      layout: {
        "symbol-placement": "line",
        "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
        "text-font": [...STREET_LABEL_FONT],
        "text-size": 9,
        "text-letter-spacing": 0.07,
      },
      paint: {
        "text-color": c.streetLabel,
        "text-halo-color": c.base,
        "text-halo-width": 1.4,
      },
    },
    {
      id: "place-suburb",
      type: "symbol",
      source: MAP_SOURCE_ID,
      "source-layer": "place",
      minzoom: 11,
      filter: ["in", ["get", "class"], ["literal", ["suburb", "neighbourhood", "village", "hamlet"]]],
      layout: {
        "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
        "text-font": [...PLACE_LABEL_FONT],
        "text-size": 10.5,
        "text-max-width": 8,
      },
      paint: {
        "text-color": c.streetLabel,
        "text-halo-color": c.base,
        "text-halo-width": 1.2,
      },
    },
    {
      id: "place-city",
      type: "symbol",
      source: MAP_SOURCE_ID,
      "source-layer": "place",
      filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
      layout: {
        "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
        "text-font": [...PLACE_LABEL_FONT],
        "text-size": 12.5,
        "text-max-width": 8,
      },
      paint: {
        "text-color": c.streetLabel,
        "text-halo-color": c.base,
        "text-halo-width": 1.2,
      },
    },
  ];

  return {
    version: 8,
    name: `Svika Mbare Sun (${theme})`,
    glyphs: `${opts.origin}/map/fonts/{fontstack}/{range}.pbf`,
    sprite: `${opts.origin}/map/sprite/sprite`,
    sources: { [MAP_SOURCE_ID]: opts.source },
    layers,
  };
}
