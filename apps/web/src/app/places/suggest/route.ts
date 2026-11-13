// Launch Step 3: what the planner suggests while the rider types, from two
// letters. Kombi stops first (they plan exactly), then the committed OSM
// place index and the public crowd names. Read only, no rider data; the
// query is not stored. Behind the front_door flag.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flagOn } from "@/lib/flags-server";
import {
  SUGGEST_MIN_LETTERS,
  loadPlaces,
  suggestPlaces,
  type GeoKind,
  type GeoPlace,
} from "@/lib/geocode/search";
import { fetchPublicPlaces } from "@/lib/geocode/public-places";

export const dynamic = "force-dynamic";

const LIMIT = 6;
const MAX_QUERY = 60;

export interface Suggestion {
  name: string;
  kind: "stop" | GeoKind;
}

function reply(list: Suggestion[]): NextResponse {
  return NextResponse.json(list, {
    headers: { "cache-control": "private, max-age=60" },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await flagOn("front_door"))) return new NextResponse(null, { status: 404 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, MAX_QUERY);
  if (q.trim().length < SUGGEST_MIN_LETTERS) return reply([]);

  const supabase = await createClient();
  const corpus = loadPlaces();
  const [stopsRes, publicPlaces] = await Promise.all([
    supabase.from("stops").select("name, lat, lng"),
    fetchPublicPlaces(supabase, q, corpus),
  ]);
  const stops: GeoPlace[] = ((stopsRes.data ?? []) as Omit<GeoPlace, "kind">[]).map(
    (s) => ({ ...s, kind: "place" }),
  );

  const stopHits = suggestPlaces(stops, q, LIMIT);
  const taken = new Set(stopHits.map((s) => s.name.toLowerCase()));
  const placeHits = suggestPlaces([...corpus, ...publicPlaces], q, LIMIT * 2).filter(
    (p) => !taken.has(p.name.toLowerCase()),
  );
  return reply(
    [
      ...stopHits.map((s) => ({ name: s.name, kind: "stop" as const })),
      ...placeHits.map((p) => ({ name: p.name, kind: p.kind })),
    ].slice(0, LIMIT),
  );
}
