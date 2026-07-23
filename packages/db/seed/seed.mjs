// Idempotent demo seed for rehearsal. Creates three demo people with roles,
// gives the rider some wallet credit, and seeds the verified Harare network
// (routes, stops, walking transfers, dated fare segments) from network.json,
// using the service role key (seed + CI only, never in app code). Safe to run
// repeatedly. Network provenance and the 2026 fare derivation are documented
// in network.json _meta; nothing here is invented.
//
// Demo users are created with email + password so rehearsal and CI can sign in
// deterministically with no SMS provider wired (the product login is phone OTP;
// these accounts also carry a phone number for when the phone provider and test
// OTP numbers are enabled). This mirrors the mock-twin rule: the demo never
// depends on a live vendor.
//
// Usage: pnpm db:seed
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const f of [".env.local", ".env"]) {
  const p = join(repoRoot, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

// $25 rehearsal credit: the full e2e suite (P1 flows + P2 offline boarding)
// buys around $12 of wallet fares per run; the refill must outlast a run
const RIDER_TOPUP_CENTS = 2500;

const people = [
  {
    key: "RIDER",
    fullName: "Demo Rider",
    lang: "en",
    email: process.env.DEMO_RIDER_EMAIL,
    phone: process.env.DEMO_RIDER_PHONE,
    password: process.env.DEMO_RIDER_PASSWORD,
    role: "rider",
  },
  {
    key: "OWNER",
    fullName: "Demo Owner",
    lang: "en",
    email: process.env.DEMO_OWNER_EMAIL,
    phone: process.env.DEMO_OWNER_PHONE,
    password: process.env.DEMO_OWNER_PASSWORD,
    role: "owner",
  },
  {
    key: "CONDUCTOR",
    fullName: "Demo Hwindi",
    lang: "sn",
    email: process.env.DEMO_CONDUCTOR_EMAIL,
    phone: process.env.DEMO_CONDUCTOR_PHONE,
    password: process.env.DEMO_CONDUCTOR_PASSWORD,
    role: "conductor",
  },
];

async function findUserByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function ensureUser(p) {
  if (!p.email || !p.password) {
    throw new Error(`missing DEMO_${p.key}_EMAIL / _PASSWORD in .env.local`);
  }
  let user = await findUserByEmail(p.email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: p.email,
      password: p.password,
      email_confirm: true,
      user_metadata: { full_name: p.fullName },
    });
    if (error) throw error;
    user = data.user;
    console.log(`created ${p.key} ${p.email}`);
  } else {
    await admin.auth.admin.updateUserById(user.id, { password: p.password });
    console.log(`updated ${p.key} ${p.email}`);
  }

  // profile is created by the on-signup trigger; set the display fields
  const { error: pErr } = await admin
    .from("profiles")
    .update({ full_name: p.fullName, phone: p.phone, preferred_language: p.lang })
    .eq("id", user.id);
  if (pErr) throw pErr;
  return user.id;
}

async function ensureOwner(uid, displayName) {
  const { data } = await admin
    .from("owners")
    .select("id")
    .eq("profile_id", uid)
    .maybeSingle();
  if (data) return data.id;
  const { data: ins, error } = await admin
    .from("owners")
    .insert({ profile_id: uid, display_name: displayName })
    .select("id")
    .single();
  if (error) throw error;
  return ins.id;
}

async function ensureConductor(uid, ownerId) {
  const { data } = await admin
    .from("conductors")
    .select("id")
    .eq("profile_id", uid)
    .maybeSingle();
  if (data) return data.id;
  // commission stays 0: real rates come from fieldwork, never invented here.
  const { data: ins, error } = await admin
    .from("conductors")
    .insert({ profile_id: uid, owner_id: ownerId, commission_rate_bps: 0 })
    .select("id")
    .single();
  if (error) throw error;
  return ins.id;
}

