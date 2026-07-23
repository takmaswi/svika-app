// 3D map capability gate (M0). 3D buildings are a progressive enhancement:
// a toggle, off by default, and never offered at all on devices that would
// stutter. The reference device is a cheap 360px Android; if 3D cannot hold
// frame rate there it demotes to roadmap, so the gate errs on the side of
// staying flat. Pure function, unit tested.

/** Camera pitch when 3D is on. */
export const THREE_D_PITCH = 55;

/** deviceMemory (GiB) below which 3D is never offered. */
export const MIN_DEVICE_MEMORY_GB = 4;

export interface ThreeDSignals {
  /** navigator.deviceMemory; undefined where unsupported (iOS, Firefox). */
  deviceMemory: number | undefined;
  /** prefers-reduced-motion: reduce. */
  reducedMotion: boolean;
}

/**
 * Whether the 3D toggle is offered. Reduced motion always wins (a pitching
 * camera is motion). Devices that report low memory are excluded; devices
 * that do not report it at all are allowed, because the API is absent on
 * whole platforms (iOS) that include very capable phones.
 */
export function canOffer3d(signals: ThreeDSignals): boolean {
  if (signals.reducedMotion) return false;
  if (signals.deviceMemory !== undefined && signals.deviceMemory < MIN_DEVICE_MEMORY_GB) {
    return false;
  }
  return true;
}
