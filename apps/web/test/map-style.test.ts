import { describe, expect, test } from "vitest";
import {
  BUILDING_3D_LAYER_ID,
  BUILDING_LAYER_ID,
  buildMbareSunStyle,
  MAP_COLORS,
  MAP_SOURCE_ID,
  PLACE_LABEL_FONT,
  STREET_LABEL_FONT,
  type MapTheme,
} from "../src/lib/map/style";
import { tileSourceFor } from "../src/lib/map/tile-source";

const ORIGIN = "https://svika.test";

function styleFor(theme: MapTheme) {
  return buildMbareSunStyle(theme, {
    source: tileSourceFor("mock", {}, ORIGIN),
    origin: ORIGIN,
  });
}

type AnyLayer = {
  id: string;
  type: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
  [key: string]: unknown;
};

function layerOf(style: ReturnType<typeof styleFor>, id: string): AnyLayer {
  const layer = style.layers.find((l) => l.id === id);
  if (!layer) throw new Error(`missing layer ${id}`);
  return layer as unknown as AnyLayer;
}

describe("buildMbareSunStyle", () => {
  test.each(["day", "night"] as const)(
    "%s ground, parks, buildings and roads take the DESIGN.md palette",
    (theme) => {
      const c = MAP_COLORS[theme];
      const out = styleFor(theme);
      expect(layerOf(out, "background").paint?.["background-color"]).toBe(c.base);
      expect(layerOf(out, "landcover-green").paint?.["fill-color"]).toBe(c.park);
      expect(layerOf(out, "park").paint?.["fill-color"]).toBe(c.park);
      expect(layerOf(out, BUILDING_LAYER_ID).paint?.["fill-color"]).toBe(c.building);
      expect(layerOf(out, "road").paint?.["line-color"]).toBe(c.road);
      expect(layerOf(out, "road-minor").paint?.["line-color"]).toBe(c.minorRoad);
      expect(layerOf(out, "road-path").paint?.["line-color"]).toBe(c.minorRoad);
      expect(layerOf(out, "railway").paint?.["line-color"]).toBe(c.roadCasing);
    },
  );

  test("water joins the park family (no spec value of its own)", () => {
    const out = styleFor("day");
    expect(layerOf(out, "water").paint?.["fill-color"]).toBe(MAP_COLORS.day.park);
    expect(layerOf(out, "waterway").paint?.["line-color"]).toBe(MAP_COLORS.day.park);
  });

  test("casings sit under their fills and hug the fill width curve", () => {
    const out = styleFor("day");
    const ids = out.layers.map((l) => l.id);
    expect(ids.indexOf("road-casing")).toBeLessThan(ids.indexOf("road"));
    expect(ids.indexOf("road-minor-casing")).toBeLessThan(ids.indexOf("road-minor"));
    const casing = layerOf(out, "road-casing");
    expect(casing.paint?.["line-color"]).toBe(MAP_COLORS.day.roadCasing);
    expect(casing.paint?.["line-width"]).toBe(3);
    expect(casing.paint?.["line-gap-width"]).toEqual(layerOf(out, "road").paint?.["line-width"]);
    const minorCasing = layerOf(out, "road-minor-casing");
    expect(minorCasing.paint?.["line-gap-width"]).toEqual(
      layerOf(out, "road-minor").paint?.["line-width"],
    );
  });

  test("layer order follows §11: base, park, buildings, casing, fill, labels", () => {
    const ids = styleFor("night").layers.map((l) => l.id);
    const order = ["background", "park", BUILDING_LAYER_ID, "road-casing", "road", "street-label"];
    const positions = order.map((id) => ids.indexOf(id));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  test("street labels are IBM Plex Mono SemiBold at 9px with the label colour", () => {
    const out = styleFor("night");
    const label = layerOf(out, "street-label");
    expect(label.layout?.["text-font"]).toEqual(STREET_LABEL_FONT);
    expect(label.layout?.["text-size"]).toBe(9);
    expect(label.layout?.["text-letter-spacing"]).toBe(0.07);
    expect(label.paint?.["text-color"]).toBe(MAP_COLORS.night.streetLabel);
    expect(label.paint?.["text-halo-color"]).toBe(MAP_COLORS.night.base);
  });

  test("place labels take the brand body font and the label colour", () => {
    const out = styleFor("day");
    for (const id of ["place-suburb", "place-city"]) {
      const label = layerOf(out, id);
      expect(label.layout?.["text-font"]).toEqual(PLACE_LABEL_FONT);
      expect(label.paint?.["text-color"]).toBe(MAP_COLORS.day.streetLabel);
    }
  });

  test("park labels use the park label token", () => {
    const out = styleFor("night");
    expect(layerOf(out, "park-label").paint?.["text-color"]).toBe(MAP_COLORS.night.parkLabel);
  });

  test("3D buildings ship hidden, in the building token, with OSM heights", () => {
    const out = styleFor("day");
    const three = layerOf(out, BUILDING_3D_LAYER_ID);
    expect(three.type).toBe("fill-extrusion");
    expect(three.layout?.visibility).toBe("none");
    expect(three.paint?.["fill-extrusion-color"]).toBe(MAP_COLORS.day.building);
    expect(three.paint?.["fill-extrusion-height"]).toEqual([
      "coalesce",
      ["get", "render_height"],
      8,
    ]);
  });

  test("glyphs and sprites are self hosted on the app origin", () => {
    const out = styleFor("day");
    expect(out.glyphs).toBe(`${ORIGIN}/map/fonts/{fontstack}/{range}.pbf`);
    expect(out.sprite).toBe(`${ORIGIN}/map/sprite/sprite`);
  });

  test("every data layer reads from the injected openmaptiles source", () => {
    const out = styleFor("day");
    expect(Object.keys(out.sources)).toEqual([MAP_SOURCE_ID]);
    for (const layer of out.layers) {
      if (layer.type === "background") continue;
      expect((layer as unknown as AnyLayer).source).toBe(MAP_SOURCE_ID);
    }
  });

  test("night and day produce different grounds", () => {
    expect(layerOf(styleFor("day"), "background").paint?.["background-color"]).not.toBe(
      layerOf(styleFor("night"), "background").paint?.["background-color"],
    );
  });
});
