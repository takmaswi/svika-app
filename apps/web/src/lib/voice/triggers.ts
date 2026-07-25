// The voice guide's geofence engine: pure distance maths along the corridor
// line, fed by the same vehicle positions the map draws. Thresholds come
// from the recorded speed profile (the corridor averages ~20 km/h riding,
// so 900 m reads as roughly two minutes out; Spine 1's eta serves the same
// signal server side). Each cue fires exactly once, in order, and the walk
// cue only exists when the trip really continues on foot.

export type VoiceCue = "approaching" | "getOff" | "walk";

/** Roughly two minutes out at the corridor's recorded riding speed. */
export const APPROACH_METERS = 900;
/** On the stop: close enough to stand up. */
export const GET_OFF_METERS = 80;
/** The kombi has moved on; the rider is off and the walking leg begins. */
export const WALK_PAST_METERS = 60;

export interface VoiceTrip {
  /** The alight stop's distance along the corridor line, in metres. */
  targetMeters: number;
  direction: "outbound" | "inbound";
  /** True when another boarding waits at a different stop: a walking leg. */
  hasWalkAfter: boolean;
}

/**
 * Distance still to ride toward the stop: positive approaching, zero at the
 * stop, negative once past it.
 */
export function metersToStop(trip: VoiceTrip, travelMeters: number): number {
  return trip.direction === "outbound"
    ? trip.targetMeters - travelMeters
    : travelMeters - trip.targetMeters;
}

/**
 * V3 ruling 3 (2026-07-26): the cues that mean "you are there" open the
 * skippable one tap arrival confirm. The prompt only ever asks; arrival is
 * the rider's word, never auto confirmed on their behalf.
 */
export function promptsArrival(cue: VoiceCue): boolean {
  return cue === "getOff" || cue === "walk";
}

export class VoiceTriggerEngine {
  private fired = new Set<VoiceCue>();

  constructor(private readonly trip: VoiceTrip) {}

  /**
   * The cue this position earns, or null. Cues are one shot and ordered;
   * jumping straight into the get off band still marks approaching as done.
   */
  next(travelMeters: number, direction: "outbound" | "inbound"): VoiceCue | null {
    if (direction !== this.trip.direction) return null;
    const distance = metersToStop(this.trip, travelMeters);

    if (distance < -WALK_PAST_METERS) {
      if (this.trip.hasWalkAfter && !this.fired.has("walk")) {
        this.fired.add("approaching").add("getOff").add("walk");
        return "walk";
      }
      return null;
    }
    if (distance <= GET_OFF_METERS) {
      if (!this.fired.has("getOff")) {
        this.fired.add("approaching").add("getOff");
        return "getOff";
      }
      return null;
    }
    if (distance <= APPROACH_METERS && !this.fired.has("approaching")) {
      this.fired.add("approaching");
      return "approaching";
    }
    return null;
  }
}
