import { describe, expect, test } from "vitest";
import { canOffer3d, MIN_DEVICE_MEMORY_GB } from "../src/lib/map/three-d";

describe("canOffer3d", () => {
  test("reduced motion always stays flat", () => {
    expect(canOffer3d({ deviceMemory: 8, reducedMotion: true })).toBe(false);
  });

  test("low memory devices never get the toggle", () => {
    expect(
      canOffer3d({ deviceMemory: MIN_DEVICE_MEMORY_GB - 1, reducedMotion: false }),
    ).toBe(false);
  });

  test("capable devices get the toggle", () => {
    expect(canOffer3d({ deviceMemory: MIN_DEVICE_MEMORY_GB, reducedMotion: false })).toBe(true);
  });

  test("devices that do not report memory are allowed (iOS reports nothing)", () => {
    expect(canOffer3d({ deviceMemory: undefined, reducedMotion: false })).toBe(true);
  });
});
