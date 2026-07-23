// When does THIS kombi reach that stop, by the simulation's own clock. The
// spine answers with a learned number from recorded rides; when it cannot
// serve, this is the mock twin's per-vehicle answer, labelled a demo
// estimate like every mock number. The simulation is a pure function of
// wall clock time (vehicle-feed.ts), so the crossing moment is exact: no
// average speeds, no guesswork, just the recorded curve read forward.
import {
  profileMetersAt,
  type DirectionProfile,
  type SimulatedVehicle,
  type SimulationConfig,
} from "../map/vehicle-feed";
import type { CorridorDirectionName } from "../map/corridor";

/** First leg second at/after `fromSeconds` where the profile crosses
 *  `targetMeters` in its direction of travel, or null when already past. */
function crossingSeconds(
  profile: DirectionProfile,
  fromSeconds: number,
  targetMeters: number,
  travellingOutbound: boolean,
): number | null {
  const here = profileMetersAt(profile, fromSeconds);
  const passed = travellingOutbound ? here > targetMeters : here < targetMeters;
  if (passed) return null;
  // the profile is monotone in time, so binary search lands on the crossing
  let lo = fromSeconds;
  let hi = profile.durationSeconds;
  const endMeters = profileMetersAt(profile, hi);
  const reachable = travellingOutbound ? endMeters >= targetMeters : endMeters <= targetMeters;
  if (!reachable) return null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const m = profileMetersAt(profile, mid);
    const before = travellingOutbound ? m < targetMeters : m > targetMeters;
    if (before) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * Milliseconds until the vehicle crosses `targetMeters` travelling
 * `direction`, counting any rank dwell it is currently sitting in. Null when
 * the kombi is running the other way, or has already passed the target on
 * this leg: the honest card state for both is "not coming to your stop right
 * now", never an invented number.
 */
export function simEtaMsToTarget(
  config: SimulationConfig,
  vehicle: SimulatedVehicle,
  elapsedMs: number,
  targetMeters: number,
  direction: CorridorDirectionName,
): number | null {
  const outMs = config.profiles.outbound.durationSeconds * 1000;
  const inMs = config.profiles.inbound.durationSeconds * 1000;
  const dwellMs = config.dwellSeconds * 1000;
  const cycleMs = outMs + inMs + 2 * dwellMs;

  const shifted = elapsedMs + vehicle.phaseSeconds * 1000;
  const t = ((shifted % cycleMs) + cycleMs) % cycleMs;

  // segment boundaries within one cycle: out, far dwell, back, near dwell
  if (t < outMs) {
    if (direction !== "outbound") return null;
    const s = crossingSeconds(config.profiles.outbound, t / 1000, targetMeters, true);
    return s === null ? null : s * 1000 - t;
  }
  if (t < outMs + dwellMs) {
    if (direction !== "inbound") return null;
    const wait = outMs + dwellMs - t;
    const s = crossingSeconds(config.profiles.inbound, 0, targetMeters, false);
    return s === null ? null : wait + s * 1000;
  }
  if (t < outMs + dwellMs + inMs) {
    if (direction !== "inbound") return null;
    const legT = (t - outMs - dwellMs) / 1000;
    const s = crossingSeconds(config.profiles.inbound, legT, targetMeters, false);
    return s === null ? null : s * 1000 - legT * 1000;
  }
  if (direction !== "outbound") return null;
  const wait = cycleMs - t;
  const s = crossingSeconds(config.profiles.outbound, 0, targetMeters, true);
  return s === null ? null : wait + s * 1000;
}
