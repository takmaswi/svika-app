// Launch Step 3 planner suggestions: from two letters, starts-with first.
import { describe, expect, test } from "vitest";
import { suggestPlaces, type GeoPlace } from "../src/lib/geocode/search";

const at = { lng: 31.05, lat: -17.8 };
const places: GeoPlace[] = [
  { name: "Avondale", kind: "suburb", ...at },
  { name: "Avondale Shops", kind: "poi", ...at },
  { name: "Avondale West", kind: "suburb", ...at },
  { name: "New Avondale Road", kind: "road", ...at },
  { name: "Mt Pleasant", kind: "suburb", ...at },
  { name: "Pleasant View", kind: "place", ...at },
  { name: "avondale", kind: "road", ...at },
];

describe("suggestPlaces", () => {
  test("waits for two letters", () => {
    expect(suggestPlaces(places, "a")).toEqual([]);
    expect(suggestPlaces(places, "av").length).toBeGreaterThan(0);
  });
  test("names that start with the letters come first, the suburb before a road of the same name", () => {
    const names = suggestPlaces(places, "avon").map((p) => p.name);
    expect(names[0]).toBe("Avondale");
    expect(names).toContain("Avondale Shops");
    expect(names.indexOf("New Avondale Road")).toBeGreaterThan(
      names.indexOf("Avondale West"),
    );
    // the lower case duplicate collapses into the first Avondale
    expect(names.filter((n) => n.toLowerCase() === "avondale")).toHaveLength(1);
  });
  test("a word inside the name counts, and the limit holds", () => {
    expect(suggestPlaces(places, "pl").map((p) => p.name)).toEqual([
      "Pleasant View",
      "Mt Pleasant",
    ]);
    expect(suggestPlaces(places, "avo", 2)).toHaveLength(2);
  });
});
