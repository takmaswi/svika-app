import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      // Next's bundler imports .geojson as JSON (see lib/map/geojson.d.ts);
      // give vitest the same behaviour so modules like corridor-data load
      // in unit tests (the alight guidance trace replay needs them).
      name: "geojson-as-json",
      transform(code, id) {
        if (id.endsWith(".geojson")) {
          return { code: `export default ${code};`, map: null };
        }
      },
    },
  ],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