// the staging vehicle registry (batch K1): four kombis for the demo fleet,
// matching the four simulated map markers (apps/web/src/lib/kombi/fleet.ts).
// Plates are staging inventions and the 16 seats mirror the watchdog
// simulator's parked assumption (docs/CHECKS-FOR-MHOFU.md); real plates and
// capacities arrive from fieldwork. No fare history is invented for them:
// every kombi starts unverified, which is the trust surface's default truth.
const STAGING_VEHICLES = [
  { plate: "AEZ 4821", capacity: 16 },
  { plate: "AFK 2903", capacity: 16 },
  { plate: "AGT 1157", capacity: 16 },
  { plate: "ADR 7346", capacity: 16 },
];

async function ensureVehicles(ownerId) {
  for (const v of STAGING_VEHICLES) {
    const { data } = await admin
      .from("vehicles")
      .select("id")
      .eq("plate", v.plate)
      .maybeSingle();
    if (data) continue;
    const { error } = await admin
      .from("vehicles")
      .insert({ owner_id: ownerId, plate: v.plate, capacity: v.capacity });
    if (error) throw error;
    console.log(`created vehicle ${v.plate}`);
  }
}

// a conductor clears fares only on routes they are assigned to work
// (migration 0018); assignments are service role writes, so the seed is
// the only place they are created for rehearsal
async function ensureAssignment(conductorId, routeCode) {
  const { data: route } = await admin
    .from("routes")
    .select("id")
    .eq("code", routeCode)
    .maybeSingle();
  if (!route) return;
  const { data } = await admin
    .from("conductor_route_assignments")
    .select("id, active")
    .eq("conductor_id", conductorId)
    .eq("route_id", route.id)
    .maybeSingle();
  if (data) {
    if (!data.active) {
      const { error } = await admin
        .from("conductor_route_assignments")
        .update({ active: true })
        .eq("id", data.id);
      if (error) throw error;
    }
    return;
  }
  const { error } = await admin
    .from("conductor_route_assignments")
    .insert({ conductor_id: conductorId, route_id: route.id });
  if (error) throw error;
  console.log(`assigned conductor ${conductorId} to ${routeCode}`);
}

// rehearsals and e2e runs walk the failure paths on purpose; reset the demo
// conductor's attempt log so repeated runs never start rate limited
async function resetAttemptLog(uid) {
  const { data, error } = await admin.rpc("reset_conductor_attempt_log", {
    p_profile: uid,
  });
  if (error) throw error;
  if (data > 0) console.log(`reset CONDUCTOR attempt log (${data} rows)`);
}

async function topUpRider(uid) {
  const { data: wallet } = await admin
    .from("ledger_accounts")
    .select("id")
    .eq("profile_id", uid)
    .eq("kind", "rider_wallet")
    .maybeSingle();
  if (!wallet) throw new Error("rider wallet was not created by the trigger");
  const { data: bal } = await admin
    .from("account_balances")
    .select("balance_cents")
    .eq("account_id", wallet.id)
    .maybeSingle();
  // refill to the rehearsal level whenever a full e2e run could no longer
  // pay its way; the ledger keeps the history either way
  const current = bal?.balance_cents ?? 0;
  if (current >= 1500) return;
  const { error } = await admin.rpc("record_topup", {
    p_profile: uid,
    p_amount_cents: RIDER_TOPUP_CENTS - current,
    p_memo: "demo refill",
  });
  if (error) throw error;
  console.log(`topped up RIDER to ${RIDER_TOPUP_CENTS}c`);
}

// --- network -------------------------------------------------------------
const network = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "network.json"), "utf8"),
);

