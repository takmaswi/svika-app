import { describe, expect, test } from "vitest";
import { loadPlaces, resolvePlaceQuery, type GeoPlace } from "../src/lib/geocode/search";

const entries: GeoPlace[] = [
  { name: "Avondale", kind: "suburb", lng: 31.036, lat: -17.793 },
  { name: "Avondale", kind: "poi", lng: 31.038, lat: -17.804 },
  { name: "Avondale Bookshop", kind: "poi", lng: 31.037, lat: -17.803 },
  { name: "Kuwadzana", kind: "suburb", lng: 30.919, lat: -17.828 },
  { name: "University of Zimbabwe", kind: "poi", lng: 31.052, lat: -17.785 },
  { name: "Samora Machel Avenue", kind: "road", lng: 31.05, lat: -17.828 },
  { name: "Second Street Extension", kind: "road", lng: 31.045, lat: -17.76 },
];

describe("resolvePlaceQuery", () => {
  test("an exact suburb name is a confident match over the same named poi", () => {
    const r = resolvePlaceQuery(entries, "Avondale");
    expect(r.match).not.toBeNull();
    expect(r.match!.kind).toBe("suburb");
  });

  test("a full poi name resolves confidently", () => {
    const r = resolvePlaceQuery(entries, "university of zimbabwe");
    expect(r.match?.name).toBe("University of Zimbabwe");
  });

  test("a distinctive fragment still finds its place", () => {
    const r = resolvePlaceQuery(entries, "kuwadzana");
    expect(r.match?.name).toBe("Kuwadzana");
  });

  test("an ambiguous fragment degrades to suggestions, never a guess", () => {
    const r = resolvePlaceQuery(entries, "avondale book");
    // "Avondale Bookshop" contains neither exact nor prefix of the whole
    // query; word scoring puts it first but the suggestions carry the rest
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions[0]!.name).toBe("Avondale Bookshop");
  });

  test("unknown text matches nothing and suggests nothing false", () => {
    const r = resolvePlaceQuery(entries, "xyzzy nowhere");
    expect(r.match).toBeNull();
    expect(r.suggestions).toHaveLength(0);
  });

  test("empty text matches nothing", () => {
    expect(resolvePlaceQuery(entries, "  ").match).toBeNull();
  });

  test("roads resolve when named in full", () => {
    const r = resolvePlaceQuery(entries, "samora machel avenue");
    expect(r.match?.kind).toBe("road");
  });
});

describe("the committed corpus", () => {
  test("carries suburbs, pois and roads from the extract", () => {
    const places = loadPlaces();
    const kinds = new Set(places.map((p) => p.kind));
    expect(kinds.has("suburb")).toBe(true);
    expect(kinds.has("poi")).toBe(true);
    expect(kinds.has("road")).toBe(true);
    expect(places.length).toBeGreaterThan(1000);
  });

  test("resolves the campus by name", () => {
    const r = resolvePlaceQuery(loadPlaces(), "University of Zimbabwe");
    expect(r.match?.name).toBe("University of Zimbabwe");
    expect(r.match!.lat).toBeCloseTo(-17.785, 2);
  });

  test("resolves a suburb the network does not serve", () => {
    const r = resolvePlaceQuery(loadPlaces(), "Kuwadzana");
    expect(r.match?.kind).toBe("suburb");
  });
});
