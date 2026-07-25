import { describe, expect, test, vi } from "vitest";
import { RecordingWakeLock } from "../src/lib/journey/wake-lock";

interface FakeSentinel {
  released: boolean;
  release: () => Promise<void>;
}

function makeSentinel(): FakeSentinel {
  const sentinel: FakeSentinel = {
    released: false,
    release: vi.fn(async () => {
      sentinel.released = true;
    }),
  };
  return sentinel;
}

function makeDoc(visibilityState: DocumentVisibilityState = "visible") {
  const listeners = new Set<() => void>();
  return {
    visibilityState,
    addEventListener: vi.fn((_: string, fn: () => void) => listeners.add(fn)),
    removeEventListener: vi.fn((_: string, fn: () => void) => listeners.delete(fn)),
    fireVisibilityChange() {
      for (const fn of listeners) fn();
    },
  };
}

describe("recording wake lock", () => {
  test("a browser without the API is a clean no-op, never a crash", async () => {
    const lock = new RecordingWakeLock({ nav: {}, doc: makeDoc() });
    expect(lock.supported).toBe(false);
    await lock.acquire();
    expect(lock.held).toBe(false);
    await lock.release();
  });

  test("acquire requests a screen lock and holds it", async () => {
    const sentinel = makeSentinel();
    const request = vi.fn(async () => sentinel);
    const lock = new RecordingWakeLock({ nav: { wakeLock: { request } }, doc: makeDoc() });
    await lock.acquire();
    expect(request).toHaveBeenCalledWith("screen");
    expect(lock.held).toBe(true);
  });

  test("a denied request (low battery) never breaks the recording", async () => {
    const request = vi.fn(async () => {
      throw new DOMException("denied", "NotAllowedError");
    });
    const lock = new RecordingWakeLock({ nav: { wakeLock: { request } }, doc: makeDoc() });
    await expect(lock.acquire()).resolves.toBeUndefined();
    expect(lock.held).toBe(false);
  });

  test("release frees the sentinel and stops listening", async () => {
    const sentinel = makeSentinel();
    const doc = makeDoc();
    const lock = new RecordingWakeLock({
      nav: { wakeLock: { request: async () => sentinel } },
      doc,
    });
    await lock.acquire();
    await lock.release();
    expect(sentinel.release).toHaveBeenCalled();
    expect(lock.held).toBe(false);
    expect(doc.removeEventListener).toHaveBeenCalled();
  });

  test("returning to a visible tab re-acquires the auto released lock", async () => {
    const first = makeSentinel();
    const second = makeSentinel();
    const request = vi
      .fn<() => Promise<FakeSentinel>>()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const doc = makeDoc();
    const lock = new RecordingWakeLock({ nav: { wakeLock: { request } }, doc });
    await lock.acquire();
    // the browser drops the lock itself when the tab hides
    first.released = true;
    expect(lock.held).toBe(false);
    doc.fireVisibilityChange();
    await vi.waitFor(() => expect(lock.held).toBe(true));
    expect(request).toHaveBeenCalledTimes(2);
  });

  test("after release a visibility change requests nothing", async () => {
    const request = vi.fn(async () => makeSentinel());
    const doc = makeDoc();
    const lock = new RecordingWakeLock({ nav: { wakeLock: { request } }, doc });
    await lock.acquire();
    await lock.release();
    doc.fireVisibilityChange();
    expect(request).toHaveBeenCalledTimes(1);
  });

  test("state changes reach the subscriber for the UI", async () => {
    const sentinel = makeSentinel();
    const states: boolean[] = [];
    const lock = new RecordingWakeLock({
      nav: { wakeLock: { request: async () => sentinel } },
      doc: makeDoc(),
      onChange: (held) => states.push(held),
    });
    await lock.acquire();
    await lock.release();
    expect(states).toEqual([true, false]);
  });
});