async function ensureStop(slug, def) {
  const { data } = await admin
    .from("stops")
    .select("id, lat, lng")
    .eq("name", def.name)
    .maybeSingle();
  if (data) {
    // reconcile coordinates so real ride data wins on re-seed (e.g. the Rezende
    // rank moving from the v2 map estimate to the GPS marked point). Idempotent:
    // once the row matches the seed, no further update runs.
    if (data.lat !== def.lat || data.lng !== def.lng) {
      const { error } = await admin
        .from("stops")
        .update({ lat: def.lat, lng: def.lng })
        .eq("id", data.id);
      if (error) throw new Error(`stop ${slug}: ${error.message}`);
      console.log(`moved stop ${def.name} to (${def.lat}, ${def.lng})`);
    }
    return data.id;
  }
  const { data: ins, error } = await admin
    .from("stops")
    .insert({ name: def.name, lat: def.lat, lng: def.lng })
    .select("id")
    .single();
  if (error) throw new Error(`stop ${slug}: ${error.message}`);
  console.log(`created stop ${def.name}`);
  return ins.id;
}

async function ensureRoute(r) {
  const { data } = await admin
    .from("routes")
    .select("id, typical_duration_minutes")
    .eq("code", r.code)
    .maybeSingle();
  if (data) {
    if (data.typical_duration_minutes !== r.typical_duration_minutes) {
      const { error } = await admin
        .from("routes")
        .update({ typical_duration_minutes: r.typical_duration_minutes })
        .eq("id", data.id);
      if (error) throw error;
    }
    return data.id;
  }
  const { data: ins, error } = await admin
    .from("routes")
    .insert({
      code: r.code,
      name: r.name,
      typical_duration_minutes: r.typical_duration_minutes,
    })
    .select("id")
    .single();
  if (error) throw new Error(`route ${r.code}: ${error.message}`);
  console.log(`created route ${r.code}`);
  return ins.id;
}

async function ensureRouteStops(routeId, stopIds) {
  const { data: existing, error: exErr } = await admin
    .from("route_stops")
    .select("direction, seq, stop_id")
    .eq("route_id", routeId)
    .order("seq");
  if (exErr) throw exErr;
  const want = [];
  stopIds.forEach((sid, i) =>
    want.push({ route_id: routeId, direction: "outbound", seq: i, stop_id: sid }),
  );
  [...stopIds]
    .reverse()
    .forEach((sid, i) =>
      want.push({ route_id: routeId, direction: "inbound", seq: i, stop_id: sid }),
    );
  const same =
    existing.length === want.length &&
    want.every((w) =>
      existing.some(
        (e) =>
          e.direction === w.direction && e.seq === w.seq && e.stop_id === w.stop_id,
      ),
    );
  if (same) return;
  if (existing.length) {
    const { error } = await admin.from("route_stops").delete().eq("route_id", routeId);
    if (error) throw error;
  }
  const { error } = await admin.from("route_stops").insert(want);
  if (error) throw error;
  console.log(`wrote stop sequence for route ${routeId}`);
}

async function ensureRouteFare(routeId, fareCents, effectiveFrom) {
  const { data } = await admin.rpc("current_fare_cents", { p_route: routeId });
  if (data === fareCents) return;
  const { error } = await admin
    .from("route_fares")
    .insert({
      route_id: routeId,
      fare_cents: fareCents,
      effective_from: effectiveFrom,
    });
  if (error) throw error;
  console.log(`route ${routeId}: end to end fare set to ${fareCents}c`);
}

async function ensureFareSegment(routeId, fromId, toId, fareCents, effectiveFrom) {
  const { data, error: selErr } = await admin
    .from("fare_segments")
    .select("id")
    .eq("route_id", routeId)
    .eq("from_stop_id", fromId)
    .eq("to_stop_id", toId)
    .eq("fare_cents", fareCents)
    .eq("effective_from", effectiveFrom)
    .maybeSingle();
  if (selErr) throw selErr;
  if (data) return;
  const { error } = await admin.from("fare_segments").insert({
    route_id: routeId,
    from_stop_id: fromId,
    to_stop_id: toId,
    fare_cents: fareCents,
    effective_from: effectiveFrom,
  });
  if (error) throw error;
}

