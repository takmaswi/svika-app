"use client";

// M4 bundle slice, same reasoning as TraceMapLazy: importing PlacesMap
// directly put MapLibre in the first load of /app/places (measured at 456 kB).
import dynamic from "next/dynamic";
import type { PlacesMapProps } from "./PlacesMap";

const Inner = dynamic(() => import("./PlacesMap").then((m) => m.PlacesMap), {
  ssr: false,
  loading: () => <div className="live-map" data-testid="live-map-loading" />,
});

export function PlacesMapLazy(props: PlacesMapProps) {
  return <Inner {...props} />;
}
