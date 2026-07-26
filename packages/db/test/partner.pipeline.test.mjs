// Partner pipeline proof (batch Partner): a trip a rider records as a Svika
// Partner reaches the tables the network is actually built from.
//
// The e2e proves the rider facing half (opt in, record, tag, the rows land,
// opt out stops it) on a synthetic walk. This proves the other half, and it
// uses REAL corridor geometry rather than a made up line, because the whole
// point is that the pipeline must recognise a real ride:
//
//   PP-1  a rider signs the partner consent and opens a recording through
//         the same doors the phone uses
//   PP-2  the leg chain lands: walk, ride the corridor, walk
//   PP-3  the riding points land carrying the leg they were captured on
//   PP-4  the trip completes and carries the partner stamp
//   PP-5  the ingest adapter turns it into the pipeline's bundle shape and
//         the plan builder infers a direction and derives segment times
//         from it, exactly as it does for a gps-logger bundle
//   PP-6  running the ingest twice changes nothing (idempotent by natural
//         key: journeys on source_ref, pings on (journey, seq))
//   PP-7  the derived segment_times rows are visible to the network (they
//         are stop pairs and durations, no personal data) while the raw
//         trace behind them stays the rider's alone
//
// The geometry comes from the clean return run recorded on 2026-07-07
// (packages/db/seed/geo/corridor.route.geojson, the seeded base line), so
// the ride passes the real seeded stops. Timestamps are replayed at a
// plausible corridor pace; the gate report and the dataset statement both
// say so. The run cleans up after itself: the journey it made is discarded
// and its pipeline rows deleted with the service role.
//
// Usage: pnpm db:partner-test

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { toParsedBundle } from "../../../services/spine/src/ingest/partner.ts";
import { buildIngestPlan } from "../../../services/spine/src/ingest/plan.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
for (const f of [".env.local", ".env"]) {
  const p = join(repoRoot, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? " :: " + detail : ""}`);
  }
}

async function signIn(who) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({
    email: process.env[`TEST_${who}_EMAIL`],
    password: process.env[`TEST_${who}_PASSWORD`],
  });
  if (error) throw new Error(`sign in failed for ${who}: ${error.message}`);
  return { c, uid: data.user.id };
}

// --- the corridor, as recorded on 2026-07-07 --------------------------------
const route = JSON.parse(
  readFileSync(join(here, "..", "seed", "geo", "corridor.route.geojson"), "utf8"),
);
const line = route.features.find((f) => f.geometry?.type === "LineString");
if (!line) throw new Error("corridor.route.geojson has no LineString");
const corridor = line.geometry.coordinates; // [lng, lat] pairs

// a plausible corridor pace: the clean return run was 13.5 km in 27 riding
// minutes, so the replay spreads the base line's vertices over 27 minutes
const RIDE_MINUTES = 27;
const startedAt = Date.now() - 90 * 60_000;
const rideStart = startedAt + 5 * 60_000;
const stepMs = Math.round((RIDE_MINUTES * 60_000) / Math.max(1, corridor.length - 1));

const journeyId = crypto.randomUUID();
const A = await signIn("RIDER_A");

try {
  // PP-1 consent, then the recording opens through the product door
  await A.c
    .from("consent_records")
    .insert({ user_id: A.uid, action: "accepted", version: "journey-v1" });
  await A.c
    .from("consent_records")
    .insert({ user_id: A.uid, action: "accepted", version: "partner-v1" });
  const opened = await A.c.rpc("upsert_rider_journey", {
    p_journey: journeyId,
    p_mode: "kombi",
    p_started_at: new Date(startedAt).toISOString(),
  });
  check("PP-1 a partner opens a recording through the product door", !opened.error, opened.error?.message);

  // PP-2 the leg chain: walk to the road, ride the corridor, walk home
  const rideEnd = rideStart + RIDE_MINUTES * 60_000;
  const legs = await A.c.rpc("save_rider_journey_legs", {
    p_journey: journeyId,
    p_legs: [
      {
        leg_index: 0,
        mode: "walking",
        started_at: new Date(startedAt).toISOString(),
        ended_at: new Date(rideStart).toISOString(),
      },
      {
        leg_index: 1,
        mode: "riding",
        route_name: "Mt Pleasant Heights to Rezende",
        direction: "outbound",
        fare_cents: 150,
        started_at: new Date(rideStart).toISOString(),
        ended_at: new Date(rideEnd).toISOString(),
      },
      {
        leg_index: 2,
        mode: "walking",
        started_at: new Date(rideEnd).toISOString(),
        ended_at: new Date(rideEnd + 4 * 60_000).toISOString(),
      },
    ],
  });
  check(
    "PP-2 the leg chain lands: walk, ride the corridor, walk",
    !legs.error && legs.data === 3,
    legs.error?.message ?? String(legs.data),
  );

  // PP-3 the riding trace, each point carrying its leg
  const points = corridor.map(([lng, lat], i) => ({
    seq: i,
    lat,
    lng,
    accuracy_m: 8,
    recorded_at: new Date(rideStart + i * stepMs).toISOString(),
    leg_index: 1,
  }));
  let landed = 0;
  for (let i = 0; i < points.length; i += 400) {
    const batch = points.slice(i, i + 400);
    const res = await A.c.rpc("append_rider_journey_points", {
      p_journey: journeyId,
      p_points: batch,
    });
    if (res.error) throw new Error(`points batch failed: ${res.error.message}`);
    landed += res.data;
  }
  check(
    "PP-3 the riding trace lands with the leg each point was captured on",
    landed === points.length,
    `${landed} of ${points.length}`,
  );

  // PP-4 the rider saves; the trip carries the partner stamp
  const completed = await A.c.rpc("complete_rider_journey", {
    p_journey: journeyId,
    p_name: "Corridor replay (partner pipeline proof)",
    p_mode: "kombi",
    p_ended_at: new Date(rideEnd + 4 * 60_000).toISOString(),
    p_distance_m: 13_500,
  });
  const stamped = await A.c
    .from("rider_journeys")
    .select("partner_consent_version, status")
    .eq("id", journeyId)
    .single();
  check(
    "PP-4 the saved trip carries the partner stamp the pipeline reads",
    !completed.error &&
      stamped.data?.status === "complete" &&
      stamped.data?.partner_consent_version === "partner-v1",
    completed.error?.message ?? JSON.stringify(stamped.data),
  );

  // --- the pipeline hop ------------------------------------------------------
  const { data: routeRow } = await admin
    .from("routes")
    .select("id")
    .eq("code", "HEIGHTS-REZENDE")
    .single();
  const { data: routeStops } = await admin
    .from("route_stops")
    .select("seq, stops (id, lat, lng)")
    .eq("route_id", routeRow.id)
    .eq("direction", "outbound")
    .order("seq");
  const stops = (routeStops ?? []).map((r) => ({
    id: r.stops.id,
    lat: r.stops.lat,
    lng: r.stops.lng,
  }));

  const { data: dbJourney } = await admin
    .from("rider_journeys")
    .select("id, rider_id, name, started_at, ended_at")
    .eq("id", journeyId)
    .single();
  const { data: dbLegs } = await admin
    .from("rider_journey_legs")
    .select("leg_index, mode")
    .eq("journey_id", journeyId)
    .order("leg_index");
  const { data: dbPoints } = await admin
    .from("rider_journey_points")
    .select("seq, leg_index, lat, lng, accuracy_m, recorded_at")
    .eq("journey_id", journeyId)
    .order("seq");

  const bundle = toParsedBundle(dbJourney, dbLegs, dbPoints);
  const plan = buildIngestPlan(bundle, stops, "real_field_ride");
  check(
    "PP-5 the plan builder infers a direction and derives segment times from a partner trip",
    plan.journey.direction === "outbound" &&
      plan.passes.length >= 2 &&
      plan.segments.length >= 1 &&
      plan.pings.every((p) => p.source === "real_field_ride"),
    `direction ${plan.journey.direction}, ${plan.passes.length} passes, ${plan.segments.length} segments`,
  );

  // write it the way the ingest script does, twice
  const writeOnce = async () => {
    const { data: j } = await admin
      .from("journeys")
      .upsert(
        { ...plan.journey, route_id: routeRow.id, uploaded_by: dbJourney.rider_id },
        { onConflict: "source_ref" },
      )
      .select("id")
      .single();
    for (let i = 0; i < plan.pings.length; i += 500) {
      await admin
        .from("gps_pings")
        .upsert(
          plan.pings.slice(i, i + 500).map((p) => ({ ...p, journey_id: j.id })),
          { onConflict: "journey_id,seq", ignoreDuplicates: true },
        );
    }
    await admin
      .from("segment_times")
      .upsert(
        plan.segments.map((s) => ({ ...s, journey_id: j.id, route_id: routeRow.id })),
        { onConflict: "journey_id,from_stop_id,to_stop_id" },
      );
    const { count: pings } = await admin
      .from("gps_pings")
      .select("*", { count: "exact", head: true })
      .eq("journey_id", j.id);
    const { count: segments } = await admin
      .from("segment_times")
      .select("*", { count: "exact", head: true })
      .eq("journey_id", j.id);
    return { id: j.id, pings, segments };
  };

  const first = await writeOnce();
  const second = await writeOnce();
  check(
    "PP-6 a partner trip lands in journeys, gps_pings and segment_times, and re running changes nothing",
    first.id === second.id &&
      first.pings === second.pings &&
      first.segments === second.segments &&
      first.pings === plan.pings.length &&
      first.segments === plan.segments.length,
    JSON.stringify({ first, second }),
  );

  // PP-7 what the network can see, and what it still cannot
  const B = await signIn("RIDER_B");
  const segmentsPublic = await B.c
    .from("segment_times")
    .select("id")
    .eq("journey_id", first.id);
  const traceCross = await B.c
    .from("rider_journey_points")
    .select("seq")
    .eq("journey_id", journeyId);
  const pipelinePingsCross = await B.c
    .from("gps_pings")
    .select("id")
    .eq("journey_id", first.id);
  check(
    "PP-7 the derived segment times are the network's, the raw trace is still only the rider's",
    !segmentsPublic.error &&
      (segmentsPublic.data ?? []).length === plan.segments.length &&
      (traceCross.data ?? []).length === 0 &&
      (pipelinePingsCross.data ?? []).length === 0,
    JSON.stringify({
      segments: segmentsPublic.data?.length,
      trace: traceCross.data?.length,
      pings: pipelinePingsCross.data?.length,
    }),
  );

  // clean up: the pipeline rows this proof made, then the rider's trip
  await admin.from("journeys").delete().eq("id", first.id);
} finally {
  await admin.from("rider_journeys").delete().eq("id", journeyId);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