async function ensureTransfer(tp, stopIdBySlug) {
  const fromId = stopIdBySlug[tp.from];
  const toId = stopIdBySlug[tp.to];
  const { data } = await admin
    .from("transfer_points")
    .select("id")
    .eq("from_stop_id", fromId)
    .eq("to_stop_id", toId)
    .maybeSingle();
  if (data) return;
  const { error } = await admin.from("transfer_points").insert({
    from_stop_id: fromId,
    to_stop_id: toId,
    kind: tp.kind,
    walk_meters: tp.walk_meters,
    walk_minutes: tp.walk_minutes,
    notes: tp.notes,
  });
  if (error) throw error;
  console.log(`created transfer ${tp.from} -> ${tp.to}`);
}

async function seedNetwork() {
  const effectiveFrom = network._meta.fares_effective_from;
  const stopIdBySlug = {};
  for (const [slug, def] of Object.entries(network.stops)) {
    stopIdBySlug[slug] = await ensureStop(slug, def);
  }
  for (const r of network.routes) {
    // a route may date its own fares (the real corridor fare is dated to the
    // ride day so it supersedes the older carryover fare); default to the meta
    const routeEffective = r.fares_effective_from ?? effectiveFrom;
    const routeId = await ensureRoute(r);
    await ensureRouteStops(
      routeId,
      r.stops.map((s) => stopIdBySlug[s]),
    );
    await ensureRouteFare(routeId, r.default_fare_cents, routeEffective);
    for (const seg of r.fare_segments) {
      await ensureFareSegment(
        routeId,
        stopIdBySlug[seg.from],
        stopIdBySlug[seg.to],
        seg.fare_cents,
        routeEffective,
      );
    }
  }
  for (const tp of network.transfers) await ensureTransfer(tp, stopIdBySlug);
  console.log("network seeded: routes, stops, transfers, dated fare segments.");
}

// the RLS test riders drain their wallets a little on every run; keep them
// funded so the security suite never fails on balance instead of security
async function refillTestRiders() {
  for (const key of ["TEST_RIDER_A_EMAIL", "TEST_RIDER_B_EMAIL"]) {
    const email = process.env[key];
    if (!email) continue;
    const user = await findUserByEmail(email);
    if (!user) continue;
    await topUpRider(user.id);
  }
}

// every surface sits behind first use consent (migration 0021); the demo
// people arrive consented so rehearsal and e2e flows start inside the app
async function ensureConsent(uid) {
  const { data, error } = await admin
    .from("consent_records")
    .select("action")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data?.action === "accepted") return;
  const { error: insErr } = await admin
    .from("consent_records")
    .insert({ user_id: uid, action: "accepted", version: "v1" });
  if (insErr) throw insErr;
  console.log(`recorded consent for ${uid}`);
}

// the consent e2e proof needs a user who has never consented. Derived from
// the rider creds (a plus alias, same password), created like any demo
// person, then reset to unconsented and unanonymised before every run. This
// service role delete is why consent_records carries no forbid_mutation
// trigger (see migration 0021); clients still have no mutation path at all.
async function ensureFreshUser() {
  const riderEmail = process.env.DEMO_RIDER_EMAIL;
  const password = process.env.DEMO_RIDER_PASSWORD;
  const [local, domain] = riderEmail.split("@");
  const email = `${local}+fresh@${domain}`;
  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Fresh Rider" },
    });
    if (error) throw error;
    user = data.user;
    console.log(`created FRESH ${email}`);
  }
  const { error: cErr } = await admin
    .from("consent_records")
    .delete()
    .eq("user_id", user.id);
  if (cErr) throw cErr;
  const { error: pErr } = await admin
    .from("profiles")
    .update({ full_name: "Fresh Rider", phone: null, anonymised_at: null })
    .eq("id", user.id);
  if (pErr) throw pErr;
  console.log("FRESH user reset to unconsented");
}

// profile e2e determinism: prefs and emergency details start empty each run
async function resetProfilePersonal(uid) {
  const { error: prefErr } = await admin
    .from("rider_prefs")
    .delete()
    .eq("rider_id", uid);
  if (prefErr) throw prefErr;
  const { error: edErr } = await admin
    .from("emergency_details")
    .delete()
    .eq("rider_id", uid);
  if (edErr) throw edErr;
}

