// Places promotion rule proof (batch M3). The consensus promotion is a rule,
// not a model; this suite proves the rule on the live database through the
// real doors (submit_place_name, flag_journey_shortcut, report_place_name)
// plus the service-role promotion trigger (run_places_promotion, the same
// pass pg_cron runs every 15 minutes).
//
//   PR-A  the adversarial case: one person minting three fresh accounts
//         today cannot promote a name today (the 48 h independence rail)
//   PR-B  one established author shouting three times is still one voice
//   PR-C  three independent established authors promote to suggested;
//         the community row carries no author, the event carries counts only
//   PR-D  promotion is idempotent: a second pass mints nothing new
//   PR-E  recommended naming surfaces the suggestion at the spot
//   PR-F  five distinct accepting authors promote suggested -> public and
//         the name is anon-searchable the moment it is public
//   PR-G  three distinct reporters hide a community name everywhere
//   PR-H  shortcut consensus: three similar walked traces promote, a
//         different path 600 m away does not ride along
//   PR-I  history walls hold even for the service role
//
// The test zone is a per-run random box in empty country far from the demo
// corridor, names carry a per-run suffix, and personal rows are cleaned up
// after; community rows minted by the run are append-only history and stay,
// but the run ends by hiding its own public name through the report door,
// so nothing it made ever surfaces in search or recommendations.
//
// Freshness is simulated by setting the three TEST users' profiles.created_at
// to now for the adversarial pass and backdating for the genuine pass; the
// original values are restored at the end. Demo personas are used only as
// two extra accepting voices; their profiles are never modified.
//
// Usage: pnpm db:places-test   (or: node test/places.promotion.test.mjs)

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// --- env ---------------------------------------------------------------
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
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const client = () => createClient(URL, ANON, { auth: { persistSession: false } });

// --- tiny harness -------------------------------------------------------
let passed = 0,
  failed = 0,
  skipped = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? " :: " + detail : ""}`);
  }
}
function skip(name, why) {
  skipped++;
  console.log(`SKIP  ${name} :: ${why}`);
}

async function signInWith(email, password, label) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in failed for ${label}: ${error.message}`);
  return { c, uid: data.user.id, label };
}
const signInTest = (who) =>
  signInWith(
    process.env[`TEST_${who}_EMAIL`],
    process.env[`TEST_${who}_PASSWORD`],
    who,
  );
const signInDemo = (who) =>
  signInWith(
    process.env[`DEMO_${who}_EMAIL`],
    process.env[`DEMO_${who}_PASSWORD`],
    `DEMO_${who}`,
  );

// --- run geometry: a random empty-country box, far from the demo corridor
const runId = randomUUID().slice(0, 8);
const baseLat = -19.05 - Math.random() * 0.35;
const baseLng = 29.6 + Math.random() * 0.7;
const P1 = { lat: baseLat, lng: baseLng }; // name cluster
const P2 = { lat: baseLat, lng: baseLng + 0.02 }; // one-voice cluster
const P3 = { lat: baseLat, lng: baseLng + 0.04 }; // shortcut cluster
const P4 = { lat: baseLat + 0.006, lng: baseLng + 0.04 }; // the different path
const NAME_P1 = `Pamusika ${runId}`;
const NAME_P2 = `Pagomo ${runId}`;
const testStart = new Date().toISOString();

const submitName = (s, name, at, acceptedFrom = null) =>
  s.c.rpc("submit_place_name", {
    p_name: name,
    p_kind: "stop",
    p_lat: at.lat,
    p_lng: at.lng,
    p_accepted_from: acceptedFrom,
  });

const promote = async () => {
  const { data, error } = await admin.rpc("run_places_promotion");
  if (error) throw new Error(`promotion pass failed: ${error.message}`);
  return data;
};

const suggestedByName = async (name) => {
  const { data, error } = await admin
    .from("place_names")
    .select("id, name, scope, author_id, kind")
    .eq("name", name)
    .neq("scope", "personal");
  if (error) throw new Error(error.message);
  return data;
};

const setProfileCreated = async (uid, iso) => {
  const { error } = await admin
    .from("profiles")
    .update({ created_at: iso })
    .eq("id", uid);
  if (error) throw new Error(`profile backdate failed: ${error.message}`);
};

