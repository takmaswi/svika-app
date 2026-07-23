// D1 local geocoding: destination search over the committed OSM corpus
// (places.json, built by tools/geocode-index from the M0 self hosted
// extract). A local index query, no vendor, nothing in the ride path.
// Deterministic scoring, same shape as the stop resolver in the planner:
// a confident single match or a suggestion list, never a guess presented
// as certainty. Documented as rules, not AI, in AI-USAGE-MAP.md.
//
// Scoring: exact name 100, name starts with the query 70, name contains it
// 60, otherwise 30 plus 10 per query word (3+ letters) found in the name.
// A small kind bonus (suburb 3, place 2, poi 1, road 0) breaks ties toward
// what a rider most likely means when two entries share a name. Confident
// means the top adjusted score is at least 60 and strictly ahead of the
// runner up.
import corpus from "./places.json";

export type GeoKind = "suburb" | "place" | "poi" | "road";

export interface GeoPlace {
  name: string;
  kind: GeoKind;
  lng: number;
  lat: number;
}

export interface PlaceQueryResult {
  match: GeoPlace | null;
  suggestions: GeoPlace[];
}

const KIND_BONUS: Record<GeoKind, number> = { suburb: 3, place: 2, poi: 1, road: 0 };
const CONFIDENT_SCORE = 60;
const MAX_SUGGESTIONS = 8;

export function loadPlaces(): GeoPlace[] {
  return (corpus as { entries: GeoPlace[] }).entries;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolvePlaceQuery(entries: GeoPlace[], query: string): PlaceQueryResult {
  const q = normalize(query);
  if (q.length < 3) return { match: null, suggestions: [] };
  const words = q.split(" ").filter((w) => w.length >= 3);

  const scored = entries
    .map((place) => {
      const name = normalize(place.name);
      let score = 0;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 70;
      else if (name.includes(q)) score = 60;
      else {
        const hits = words.filter((w) => name.includes(w));
        if (hits.length > 0 && hits.length === words.length) {
          score = 30 + hits.length * 10;
        }
      }
      return { place, score: score === 0 ? 0 : score + KIND_BONUS[place.kind] };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name, "en"));

  if (scored.length === 0) return { match: null, suggestions: [] };
  const top = scored[0]!;
  const second = scored[1];
  const confident =
    top.score >= CONFIDENT_SCORE && (second === undefined || top.score > second.score);
  return {
    match: confident ? top.place : null,
    suggestions: scored.slice(0, MAX_SUGGESTIONS).map((s) => s.place),
  };
}
