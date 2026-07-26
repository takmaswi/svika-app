"use client";

// M4 bundle slice: the same treatment LiveMapLazy gives the home map. MapLibre
// is the heaviest thing in the app, and importing TraceMap directly dragged it
// into the first load of every journey screen (measured at 455 kB for
// /app/journeys/[id], 460 kB for /app/record, 418 kB for a shared guide link).
// Loading it on the client keeps the shell painting first on a cheap phone.
import dynamic from "next/dynamic";
import type { TraceMapProps } from "./TraceMap";

const Inner = dynamic(() => import("./TraceMap").then((m) => m.TraceMap), {
  ssr: false,
  loading: () => <div className="live-map" data-testid="live-map-loading" />,
});

export function TraceMapLazy(props: TraceMapProps) {
  return <Inner {...props} />;
}
