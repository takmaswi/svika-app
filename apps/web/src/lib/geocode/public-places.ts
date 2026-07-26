// M3: public place names join the D1 destination search the moment they
// are public. One RPC (search_public_places, migration 0038: trigram
// ranked, guests included), deduped against the committed OSM corpus by
// normalised name so a nickname that shadows an OSM name never shows twice.
// The corpus stays the committed file; this adds the city's own words on
// top, and a network miss simply returns nothing extra.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeoPlace } from "./search";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchPublicPlaces(
  supabase: SupabaseClient,
  query: string,
  corpus: GeoPlace[],
): Promise<GeoPlace[]> {
  if (normalize(query).length < 3) return [];
  const { data, error } = await supabase.rpc("search_public_places", {
    p_q: query,
  });
  if (error || !Array.isArray(data)) return [];
  const known = new Set(corpus.map((p) => normalize(p.name)));
  return (data as { name: string; lat: number; lng: number }[])
    .filter((row) => !known.has(normalize(row.name)))
    .map((row) => ({
      name: row.name,
      kind: "place" as const,
      lat: row.lat,
      lng: row.lng,
    }));
}
