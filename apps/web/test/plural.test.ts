// Plan Step 1.8: plurals come from the CLDR rules, never a bolted on "s".
import { describe, expect, test } from "vitest";
import { tp } from "../src/lib/plural";

describe("tp", () => {
  test("English one and other", () => {
    expect(tp("en", "kombis", 1)).toBe("1 kombi");
    expect(tp("en", "kombis", 0)).toBe("0 kombis");
    expect(tp("en", "kombis", 3)).toBe("3 kombis");
  });
  test("Shona changes the noun class prefix", () => {
    expect(tp("sn", "kombis", 1)).toBe("kombi 1");
    expect(tp("sn", "kombis", 4)).toBe("makombi 4");
  });
  test("sentences agree with the count", () => {
    expect(tp("en", "fixesLive", 1)).toBe("1 of your fixes is live");
    expect(tp("en", "fixesLive", 12)).toBe("12 of your fixes are live");
    expect(tp("en", "moreToQualify", 1)).toBe("1 more contribution to qualify for this week's reward");
  });
});
