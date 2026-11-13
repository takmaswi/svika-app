// Map attribution placement. Pre launch it sits open, top right. Under
// launch-v2 (plan Step 1.7) it is a small info button bottom left that
// opens the credits on tap; MapLibre's compact control starts open, so it
// is folded once the credits have rendered.
import maplibregl from "maplibre-gl";

export function addAttribution(map: maplibregl.Map): void {
  const v2 = typeof document !== "undefined" && document.documentElement.dataset.ui === "v2";
  if (!v2) {
    map.addControl(new maplibregl.AttributionControl({ compact: false }), "top-right");
    return;
  }
  const control = new maplibregl.AttributionControl({ compact: true });
  map.addControl(control, "bottom-left");
  const fold = () => {
    const el = map.getContainer().querySelector(".maplibregl-ctrl-attrib.maplibregl-compact");
    if (!el) return false;
    el.classList.remove("maplibregl-compact-show");
    el.removeAttribute("open");
    return true;
  };
  if (!fold()) {
    const onData = () => {
      if (fold()) map.off("data", onData);
    };
    map.on("data", onData);
  }
}
