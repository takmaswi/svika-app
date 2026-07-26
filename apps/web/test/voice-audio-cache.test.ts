import { describe, expect, test, vi } from "vitest";
import { CachedPhrase, VoiceAudioCache } from "../src/lib/voice/audio-cache";

function fakeFetch(ok = true) {
  return vi.fn(async (input: RequestInfo | URL) => ({
    ok,
    url: String(input),
    blob: async () => new Blob([`audio:${String(input)}`]),
  })) as unknown as typeof fetch;
}

describe("VoiceAudioCache", () => {
  test("preload fetches every cue once; play time never fetches", async () => {
    const fetchFn = fakeFetch();
    let minted = 0;
    const cache = new VoiceAudioCache({
      fetchFn,
      createObjectUrl: () => `blob:mock-${++minted}`,
    });

    await cache.preload("sn");
    expect(fetchFn).toHaveBeenCalledTimes(3);
    const called = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => String(c[0]),
    );
    expect(called).toEqual(
      expect.arrayContaining([
        "/voice/sn/approaching.wav",
        "/voice/sn/get-off.wav",
        "/voice/sn/walk.wav",
      ]),
    );

    // the zero network proof: reading sources for playback fetches nothing
    expect(cache.src("approaching")).toMatch(/^blob:mock-/);
    expect(cache.src("getOff")).toMatch(/^blob:mock-/);
    expect(cache.src("walk")).toMatch(/^blob:mock-/);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  test("a missing file mutes its cue instead of crashing the ride", async () => {
    const cache = new VoiceAudioCache({
      fetchFn: fakeFetch(false),
      createObjectUrl: () => "blob:never",
    });
    await cache.preload("en");
    expect(cache.src("approaching")).toBeNull();
  });
});

describe("CachedPhrase (the last kombi cue, V7)", () => {
  test("however many times the rider listens, the network is touched once", async () => {
    const fetchFn = fakeFetch();
    let minted = 0;
    const phrase = new CachedPhrase("/voice/sn/last-kombi.wav", {
      fetchFn,
      createObjectUrl: () => `blob:mock-${++minted}`,
    });

    const first = await phrase.load();
    const second = await phrase.load();
    const third = await phrase.load();
    expect(first).toBe("blob:mock-1");
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("two loads racing each other still make one request", async () => {
    const fetchFn = fakeFetch();
    const phrase = new CachedPhrase("/voice/en/last-kombi.wav", {
      fetchFn,
      createObjectUrl: () => "blob:mock",
    });
    const [a, b] = await Promise.all([phrase.load(), phrase.load()]);
    expect(a).toBe("blob:mock");
    expect(b).toBe("blob:mock");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("a missing recording mutes the button instead of breaking the screen", async () => {
    const phrase = new CachedPhrase("/voice/en/last-kombi.wav", {
      fetchFn: fakeFetch(false),
      createObjectUrl: () => "blob:never",
    });
    expect(await phrase.load()).toBeNull();
  });
});
