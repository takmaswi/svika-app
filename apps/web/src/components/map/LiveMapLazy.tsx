"use client";

// MapLibre is the heaviest thing in the app; it loads lazily on the client
// so the home shell paints instantly on a cheap phone, with a warm linen
// placeholder holding the space while the map arrives.
import dynamic from "next/dynamic";
import type { LiveMapLabels, LiveMapOverlay } from "./LiveMap";

const Inner = dynamic(() => import("./LiveMap").then((m) => m.LiveMap), {
  ssr: false,
  loading: () => <div className="live-map" data-testid="live-map-loading" />,
});

export function LiveMapLazy({
  labels,
  overlay,
  camera,
}: {
  labels: LiveMapLabels;
  overlay?: LiveMapOverlay;
  camera?: "corridor" | "boarding";
}) {
  return <Inner labels={labels} overlay={overlay} camera={camera} />;
}
