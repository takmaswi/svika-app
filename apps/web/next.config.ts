import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript/CSS source, not built output.
  transpilePackages: ["@svika/ui", "@svika/shared"],
  // M4 (from the M0 gate, Mhofu 2026-07-23): the self hosted glyph PBFs were
  // shipping raw. Measured on `next start`: a 78,323 byte range arrived at
  // 78,323 bytes, against roughly 49 KB for MapTiler's equivalent, because
  // Next serves anything it does not recognise as application/octet-stream
  // and its compressor skips that. Declaring application/x-protobuf did not
  // help either (measured, still 78,323): that type is not on the
  // compressible list, and inventing a text-ish media type to trick the
  // compressor would be a lie in a header.
  //
  // So the files on disk ARE the gzip bytes (tools/map-tiles/compress-glyphs.mjs,
  // 794 KB to 375 KB across all 512 ranges) and this declares the encoding.
  // The browser decodes transparently and MapLibre reads an arrayBuffer
  // without ever looking at the media type. The immutable cache header stops
  // a cheap phone refetching a font range that by definition never changes.
  async headers() {
    return [
      {
        source: "/map/fonts/:stack/:range.pbf",
        headers: [
          { key: "Content-Type", value: "application/x-protobuf" },
          { key: "Content-Encoding", value: "gzip" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  webpack: (config) => {
    // The corridor geometry is imported straight from packages/db/seed/geo so
    // the map and the seed can never drift apart.
    config.module.rules.push({ test: /\.geojson$/, type: "json" });
    return config;
  },
};

export default nextConfig;
