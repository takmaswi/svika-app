import { describe, expect, test } from "vitest";
import {
  DEFAULT_PMTILES_PATH,
  maptilerTilesUrl,
  OSM_ATTRIBUTION,
  providerChain,
  tileSourceFor,
} from "../src/lib/map/tile-source";

const ORIGIN = "https://svika.test";

describe("providerChain", () => {
  test("defaults to self hosted with mock as the never-dies tail", () => {
    expect(providerChain({})).toEqual(["selfhosted", "mock"]);
  });

  test("maptiler joins the fallback chain only when its key is present", () => {
    expect(providerChain({ maptilerKey: "k" })).toEqual(["selfhosted", "maptiler", "mock"]);
    expect(providerChain({ maptilerKey: "  " })).toEqual(["selfhosted", "mock"]);
  });

  test("a configured maptiler provider leads its chain", () => {
    expect(providerChain({ provider: "maptiler", maptilerKey: "k" })).toEqual([
      "maptiler",
      "selfhosted",
      "mock",
    ]);
  });

  test("maptiler without a key falls back to self hosted", () => {
    expect(providerChain({ provider: "maptiler" })).toEqual(["selfhosted", "mock"]);
  });

  test("an explicit mock stands alone: tests want determinism", () => {
    expect(providerChain({ provider: "mock", maptilerKey: "k" })).toEqual(["mock"]);
  });

  test("an unknown provider name falls back to the default chain", () => {
    expect(providerChain({ provider: "carrier-pigeon" })).toEqual(["selfhosted", "mock"]);
  });
});

describe("tileSourceFor", () => {
  test("selfhosted serves the local PMTiles file through the pmtiles protocol", () => {
    const source = tileSourceFor("selfhosted", {}, ORIGIN);
    expect(source.url).toBe(`pmtiles://${ORIGIN}${DEFAULT_PMTILES_PATH}`);
    expect(source.attribution).toBe(OSM_ATTRIBUTION);
  });

  test("a hosted PMTiles override wins over the local file", () => {
    const source = tileSourceFor(
      "selfhosted",
      { pmtilesUrl: "https://cdn.example/harare.pmtiles" },
      ORIGIN,
    );
    expect(source.url).toBe("pmtiles://https://cdn.example/harare.pmtiles");
  });

  test("maptiler builds the tiles.json url from the raw key", () => {
    const source = tileSourceFor("maptiler", { maptilerKey: "a&b=c" }, ORIGIN);
    expect(source.url).toBe("https://api.maptiler.com/tiles/v3/tiles.json?key=a%26b%3Dc");
    expect(source.attribution).toContain("OpenStreetMap");
    expect(source.attribution).toContain("MapTiler");
  });

  test("maptiler rejects an empty key with a message naming the env var", () => {
    expect(() => maptilerTilesUrl("")).toThrow(/NEXT_PUBLIC_MAP_TILES_URL/);
    expect(() => tileSourceFor("maptiler", {}, ORIGIN)).toThrow(/NEXT_PUBLIC_MAP_TILES_URL/);
  });

  test("mock serves the committed fixture tile for every coordinate", () => {
    const source = tileSourceFor("mock", {}, ORIGIN);
    expect(source.tiles).toEqual([`${ORIGIN}/map/mock/tile.pbf?z={z}&x={x}&y={y}`]);
    expect(source.attribution).toBe("Map fixture (tests)");
  });

  test("every provider carries visible attribution text", () => {
    for (const name of ["selfhosted", "mock"] as const) {
      expect(tileSourceFor(name, {}, ORIGIN).attribution).toBeTruthy();
    }
  });
});
