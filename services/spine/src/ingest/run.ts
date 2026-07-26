// Ingests recorded rides into the ride data pipeline tables (journeys,
// gps_pings, segment_times). Idempotent by natural key: journeys on
// source_ref, pings on (journey, seq), segments on (journey, stop pair).
// Running it twice changes nothing, which the printed counts prove.
//
// Two sources, one pipeline:
//
//   * gps-logger export bundles, the original path. The tool is superseded
//     (tools/gps-logger/README.md) but its two 2026-07-07 corridor bundles
//     are the founding dataset and re ingest exactly as they always did.
//   * Svika Partner trips, read straight out of the database. A partner
//     records in the app, and the trip carries the leg tagging the pipeline
//     needs. Only trips stamped with a partner consent are ever read, and
//     that stamp exists only where a live accepted partner consent produced
//     it (migration 0047).
//
// This is a data pipeline script in the same trust tier as the seed script:
// it runs on a maintainer's machine or in CI with the service role key from
// .env.local, never inside any app. Usage:
//
//   pnpm spine:ingest                      # the two real 2026-07-07 rides
//   pnpm spine:ingest -- --route CODE --source real_field_ride <bundle.json...>
//   pnpm spine:ingest -- --partner         # every partner trip on the route
//   pnpm spine:ingest -- --partner --dry-run
//
// The route is a human's call, deliberately. A partner types a route name
// on a moving kombi and the pipeline has never trusted that string (it
// infers direction from geometry); a maintainer says which coded route a
// batch belongs to, and trips whose riding pings do not fit it are skipped
// by name.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseBundle, type ParsedBundle } from "./bundle.ts";
import {
  ingestableReason,
  toParsedBundle,
  type PartnerJourneyRow,
  type PartnerLegRow,
  type PartnerPointRow,
} from "./partner.ts";
import { buildIngestPlan, type RideSource } from "./plan.ts";
import type { OrderedStop } from "./segments.ts";
import { loadRepoEnv, repoRoot } from "../lib/env.ts";

loadRepoEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

// The two real corridor rides recorded 2026-07-07 are the default input.
const REAL_RIDES_DIR = join(repoRoot, "assets", "Takunda real kombi ride data");
const DEFAULT_BUNDLES = [
  join(
    REAL_RIDES_DIR,
    "Mount Pleasant Heights to Rezende",
    "20260707-1254_journey_2026_07_07_12_54_ij0hz8.bundle.json",
  ),
  join(
    REAL_RIDES_DIR,
    "Rezende to Mount Pleasant Heights",
    "20260707-1512_journey_2026_07_07_15_12_47ni9q.bundle.json",
  ),
];

interface CliArgs {
  routeCode: string;
  source: RideSource;
  uploaderEmail: string;
  bundlePaths: string[];
  partner: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    routeCode: "HEIGHTS-REZENDE",
    source: "real_field_ride",
    uploaderEmail: process.env.DEMO_OWNER_EMAIL ?? "",
    bundlePaths: [],
    partner: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // pnpm forwards the separator itself; it is not a bundle path
    if (a === "--") continue;
    else if (a === "--route") args.routeCode = argv[++i] ?? args.routeCode;
    else if (a === "--partner") args.partner = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--source") {
      const s = argv[++i];
      if (s !== "real_field_ride" && s !== "synthetic" && s !== "demo_sim") {
        throw new Error(`--source must be real_field_ride, synthetic or demo_sim, got ${s}`);
      }
      args.source = s;
    } else if (a === "--uploader") args.uploaderEmail = argv[++i] ?? "";
    else if (a) args.bundlePaths.push(a);
  }
  // partner trips are uploaded by the partner who recorded them, so the
  // bundle defaults and the uploader flag do not apply
  if (args.partner) return args;
  if (args.bundlePaths.length === 0) args.bundlePaths = DEFAULT_BUNDLES;
  if (!args.uploaderEmail) {
    throw new Error("no uploader: pass --uploader <email> or set DEMO_OWNER_EMAIL");
  }
  return args;
}

async function uploaderProfileId(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`no auth user with email ${email}; run pnpm db:seed first`);
  return user.id;
}

async function loadRoute(code: string): Promise<{ id: string; stops: OrderedStop[] }> {
  const { data: route, error } = await admin
    .from("routes")
    .select("id")
    .eq("code", code)
    .single();
  if (error) throw new Error(`route ${code} not found: ${error.message}`);
  const { data: rows, error: rsErr } = await admin
    .from("route_stops")
    .select("seq, stops (id, lat, lng)")
    .eq("route_id", route.id)
    .eq("direction", "outbound")
    .order("seq");
  if (rsErr) throw rsErr;
  const stops = (rows ?? []).map((r) => {
    const s = r.stops as unknown as { id: string; lat: number; lng: number };
    return { id: s.id, lat: s.lat, lng: s.lng };
  });
  if (stops.length < 2) throw new Error(`route ${code} has no outbound stop sequence`);
  return { id: route.id, stops };
}

async function countRows(table: string, journeyId: string): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("journey_id", journeyId);
  if (error) throw error;
  return count ?? 0;
}

