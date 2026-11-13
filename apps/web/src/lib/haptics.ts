// Plan Step 1.5: a short vibration when a rider confirms something (a trip
// saved, later "I boarded here"). Only with the launch-v2 system on, only
// where the phone has a vibration motor, and never under reduced motion.

export const CONFIRM_BUZZ_MS = 12;

/** Buzz once for a confirm. Returns whether it buzzed. */
export function confirmTap(): boolean {
  if (typeof document === "undefined" || typeof navigator === "undefined") return false;
  if (document.documentElement.dataset.ui !== "v2") return false;
  if (typeof navigator.vibrate !== "function") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return navigator.vibrate(CONFIRM_BUZZ_MS);
}
