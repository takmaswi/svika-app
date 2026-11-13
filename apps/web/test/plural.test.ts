// Plan Step 1.8: plurals come from the CLDR rules and the translation file,
// never a bolted on "s".
import { describe, expect, test } from "vitest";
import { dict } from "../src/lib/dict";
import { isOne, tp, tpParts } from "../src/lib/plural";

describe("tp", () => {
  test("English one and other", () => {
    expect(tp("en", "count.kombis", 1)).toBe("1 kombi");
    expect(tp("en", "count.kombis", 0)).toBe("0 kombis");
    expect(tp("en", "count.kombis", 3)).toBe("3 kombis");
  });
  test("Shona changes the noun class prefix", () => {
    expect(tp("sn", "count.kombis", 1)).toBe("kombi 1");
    expect(tp("sn", "count.kombis", 4)).toBe("makombi 4");
  });
  test("sentences agree with the count", () => {
    expect(tp("en", "count.fixesLive", 1)).toBe("1 of your fixes is live");
    expect(tp("en", "count.fixesLive", 12)).toBe("12 of your fixes are live");
    expect(tp("en", "eta.cardMeasured", 1)).toContain("1 real ride we");
    expect(tp("en", "eta.cardMeasured", 2)).toContain("2 real rides we");
  });
  test("a key without a one form falls back to its only form", () => {
    expect(tp("en", "fareBoard.counted", 5)).toBe("5 fares counted so far today");
  });
  test("tpParts splits around the number so it can sit in mono", () => {
    expect(tpParts("en", "count.kombis", 1)).toEqual(["", " kombi"]);
    expect(tpParts("sn", "count.kombis", 2)).toEqual(["makombi ", ""]);
  });
  test("isOne follows the shared rule", () => {
    expect([0, 1, 2].map(isOne)).toEqual([false, true, false]);
  });
  test("every one form has its other form, in both languages, with the count slot", () => {
    for (const key of Object.keys(dict).filter((k) => k.endsWith(".one"))) {
      const other = key.slice(0, -4);
      expect(other in dict, other).toBe(true);
      const e = dict[key as keyof typeof dict] as { en: string; sn: string };
      expect(e.en.includes("{count}") && e.sn.includes("{count}"), key).toBe(true);
    }
  });
});
