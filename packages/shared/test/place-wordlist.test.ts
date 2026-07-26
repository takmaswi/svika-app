import { describe, expect, test } from "vitest";
import { isPlaceNameClean } from "../src/place-wordlist";

// The client twin of the server wordlist screen (migration 0038). Real
// Harare names must pass; slurs and profanity in either language must not,
// including spaced-out and squashed evasions.
describe("place name wordlist screen", () => {
  test("real Harare names pass", () => {
    for (const name of [
      "Copacabana",
      "Pa Sport",
      "Mereki",
      "Mbudzi roundabout",
      "PaGomo",
      "Westgate turn off",
      "Mbare Musika",
    ]) {
      expect(isPlaceNameClean(name), name).toBe(true);
    }
  });

  test("banned words in either language are screened", () => {
    for (const name of ["mboro corner", "Hure house", "shit stop", "kaffir drift"]) {
      expect(isPlaceNameClean(name), name).toBe(false);
    }
  });

  test("case and punctuation do not walk a word through", () => {
    expect(isPlaceNameClean("MBORO gate")).toBe(false);
    expect(isPlaceNameClean("n.g.o.c.h.a.n.i corner")).toBe(false);
  });

  test("short banned words only match whole words, never substrings", () => {
    // "hure" sits inside genuine words; the boundary rule keeps them alive
    expect(isPlaceNameClean("Mahusekwa")).toBe(true);
    expect(isPlaceNameClean("Dickson road")).toBe(true);
  });
});