const ids = {};
for (const p of people) ids[p.key] = await ensureUser(p);
for (const key of Object.keys(ids)) await ensureConsent(ids[key]);
await ensureFreshUser();
await resetProfilePersonal(ids.RIDER);

const ownerId = await ensureOwner(ids.OWNER, "Demo Fleet");
const demoConductorId = await ensureConductor(ids.CONDUCTOR, ownerId);
await ensureVehicles(ownerId);
await resetAttemptLog(ids.CONDUCTOR);
await topUpRider(ids.RIDER);
await refillTestRiders();
await seedNetwork();

// --- demo door personas (migration 0022) -----------------------------------
// Judges enter through the landing page door as pooled personas (all named
// Tino), claimed least recently used so concurrent visitors never share a
// session. demo_sim on the profile flags every row they own as demo data;
// per visit state (float, saved trip, consent) is rebuilt by demo_reset_mine.
const JUDGE_POOL_SIZE = 6;
async function ensureDemoPool() {
  const password = process.env.DEMO_JUDGE_PASSWORD;
  if (!password) {
    console.log("DEMO_JUDGE_PASSWORD not set; skipping demo persona pool");
    return;
  }
  for (let i = 1; i <= JUDGE_POOL_SIZE; i++) {
    const email = `demo.tariro.${String(i).padStart(2, "0")}@svika.app`;
    let user = await findUserByEmail(email);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Tino" },
      });
      if (error) throw error;
      user = data.user;
      console.log(`created demo persona ${email}`);
    } else {
      await admin.auth.admin.updateUserById(user.id, { password });
    }
    const { error: pErr } = await admin
      .from("profiles")
      .update({ full_name: "Tino", preferred_language: "en", demo_sim: true })
      .eq("id", user.id);
    if (pErr) throw pErr;
    const { error: poolErr } = await admin
      .from("demo_pool")
      .upsert(
        { profile_id: user.id, persona: "Tino", email },
        { onConflict: "profile_id" },
      );
    if (poolErr) throw poolErr;
  }
  // the owner door reuses the rehearsal owner; flag its rows as demo data too
  const { error: oErr } = await admin
    .from("profiles")
    .update({ demo_sim: true })
    .eq("id", ids.OWNER);
  if (oErr) throw oErr;
  console.log(`demo pool ready (${JUDGE_POOL_SIZE} personas)`);
}
await ensureDemoPool();

