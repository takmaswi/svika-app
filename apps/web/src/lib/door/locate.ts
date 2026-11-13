// The phone's position as the plan URL carries it (rounded, see ends.ts).
// Asked for only when the rider has chosen where to go.
import { locationParam } from "./ends";

export function whereAmI(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("no geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(locationParam(pos.coords.latitude, pos.coords.longitude)),
      reject,
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}
