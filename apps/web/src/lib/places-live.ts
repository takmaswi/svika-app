// M3 ruling 3: the city's agreed names belong on the home map, not only on
// the naming screen. That is the whole point of the flywheel: a rider names
// a spot, three riders agree, and everybody opening the app sees the word
// the street already uses.
//
// Only PUBLIC names travel here. Suggestions are still being argued about
// and a personal name is one rider's own word, so neither joins the home
// map; both keep rendering on /app/places where the scopes are explained.
// The read goes through place_names_live under RLS, so a guest map and a
// rider map show exactly the same rows, and a network miss simply renders
// no chips rather than taking the map down.
import type { SupabaseClient } from "@supabase/supabase-js";
import { corridorLine } from "./map/corridor-data";

export interface MapPlaceName {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

// the corridor box grown by about 2 km, so a name at either rank still
// lands inside the window the home camera can reach
const MARGIN_DEG = 0.02;
// a hard ceiling on how many chips a cheap phone ever has to draw
const MAX_NAMES = 60;

export async function fetchCorridorPlaceNames(
  supabase: SupabaseClient,
): Promise<MapPlaceName[]> {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of corridorLine.coordinates) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  const { data, error } = await supabase
    .from("place_names_live")
    .select("id, name, lat, lng")
    .eq("scope", "public")
    .gte("lat", minLat - MARGIN_DEG)
    .lte("lat", maxLat + MARGIN_DEG)
    .gte("lng", minLng - MARGIN_DEG)
    .lte("lng", maxLng + MARGIN_DEG)
    .order("created_at", { ascending: true })
    .limit(MAX_NAMES);
  if (error || !Array.isArray(data)) return [];
  return data as MapPlaceName[];
}
