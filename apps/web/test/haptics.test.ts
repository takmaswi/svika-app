// Plan Step 1.5: a short vibration on confirm where supported, never under
// reduced motion, only with the launch-v2 system on.
import { afterEach, describe, expect, test, vi } from "vitest";
import { CONFIRM_BUZZ_MS, confirmTap } from "../src/lib/haptics";

function fakeBrowser({ v2 = true, reduce = false, vibrate = true } = {}) {
  const calls: number[] = [];
  vi.stubGlobal("document", { documentElement: { dataset: v2 ? { ui: "v2" } : {} } });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: reduce }) });
  vi.stubGlobal("navigator", vibrate ? { vibrate: (ms: number) => (calls.push(ms), true) } : {});
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("confirmTap", () => {
  test("buzzes once, briefly, under launch-v2", () => {
    const calls = fakeBrowser();
    expect(confirmTap()).toBe(true);
    expect(calls).toEqual([CONFIRM_BUZZ_MS]);
  });
  test("stays still under reduced motion", () => {
    const calls = fakeBrowser({ reduce: true });
    expect(confirmTap()).toBe(false);
    expect(calls).toEqual([]);
  });
  test("stays still without launch-v2 or without a vibration motor", () => {
    expect(fakeBrowser({ v2: false }).length).toBe(0);
    expect(confirmTap()).toBe(false);
    fakeBrowser({ vibrate: false });
    expect(confirmTap()).toBe(false);
  });
});