async function ingestParsed(
  bundle: ParsedBundle,
  routeId: string,
  stops: OrderedStop[],
  source: RideSource,
  uploadedBy: string,
): Promise<void> {
  const plan = buildIngestPlan(bundle, stops, source);

  const { data: journey, error: jErr } = await admin
    .from("journeys")
    .upsert(
      { ...plan.journey, route_id: routeId, uploaded_by: uploadedBy },
      { onConflict: "source_ref" },
    )
    .select("id")
    .single();
  if (jErr) throw jErr;

  const pingsBefore = await countRows("gps_pings", journey.id);
  const BATCH = 500;
  for (let i = 0; i < plan.pings.length; i += BATCH) {
    const batch = plan.pings.slice(i, i + BATCH).map((p) => ({
      ...p,
      journey_id: journey.id,
    }));
    const { error } = await admin
      .from("gps_pings")
      .upsert(batch, { onConflict: "journey_id,seq", ignoreDuplicates: true });
    if (error) throw error;
  }
  const pingsAfter = await countRows("gps_pings", journey.id);

  const segRows = plan.segments.map((s) => ({
    ...s,
    journey_id: journey.id,
    route_id: routeId,
  }));
  const { error: sErr } = await admin
    .from("segment_times")
    .upsert(segRows, { onConflict: "journey_id,from_stop_id,to_stop_id" });
  if (sErr) throw sErr;

  // drop derived rows a recomputation no longer produces (stop set changed)
  const wanted = new Set(plan.segments.map((s) => `${s.from_stop_id}:${s.to_stop_id}`));
  const { data: existing, error: exErr } = await admin
    .from("segment_times")
    .select("id, from_stop_id, to_stop_id")
    .eq("journey_id", journey.id);
  if (exErr) throw exErr;
  const stale = (existing ?? []).filter(
    (r) => !wanted.has(`${r.from_stop_id}:${r.to_stop_id}`),
  );
  if (stale.length > 0) {
    const { error } = await admin
      .from("segment_times")
      .delete()
      .in(
        "id",
        stale.map((r) => r.id),
      );
    if (error) throw error;
  }

  console.log(
    `${plan.journey.source_ref} (${plan.journey.label}): direction ${plan.journey.direction}, ` +
      `${plan.pings.length} pings in bundle (${pingsAfter - pingsBefore} new, ${pingsAfter} total), ` +
      `${plan.passes.length} stop passes, ${plan.segments.length} segment times`,
  );
}

async function ingestBundleFile(
  path: string,
  routeId: string,
  stops: OrderedStop[],
  source: RideSource,
  uploadedBy: string,
): Promise<void> {
  const bundle = parseBundle(JSON.parse(readFileSync(path, "utf8")));
  await ingestParsed(bundle, routeId, stops, source, uploadedBy);
}

/**
 * Every partner contributed trip, oldest first. The filter is the whole
 * consent story: a trip without a partner stamp is invisible here, and only
 * the server doors can set that stamp. Raw traces are read with the service
 * role because this is the pipeline, the same trust tier as the seed; no
 * client and no other rider ever reads them (RLS, migration 0033).
 */
async function loadPartnerTrips(): Promise<
  { journey: PartnerJourneyRow & { rider_id: string }; legs: PartnerLegRow[]; points: PartnerPointRow[] }[]
> {
  const { data: journeys, error } = await admin
    .from("rider_journeys")
    .select("id, rider_id, name, started_at, ended_at")
    .eq("status", "complete")
    .not("partner_consent_version", "is", null)
    .order("started_at", { ascending: true });
  if (error) throw error;

  const trips = [];
  for (const journey of journeys ?? []) {
    const [{ data: legs, error: lErr }, { data: points, error: pErr }] =
      await Promise.all([
        admin
          .from("rider_journey_legs")
          .select("leg_index, mode")
          .eq("journey_id", journey.id)
          .order("leg_index"),
        admin
          .from("rider_journey_points")
          .select("seq, leg_index, lat, lng, accuracy_m, recorded_at")
          .eq("journey_id", journey.id)
          .order("seq"),
      ]);
    if (lErr) throw lErr;
    if (pErr) throw pErr;
    trips.push({
      journey: journey as PartnerJourneyRow & { rider_id: string },
      legs: (legs ?? []) as PartnerLegRow[],
      points: (points ?? []) as PartnerPointRow[],
    });
  }
  return trips;
}

async function ingestPartnerTrips(
  routeId: string,
  stops: OrderedStop[],
  source: RideSource,
  dryRun: boolean,
): Promise<void> {
  const trips = await loadPartnerTrips();
  console.log(`${trips.length} partner contributed trips to consider`);
  let ingested = 0;
  for (const trip of trips) {
    const bundle = toParsedBundle(trip.journey, trip.legs, trip.points);
    // a skip is always named: silence here would read as "we ingested
    // everything" when most partner trips are walks that never board
    const unusable = ingestableReason(bundle);
    if (unusable) {
      console.log(`skip ${bundle.journey.sourceRef}: ${unusable}`);
      continue;
    }
    if (dryRun) {
      console.log(
        `would ingest ${bundle.journey.sourceRef}: ${bundle.pings.length} points`,
      );
      ingested++;
      continue;
    }
    try {
      await ingestParsed(bundle, routeId, stops, source, trip.journey.rider_id);
      ingested++;
    } catch (err) {
      // a trip off this route cannot have a direction inferred against it;
      // that is a skip, not a run ending failure
      console.log(
        `skip ${bundle.journey.sourceRef}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  console.log(`${ingested} of ${trips.length} partner trips ${dryRun ? "would be " : ""}ingested`);
}

const args = parseArgs(process.argv.slice(2));
const route = await loadRoute(args.routeCode);
if (args.partner) {
  await ingestPartnerTrips(route.id, route.stops, args.source, args.dryRun);
} else {
  const uploader = await uploaderProfileId(args.uploaderEmail);
  for (const path of args.bundlePaths) {
    await ingestBundleFile(path, route.id, route.stops, args.source, uploader);
  }
}
console.log("ingest complete");
