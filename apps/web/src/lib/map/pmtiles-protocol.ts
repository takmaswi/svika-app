// Registers the pmtiles:// protocol with MapLibre exactly once. Split from
// the tile source adapter so the adapter stays pure data (unit testable in
// node) while this module owns the maplibre side effect.

import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";

let registered = false;

export function ensurePmtilesProtocol(): void {
  if (registered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  registered = true;
}