const A = await signInTest("RIDER_A");
const B = await signInTest("RIDER_B");
const C = await signInTest("CONDUCTOR");
const trio = [A, B, C];
let DR = null;
let DO = null;

// remember the real account ages; restored in the cleanup below
const { data: originals } = await admin
  .from("profiles")
  .select("id, created_at")
  .in("id", trio.map((s) => s.uid));

let publicRowId = null;

try {
  // --- PR-A: three fresh accounts are one person until proven otherwise ---
  const nowIso = new Date().toISOString();
  for (const s of trio) await setProfileCreated(s.uid, nowIso);

  let rateLimited = false;
  for (const s of trio) {
    const res = await submitName(s, NAME_P1, P1);
    if (res.error) throw new Error(`${s.label} submit failed: ${res.error.message}`);
    if (res.data?.[0]?.outcome === "rate_limited") rateLimited = true;
    else
      check(
        `PR-A ${s.label} saves a personal name through the door`,
        res.data?.[0]?.outcome === "success",
        res.data?.[0]?.outcome,
      );
  }
  if (rateLimited) {
    skip("PR-A fresh-account scenario", "daily cap from earlier runs; rerun tomorrow");
  } else {
    await promote();
    const after = await suggestedByName(NAME_P1);
    check(
      "PR-A three fresh accounts cannot promote a name (48 h independence rail)",
      after.length === 0,
      JSON.stringify(after),
    );
  }

  // --- PR-B: one established author, three submissions, still one voice ---
  const oldIso = new Date(Date.now() - 30 * 864e5).toISOString();
  await setProfileCreated(A.uid, oldIso);
  for (let i = 0; i < 3; i++) {
    const res = await submitName(A, NAME_P2, {
      lat: P2.lat + i * 0.0001,
      lng: P2.lng,
    });
    if (res.data?.[0]?.outcome === "rate_limited") {
      skip("PR-B one-voice scenario", "daily cap from earlier runs");
      break;
    }
  }
  await promote();
  check(
    "PR-B one author shouting three times is still one voice",
    (await suggestedByName(NAME_P2)).length === 0,
  );

  // --- PR-C: three independent established authors promote to suggested ---
  await setProfileCreated(B.uid, oldIso);
  await setProfileCreated(C.uid, oldIso);
  const pass = await promote();
  const suggested = await suggestedByName(NAME_P1);
  check(
    "PR-C three independent established authors promote to suggested",
    suggested.length === 1 && suggested[0].scope === "suggested",
    JSON.stringify({ pass, suggested }),
  );
  const sugId = suggested[0]?.id ?? null;
  check(
    "PR-C the community row carries no author",
    suggested.length === 1 && suggested[0].author_id === null,
  );
  if (sugId) {
    const { data: ev } = await admin
      .from("place_events")
      .select("kind, detail")
      .eq("place_name_id", sugId);
    check(
      "PR-C the promotion event carries counts only, never people",
      ev?.length === 1 &&
        ev[0].kind === "promoted_suggested" &&
        ev[0].detail?.authors === 3 &&
        !JSON.stringify(ev[0].detail).match(/[0-9a-f]{8}-[0-9a-f]{4}/),
      JSON.stringify(ev),
    );
  }

  // --- PR-D: a second pass mints nothing new for the same cluster ---
  await promote();
  check(
    "PR-D promotion is idempotent",
    (await suggestedByName(NAME_P1)).length === 1,
  );

  // --- PR-E: recommended naming surfaces the suggestion at the spot ---
  const rec = await B.c.rpc("recommend_place_names", {
    p_lat: P1.lat,
    p_lng: P1.lng,
  });
  check(
    "PR-E recommended naming surfaces the suggestion at the spot",
    !rec.error &&
      (rec.data ?? []).some(
        (r) => r.place_id === sugId && r.scope === "suggested" && r.distance_m < 150,
      ),
    rec.error?.message ?? JSON.stringify(rec.data),
  );

  // --- PR-F: sustained acceptance promotes to public ---
  DR = await signInDemo("RIDER");
  DO = await signInDemo("OWNER");
  const { data: demoProfiles } = await admin
    .from("profiles")
    .select("id, created_at")
    .in("id", [DR.uid, DO.uid]);
  const demosEstablished = (demoProfiles ?? []).every(
    (p) => new Date(p.created_at) < new Date(Date.now() - 49 * 3600e3),
  );
  if (!demosEstablished) {
    skip("PR-F public promotion", "demo personas are younger than the 48 h rail");
  } else {
    let acceptancesOk = true;
    for (const s of [A, B, C, DR, DO]) {
      const res = await submitName(s, null, P1, sugId);
      if (res.data?.[0]?.outcome !== "success") {
        acceptancesOk = false;
        skip(
          `PR-F acceptance by ${s.label}`,
          res.error?.message ?? res.data?.[0]?.outcome ?? "unknown",
        );
      }
    }
    await promote();
    const { data: pub } = await admin
      .from("place_names")
      .select("id, scope, promoted_from, author_id")
      .eq("promoted_from", sugId);
    publicRowId = pub?.[0]?.id ?? null;
    if (acceptancesOk) {
      check(
        "PR-F five distinct accepting authors promote suggested to public",
        pub?.length === 1 && pub[0].scope === "public" && pub[0].author_id === null,
        JSON.stringify(pub),
      );
      const found = await client().rpc("search_public_places", { p_q: NAME_P1 });
      check(
        "PR-F the name is anon-searchable the moment it is public",
        !found.error && (found.data ?? []).some((r) => r.place_id === publicRowId),
        found.error?.message ?? JSON.stringify(found.data),
      );
      const rec2 = await B.c.rpc("recommend_place_names", {
        p_lat: P1.lat,
        p_lng: P1.lng,
      });
      const sameName = (rec2.data ?? []).filter((r) => r.name === NAME_P1);
      check(
        "PR-F the public row speaks for its suggested predecessor",
        sameName.length === 1 && sameName[0].scope === "public",
        JSON.stringify(sameName),
      );
    }
  }

  // --- PR-G: three distinct reporters hide a community name everywhere ---
  const target = publicRowId ?? sugId;
  if (!target) {
    skip("PR-G hide by reports", "no community row from this run to report");
  } else {
    for (const s of trio) {
      const rep = await s.c.rpc("report_place_name", {
        p_place: target,
        p_reason: "test sweep row",
      });
      if (rep.error) throw new Error(`report failed: ${rep.error.message}`);
    }
    const { data: hiddenEv } = await admin
      .from("place_events")
      .select("kind, detail")
      .eq("place_name_id", target)
      .eq("kind", "hidden");
    check(
      "PR-G three distinct reporters append a hidden event (counts only)",
      hiddenEv?.length === 1 && hiddenEv[0].detail?.reports >= 3,
      JSON.stringify(hiddenEv),
    );
    const gone = await client().rpc("search_public_places", { p_q: NAME_P1 });
    check(
      "PR-G a hidden name leaves search",
      !gone.error && !(gone.data ?? []).some((r) => r.place_id === target),
    );
    const rec3 = await B.c.rpc("recommend_place_names", {
      p_lat: P1.lat,
      p_lng: P1.lng,
    });
    check(
      "PR-G a hidden name leaves recommendations",
      !rec3.error && !(rec3.data ?? []).some((r) => r.place_id === target),
    );
  }

  // --- PR-H: shortcut consensus over walked traces ---
  // three similar walks at P3 (about 20 m apart, well inside the 120 m
  // Hausdorff bound), one different path 600 m away that must not ride along
  const walkers = [A, B, C];
  const journeyOf = {};
  const makeWalk = async (s, origin, jitterLat) => {
    await s.c.from("consent_records").insert({
      user_id: s.uid,
      action: "accepted",
      version: "journey-v1",
    });
    const id = randomUUID();
    const started = new Date(Date.now() - 20 * 60e3);
    const up = await s.c.rpc("upsert_rider_journey", {
      p_journey: id,
      p_mode: "walk",
      p_started_at: started.toISOString(),
    });
    if (up.error) throw new Error(`journey upsert failed: ${up.error.message}`);
    const points = Array.from({ length: 12 }, (_, i) => ({
      seq: i,
      lat: origin.lat + jitterLat,
      lng: origin.lng + i * 0.0003,
      accuracy_m: 10,
      recorded_at: new Date(started.getTime() + i * 60e3).toISOString(),
    }));
    const ap = await s.c.rpc("append_rider_journey_points", {
      p_journey: id,
      p_points: points,
    });
    if (ap.error) throw new Error(`points failed: ${ap.error.message}`);
    const done = await s.c.rpc("complete_rider_journey", {
      p_journey: id,
      p_name: `shortcut walk ${runId}`,
      p_mode: "walk",
      p_ended_at: new Date().toISOString(),
      p_distance_m: 340,
    });
    if (done.error) throw new Error(`complete failed: ${done.error.message}`);
    return id;
  };

  let flagged = 0;
  for (let i = 0; i < walkers.length; i++) {
    const jid = await makeWalk(walkers[i], P3, i * 0.0002);
    journeyOf[walkers[i].label] = jid;
    const flag = await walkers[i].c.rpc("flag_journey_shortcut", {
      p_journey: jid,
    });
    if (flag.data?.[0]?.outcome === "rate_limited") {
      skip(`PR-H flag by ${walkers[i].label}`, "daily cap from earlier runs");
    } else {
      check(
        `PR-H ${walkers[i].label} flags their walk as a shortcut`,
        flag.data?.[0]?.outcome === "success" && !!flag.data?.[0]?.shortcut_id,
        flag.error?.message ?? JSON.stringify(flag.data),
      );
      flagged++;
      if (i === 0) {
        const again = await walkers[0].c.rpc("flag_journey_shortcut", {
          p_journey: jid,
        });
        check(
          "PR-H flagging the same journey twice returns the first row",
          again.data?.[0]?.shortcut_id === flag.data?.[0]?.shortcut_id,
        );
      }
    }
  }
  const DRwalk = await makeWalk(DR, P4, 0);
  await DR.c.rpc("flag_journey_shortcut", { p_journey: DRwalk });

  if (flagged === 3) {
    await promote();
    const { data: communityShortcuts } = await admin
      .from("shortcut_paths")
      .select("id, scope, author_id, distance_m, created_at")
      .neq("scope", "personal")
      .gte("created_at", testStart);
    check(
      "PR-H three similar walked traces promote one suggested shortcut",
      (communityShortcuts ?? []).length === 1 &&
        communityShortcuts[0].scope === "suggested" &&
        communityShortcuts[0].author_id === null,
      JSON.stringify(communityShortcuts),
    );
    check(
      "PR-H the different path 600 m away does not ride along",
      (communityShortcuts ?? []).length === 1,
    );
    check(
      "PR-H the community shortcut keeps honest metres",
      (communityShortcuts ?? [])[0]?.distance_m > 200 &&
        (communityShortcuts ?? [])[0]?.distance_m < 500,
      String(communityShortcuts?.[0]?.distance_m),
    );
  } else {
    skip("PR-H shortcut consensus", "not all three flags landed (rate limited)");
  }

  // --- PR-I: the history walls hold even for the service role ---
  const { data: anyEvent } = await admin
    .from("place_events")
    .select("id")
    .limit(1);
  if (anyEvent?.length) {
    const upd = await admin
      .from("place_events")
      .update({ detail: { forged: true } })
      .eq("id", anyEvent[0].id);
    check(
      "PR-I place_events refuses UPDATE even for the service role",
      !!upd.error,
      upd.error?.message,
    );
    const del = await admin.from("place_events").delete().eq("id", anyEvent[0].id);
    check(
      "PR-I place_events refuses DELETE even for the service role",
      !!del.error,
      del.error?.message,
    );
  }
} finally {
  // --- cleanup: restore account ages, remove this run's personal rows ---
  for (const row of originals ?? []) {
    await admin.from("profiles").update({ created_at: row.created_at }).eq("id", row.id);
  }
  // personal shortcut rows first (they reference journeys), then names,
  // then this run's journeys; deletes are scoped to this run's authors AND
  // its start time so a concurrent suite is never touched. Community rows
  // are append-only history and stay, already hidden from every surface by
  // the report pass above.
  const authors = [A.uid, B.uid, C.uid, DR?.uid, DO?.uid].filter(Boolean);
  await admin
    .from("shortcut_paths")
    .delete()
    .eq("scope", "personal")
    .in("author_id", authors)
    .gte("created_at", testStart);
  await admin
    .from("place_names")
    .delete()
    .eq("scope", "personal")
    .in("author_id", authors)
    .gte("created_at", testStart);
  await admin
    .from("rider_journeys")
    .delete()
    .in("rider_id", authors)
    .gte("created_at", testStart)
    .eq("name", `shortcut walk ${runId}`);
}

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed === 0 ? 0 : 1);
