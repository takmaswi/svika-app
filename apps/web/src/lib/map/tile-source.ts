// Tile sourcing behind the standard adapter pattern (CLAUDE.md: every
// external service gets an adapter with a mock twin). Three providers feed
// the same Mbare Sun style, because every one of them speaks the
// OpenMapTiles schema:
//
//   selfhosted  the default: the Harare PMTiles extract served as a static
//               file, range requests via the pmtiles protocol. No vendor in
//               the ride path.
//   maptiler    the fallback when the self hosted file cannot load; the key
//               stays in env (NEXT_PUBLIC_MAP_TILES_URL, never in code).
//   mock        an empty fixture tile for tests and CI: the map renders
//               ground, overlays and markers with zero network dependency.
//
// The chain is ordered so the demo never dies because one source is down:
// the configured provider first, then whatever can still serve. Pure
// functions, unit tested in test/tile-source.test.ts.

import type { VectorSourceSpecification } from "maplibre-gl";

export type TileProviderName = "selfhosted" | "maptiler" | "mock";

export interface TileProviderEnv {
  /** NEXT_PUBLIC_MAP_PROVIDER; defaults to selfhosted. */
  provider?: string;
  /** NEXT_PUBLIC_MAP_TILES_URL: the raw MapTiler key (fallback provider). */
  maptilerKey?: string;
  /** NEXT_PUBLIC_MAP_PMTILES_URL: hosted PMTiles override; defaults to the local static file. */
  pmtilesUrl?: string;
}

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';

/** The static path the pipeline writes the Harare extract to. */
export const DEFAULT_PMTILES_PATH = "/map/tiles/harare.pmtiles";

export function maptilerTilesUrl(rawKey: string): string {
  if (!rawKey || rawKey.trim() === "") {
    throw new Error(
      "NEXT_PUBLIC_MAP_TILES_URL is empty: it must hold the raw MapTiler key",
    );
  }
  return `https://api.maptiler.com/tiles/v3/tiles.json?key=${encodeURIComponent(rawKey)}`;
}

function isProviderName(value: string | undefined): value is TileProviderName {
  return value === "selfhosted" || value === "maptiler" || value === "mock";
}

/**
 * The ordered provider chain for this environment: the configured provider
 * first, then the fallbacks that can actually serve (maptiler only joins
 * when its key is present), mock always last so the map never dies. An
 * explicit mock configuration stands alone: tests want determinism, not
 * silent network fallbacks.
 */
export function providerChain(env: TileProviderEnv): TileProviderName[] {
  const configured: TileProviderName = isProviderName(env.provider) ? env.provider : "selfhosted";
  if (configured === "mock") return ["mock"];
  const hasKey = Boolean(env.maptilerKey && env.maptilerKey.trim() !== "");
  const chain: TileProviderName[] = [];
  if (configured === "maptiler" && hasKey) chain.push("maptiler");
  if (!chain.includes("selfhosted")) chain.push("selfhosted");
  if (hasKey && !chain.includes("maptiler")) chain.push("maptiler");
  chain.push("mock");
  return chain;
}

/**
 * The openmaptiles vector source for a provider. `origin` is the absolute
 * origin of the app (window.location.origin); MapLibre needs absolute URLs
 * when the style is an object.
 */
export function tileSourceFor(
  name: TileProviderName,
  env: TileProviderEnv,
  origin: string,
): VectorSourceSpecification {
  switch (name) {
    case "selfhosted": {
      const url = env.pmtilesUrl?.trim() || `${origin}${DEFAULT_PMTILES_PATH}`;
      return {
        type: "vector",
        url: `pmtiles://${url}`,
        attribution: OSM_ATTRIBUTION,
      };
    }
    case "maptiler":
      return {
        type: "vector",
        url: maptilerTilesUrl(env.maptilerKey ?? ""),
        attribution: `${OSM_ATTRIBUTION} &copy; MapTiler`,
      };
    case "mock":
      return {
        type: "vector",
        // A committed zero byte fixture: a valid, empty vector tile for
        // every coordinate. The query string carries z/x/y so requests stay
        // distinct in logs; the static file ignores it.
        tiles: [`${origin}/map/mock/tile.pbf?z={z}&x={x}&y={y}`],
        minzoom: 0,
        maxzoom: 14,
        attribution: "Map fixture (tests)",
      };
  }
}