// Takunda: the commute alert demo persona. A named account outside the
// judge pool (his history is his story) with the alert pref on and a
// believable daily commute on the real corridor. The rides are fixture
// data, enumerated in demo_commute_fixtures and rebuilt around the seed
// moment so the mined window is live whenever the demo runs; no money
// moves for fixtures (disclosure register entry).
const TAKUNDA_EMAIL = "demo.takunda@svika.app";
const TAKUNDA_HISTORY_DAYS = 14;
async function ensureTakunda() {
  const password = process.env.DEMO_JUDGE_PASSWORD;
  if (!password) {
    console.log("DEMO_JUDGE_PASSWORD not set; skipping Takunda persona");
    return;
  }
  let user = await findUserByEmail(TAKUNDA_EMAIL);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: TAKUNDA_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Takunda" },
    });
    if (error) throw error;
    user = data.user;
    console.log(`created demo persona ${TAKUNDA_EMAIL}`);
  } else {
    await admin.auth.admin.updateUserById(user.id, { password });
  }
  const { error: pErr } = await admin
    .from("profiles")
    .update({ full_name: "Takunda", preferred_language: "en", demo_sim: true })
    .eq("id", user.id);
  if (pErr) throw pErr;

  await ensureConsent(user.id);
  await topUpRider(user.id);

  const { error: prefErr } = await admin
    .from("rider_prefs")
    .upsert(
      { rider_id: user.id, commute_alerts: true, voice_en: true, voice_sn: true },
      { onConflict: "rider_id" },
    );
  if (prefErr) throw prefErr;

  const { data: route } = await admin
    .from("routes")
    .select("id")
    .eq("code", "HEIGHTS-REZENDE")
    .single();
  const { data: stops } = await admin
    .from("route_stops")
    .select("stop_id, seq")
    .eq("route_id", route.id)
    .eq("direction", "outbound")
    .order("seq");
  const from = stops[0].stop_id;
  const to = stops[stops.length - 1].stop_id;

  const { error: tripErr } = await admin.from("saved_trips").upsert(
    {
      rider_id: user.id,
      from_stop_id: from,
      to_stop_id: to,
      nickname: "Kubasa",
    },
    { onConflict: "rider_id,from_stop_id,to_stop_id" },
  );
  if (tripErr) throw tripErr;

  // one ride per day for two weeks, centred a few minutes before the seed
  // moment with light jitter, so "now" always sits in the mined window
  const rides = [];
  for (let d = 0; d < TAKUNDA_HISTORY_DAYS; d++) {
    const jitterMinutes = 6 + ((d * 7) % 20);
    const at = new Date(Date.now() - d * 24 * 60 * 60_000 - jitterMinutes * 60_000);
    rides.push({ at: at.toISOString() });
  }
  const { data: inserted, error: histErr } = await admin.rpc(
    "reset_demo_commute_history",
    {
      p_profile: user.id,
      p_route: route.id,
      p_direction: "outbound",
      p_from: from,
      p_to: to,
      p_fare_cents: 150,
      p_rides: rides,
    },
  );
  if (histErr) throw histErr;
  console.log(`Takunda ready with ${inserted} fixture rides`);
}
await ensureTakunda();

// Rudo: the night ride story persona. No fixture history; her story starts
// with a stolen wallet (the story reset floats her to zero), a friend's
// credit transfer, a booking and a shared live ride.
const RUDO_EMAIL = "demo.rudo@svika.app";
async function ensureRudo() {
  const password = process.env.DEMO_JUDGE_PASSWORD;
  if (!password) {
    console.log("DEMO_JUDGE_PASSWORD not set; skipping Rudo persona");
    return;
  }
  let user = await findUserByEmail(RUDO_EMAIL);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: RUDO_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Rudo" },
    });
    if (error) throw error;
    user = data.user;
    console.log(`created demo persona ${RUDO_EMAIL}`);
  } else {
    await admin.auth.admin.updateUserById(user.id, { password });
  }
  const { error: pErr } = await admin
    .from("profiles")
    .update({ full_name: "Rudo", preferred_language: "en", demo_sim: true })
    .eq("id", user.id);
  if (pErr) throw pErr;
  await ensureConsent(user.id);
  console.log("Rudo ready");
}
await ensureRudo();

// route assignments: the demo hwindi works every corridor the rehearsal
// and e2e flows drive (owner.spec clears a MARKETSQ-AVONDALE fare); the RLS
// test conductor covers the synthetic TEST-01 route plus the corridor the
// offline proof suite replays
for (const code of ["HEIGHTS-REZENDE", "WESTGATE-COPA", "MARKETSQ-AVONDALE"]) {
  await ensureAssignment(demoConductorId, code);
}
if (process.env.TEST_CONDUCTOR_EMAIL) {
  const testUser = await findUserByEmail(process.env.TEST_CONDUCTOR_EMAIL);
  if (testUser) {
    const { data: testConductor } = await admin
      .from("conductors")
      .select("id")
      .eq("profile_id", testUser.id)
      .maybeSingle();
    if (testConductor) {
      for (const code of ["TEST-01", "HEIGHTS-REZENDE"]) {
        await ensureAssignment(testConductor.id, code);
      }
    }
  }
}

console.log(
  "\nseed complete: rider, owner, conductor and network ready for rehearsal.",
);
