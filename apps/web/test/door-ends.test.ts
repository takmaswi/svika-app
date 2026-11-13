// Launch Step 3: the location parameter never carries the exact spot, and
// recent destinations stay a short clean list on the phone.
import { describe, expect, test } from "vitest";
import {
  RECENT_MAX,
  locationParam,
  parseLocationParam,
  pushRecent,
  readRecent,
  splitMatch,
} from "../src/lib/door/ends";

describe("my location in the plan URL", () => {
  test("is rounded to three decimals, about 110 m", () => {
    expect(locationParam(-17.783456, 31.052789)).toBe("@-17.783,31.053");
  });
  test("parses back, and anything finer is rounded again on the server", () => {
    expect(parseLocationParam("@-17.783,31.053")).toEqual({
      lat: -17.783,
      lng: 31.053,
    });
    expect(parseLocationParam("@-17.78345678,31.0527891")).toEqual({
      lat: -17.783,
      lng: 31.053,
    });
  });
  test("rejects anything that is not a location", () => {
    for (const bad of [
      "",
      "Avondale",
      "@",
      "@1,2,3",
      "@95,31",
      "@-17,190",
      "@abc,def",
      "-17.7,31.0",
    ]) {
      expect(parseLocationParam(bad)).toBeNull();
    }
  });
});

describe("recent destinations", () => {
  test("newest first, no duplicates whatever the case, at most five", () => {
    let list: string[] = [];
    for (const n of [
      "UZ",
      "Avondale",
      "uz",
      "Town",
      "Belvedere",
      "Avenues",
      "Eastlea",
    ]) {
      list = pushRecent(list, n);
    }
    expect(list).toEqual(["Eastlea", "Avenues", "Belvedere", "Town", "uz"]);
    expect(list).toHaveLength(RECENT_MAX);
  });
  test("never keeps a location or a stray letter", () => {
    expect(pushRecent(["UZ"], "@-17.783,31.053")).toEqual(["UZ"]);
    expect(pushRecent(["UZ"], " a ")).toEqual(["UZ"]);
  });
  test("a damaged store reads as empty", () => {
    expect(readRecent("not json")).toEqual([]);
    expect(readRecent('{"a":1}')).toEqual([]);
    expect(readRecent('["UZ", 3, "Town"]')).toEqual(["UZ", "Town"]);
    expect(readRecent(null)).toEqual([]);
  });
});

test("the typed letters are split off for the bold part", () => {
  expect(splitMatch("Avondale Shops", "avon")).toEqual([
    "Avondale Shops".slice(0, 4),
    "dale Shops",
  ]);
  expect(splitMatch("Mt Pleasant", "pl")).toEqual(["", "Mt Pleasant"]);
});
