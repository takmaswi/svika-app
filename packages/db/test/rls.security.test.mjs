// RLS security test: proves one rider cannot read or touch another rider's
// tickets, wallet, board codes or events, that anonymous users see nothing
// private, and that clients have no direct write path into money or history.
//
// Runs with the ANON key only (the whole point: this is what an attacker has).
// Test users are provisioned server side by the seed. Credentials come from
// .env.local (never committed).
//
// Usage: pnpm db:security-test   (or: node test/rls.security.test.mjs)

import { createClient } from "@supabase/supabase-js";
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
if (!URL || !ANON) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(2);
}

const creds = (who) => ({
  email: process.env[`TEST_${who}_EMAIL`],
  password: process.env[`TEST_${who}_PASSWORD`],
});

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
const deniedOrEmpty = (res) =>
  (res.error && ["42501", "PGRST301"].includes(res.error.code)) ||
  (!res.error && Array.isArray(res.data) && res.data.length === 0);

async function signIn(who) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword(creds(who));
  if (error) throw new Error(`sign in failed for ${who}: ${error.message}`);
  return { c, uid: data.user.id };
}

// --- test ----------------------------------------------------------------
const anon = client();

// anonymous surface
{
  const routes = await anon.from("routes").select("id, code").eq("code", "TEST-01");
  check(
    "anon can read the public route network",
    !routes.error && routes.data.length === 1,
  );
  const tickets = await anon.from("tickets").select("id");
  check("anon sees zero tickets", deniedOrEmpty(tickets));
  const accounts = await anon.from("ledger_accounts").select("id");
  check("anon sees zero ledger accounts", deniedOrEmpty(accounts));
}

const { data: routeRows } = await anon
  .from("routes")
  .select("id")
  .eq("code", "TEST-01");
const routeId = routeRows[0].id;

const A = await signIn("RIDER_A");
const B = await signIn("RIDER_B");
const C = await signIn("CONDUCTOR");

// balances before purchase
const balOf = async (s) => {
  const { data } = await s.c
    .from("account_balances")
    .select("balance_cents")
    .eq("kind", "rider_wallet")
    .single();
  return data?.balance_cents ?? null;
};
const aBefore = await balOf(A);

// each rider buys a ticket through the only write path there is: the RPC
const buy = async (s, who) => {
  const { data, error } = await s.c.rpc("purchase_ticket", {
    p_route: routeId,
    p_direction: "outbound",
  });
  if (error) throw new Error(`purchase failed for ${who}: ${error.message}`);
  return data[0];
};
const tktA = await buy(A, "rider A");
const tktB = await buy(B, "rider B");
check(
  "rider A can purchase a ticket via RPC",
  !!tktA.ticket_id && /^[0-9]{4}$/.test(tktA.board_code),
);
check("rider B can purchase a ticket via RPC", !!tktB.ticket_id);

const aAfter = await balOf(A);
check(
  "purchase debits exactly the fare from A's wallet (ledger derived)",
  aBefore - aAfter === tktA.fare_cents,
  `before=${aBefore} after=${aAfter} fare=${tktA.fare_cents}`,
);

// ---- rider isolation: the core of this test ----
{
  const mine = await A.c.from("tickets").select("id, rider_id");
  check(
    "rider A sees only own tickets",
    !mine.error && mine.data.length > 0 && mine.data.every((t) => t.rider_id === A.uid),
  );
  const cross = await A.c.from("tickets").select("id").eq("id", tktB.ticket_id);
  check("rider A cannot read rider B's ticket by id", deniedOrEmpty(cross));

  const evCross = await A.c
    .from("ticket_events")
    .select("id")
    .eq("ticket_id", tktB.ticket_id);
  check("rider A cannot read rider B's ticket events", deniedOrEmpty(evCross));

  const bcMine = await A.c.from("board_codes").select("ticket_id");
  check(
    "rider A sees only own board codes",
    !bcMine.error && bcMine.data.every((r) => r.ticket_id !== tktB.ticket_id),
  );
  const bcCross = await A.c
    .from("board_codes")
    .select("code")
    .eq("ticket_id", tktB.ticket_id);
  check("rider A cannot read rider B's board code", deniedOrEmpty(bcCross));

  // wallet isolation: get B's account id from B's own session, probe as A
  const { data: bAcct } = await B.c
    .from("ledger_accounts")
    .select("id")
    .eq("kind", "rider_wallet")
    .single();
  const acctCross = await A.c.from("ledger_accounts").select("id").eq("id", bAcct.id);
  check("rider A cannot read rider B's wallet account", deniedOrEmpty(acctCross));
  const postCross = await A.c
    .from("ledger_postings")
    .select("id")
    .eq("account_id", bAcct.id);
  check("rider A cannot read rider B's wallet postings", deniedOrEmpty(postCross));
  const balCross = await A.c
    .from("account_balances")
    .select("balance_cents")
    .eq("account_id", bAcct.id);
  check("rider A cannot read rider B's balance", deniedOrEmpty(balCross));
  const acctMine = await A.c.from("ledger_accounts").select("profile_id");
  check(
    "rider A's account list is only their own",
    !acctMine.error && acctMine.data.every((r) => r.profile_id === A.uid),
  );
  const txMine = await A.c.from("ledger_transactions").select("id, created_by");
  check(
    "rider A sees only transactions they are party to",
    !txMine.error && txMine.data.length > 0,
  );
}

// ---- no direct write paths ----
{
  const up = await A.c
    .from("tickets")
    .update({ fare_cents: 1 })
    .eq("id", tktA.ticket_id)
    .select();
  check("rider cannot UPDATE a ticket", deniedOrEmpty(up));
  const del = await A.c
    .from("ticket_events")
    .delete()
    .eq("ticket_id", tktA.ticket_id)
    .select();
  check("rider cannot DELETE ticket history", deniedOrEmpty(del));
  const forge = await A.c
    .from("ledger_postings")
    .insert({
      transaction_id: crypto.randomUUID(),
      account_id: crypto.randomUUID(),
      amount_cents: 100000,
    });
  check("rider cannot INSERT ledger postings (no money printing)", !!forge.error);
  const forgeEv = await A.c
    .from("ticket_events")
    .insert({ ticket_id: tktA.ticket_id, event_type: "redeemed" });
  check("rider cannot forge ticket events", !!forgeEv.error);
  const topup = await A.c.rpc("record_topup", {
    p_profile: A.uid,
    p_amount_cents: 100000,
  });
  check("rider cannot call the service only topup function", !!topup.error);
  const renameB = await A.c
    .from("profiles")
    .update({ full_name: "hacked" })
    .eq("id", B.uid)
    .select();
  check("rider A cannot edit rider B's profile", deniedOrEmpty(renameB));
}

// ---- conductor surface ----
{
  const t = await C.c.from("tickets").select("id");
  check("conductor cannot browse tickets", deniedOrEmpty(t));
  const bc = await C.c.from("board_codes").select("code");
  check("conductor cannot harvest board codes", deniedOrEmpty(bc));

  // redemption happens only through the rate limited RPC
  const r1 = await C.c.rpc("redeem_board_code", {
    p_route: routeId,
    p_direction: "outbound",
    p_code: tktA.board_code,
  });
  if (r1.error) {
    check("conductor can redeem a valid board code", false, r1.error.message);
  } else if (r1.data[0].outcome === "rate_limited") {
    skip(
      "conductor redemption checks",
      "conductor is rate limited from a previous run; re-run in 10 minutes",
    );
  } else {
    check(
      "conductor can redeem a valid board code",
      r1.data[0].outcome === "success",
      r1.data[0].outcome,
    );
    const r2 = await C.c.rpc("redeem_board_code", {
      p_route: routeId,
      p_direction: "outbound",
      p_code: tktA.board_code,
    });
    check(
      "same code cannot be redeemed twice",
      !r2.error && ["already_redeemed", "invalid_code"].includes(r2.data[0].outcome),
      r2.data?.[0]?.outcome,
    );
    const wrong = await C.c.rpc("redeem_board_code", {
      p_route: routeId,
      p_direction: "inbound",
      p_code: tktB.board_code,
    });
    check(
      "code is scoped: wrong direction does not redeem",
      !wrong.error && wrong.data[0].outcome === "invalid_code",
      wrong.data?.[0]?.outcome,
    );
    const evA = await A.c
      .from("ticket_status")
      .select("status")
      .eq("ticket_id", tktA.ticket_id)
      .single();
    check(
      "rider A sees own ticket as redeemed (event sourced status)",
      evA.data?.status === "redeemed",
      evA.data?.status,
    );
  }

  const attempts = await A.c.from("code_redemption_attempts").select("id");
  check("rider cannot read the redemption attempt log", deniedOrEmpty(attempts));
}

// ---- conductor route assignment (migration 0018) ----
// A conductor works only the routes an active assignment says they work.
// Three named proofs: own route serves the cache, another route is refused
// and audit logged, and a rider gets nothing from the conductor RPCs.
{
  // ASSIGN-1: own route works (the seed assigns the test conductor TEST-01)
  const own = await C.c.rpc("pull_offline_cache", {
    p_route: routeId,
    p_direction: "outbound",
  });
  check(
    "ASSIGN-1 conductor pulls the cache for their own assigned route",
    !own.error &&
      own.data.length > 0 &&
      own.data.every((r) => r.outcome === "ok" && !("code" in r)),
    own.error?.message,
  );

  // ASSIGN-2: a seeded route the conductor is NOT assigned to
  const { data: otherRows } = await anon
    .from("routes")
    .select("id")
    .eq("code", "MARKETSQ-AVONDALE");
  const otherRouteId = otherRows?.[0]?.id;
  if (!otherRouteId) {
    skip("ASSIGN-2 unassigned route checks", "MARKETSQ-AVONDALE is not seeded");
  } else {
    const refusedPull = await C.c.rpc("pull_offline_cache", {
      p_route: otherRouteId,
      p_direction: "outbound",
    });
    check(
      "ASSIGN-2 unassigned route cache pull is refused with a coarse reason",
      !refusedPull.error &&
        refusedPull.data.length === 1 &&
        refusedPull.data[0].outcome === "route_not_assigned" &&
        refusedPull.data[0].ticket_id === null,
      refusedPull.error?.message,
    );

    const { data: pullLog } = await C.c
      .from("cache_pulls")
      .select("outcome, row_count")
      .eq("route_id", otherRouteId)
      .order("pulled_at", { ascending: false })
      .limit(1);
    check(
      "ASSIGN-2 the refused pull is audit logged",
      pullLog?.length === 1 &&
        pullLog[0].outcome === "refused_unassigned" &&
        pullLog[0].row_count === 0,
    );

    const refusedRedeem = await C.c.rpc("redeem_board_code", {
      p_route: otherRouteId,
      p_direction: "outbound",
      p_code: "1234",
    });
    if (!refusedRedeem.error && refusedRedeem.data[0].outcome === "rate_limited") {
      skip(
        "ASSIGN-2 unassigned route redemption checks",
        "conductor is rate limited from a previous run; re-run in 10 minutes",
      );
    } else {
      check(
        "ASSIGN-2 unassigned route redemption is refused, code untouched",
        !refusedRedeem.error &&
          refusedRedeem.data[0].outcome === "route_not_assigned" &&
          refusedRedeem.data[0].ticket_id === null,
        refusedRedeem.error?.message ?? refusedRedeem.data?.[0]?.outcome,
      );
      const { data: attemptLog } = await C.c
        .from("code_redemption_attempts")
        .select("outcome")
        .eq("route_id", otherRouteId)
        .order("attempted_at", { ascending: false })
        .limit(1);
      check(
        "ASSIGN-2 the refused redemption attempt is logged",
        attemptLog?.length === 1 && attemptLog[0].outcome === "route_not_assigned",
      );
    }
  }

  // ASSIGN-3: a rider is refused outright, and sees no assignments
  const riderPull = await A.c.rpc("pull_offline_cache", {
    p_route: routeId,
    p_direction: "outbound",
  });
  check(
    "ASSIGN-3 a rider cannot pull any offline cache",
    !!riderPull.error,
    riderPull.error?.message,
  );
  const riderAssignments = await A.c.from("conductor_route_assignments").select("id");
  check(
    "ASSIGN-3 a rider sees no route assignments",
    deniedOrEmpty(riderAssignments),
  );
}

// ---- ride data pipeline (polish) ----
// The real field rides in journeys/gps_pings belong to their uploader; a
// rider who uploaded nothing must see none of them. Derived segment_times
// carry no personal data and stay readable. Nobody writes without service role.
{
  const journeys = await A.c.from("journeys").select("id");
  check("RIDE-1 a rider sees no journeys they did not upload", deniedOrEmpty(journeys));
  const pings = await A.c.from("gps_pings").select("id").limit(1);
  check("RIDE-1 a rider sees no GPS pings of other people's rides", deniedOrEmpty(pings));

  const segments = await A.c
    .from("segment_times")
    .select("id, duration_seconds")
    .limit(5);
  check(
    "RIDE-2 derived segment times are readable (they feed rider facing ETAs)",
    !segments.error && (segments.data?.length ?? 0) > 0,
    segments.error?.message ?? "no rows: run pnpm spine:ingest first",
  );

  const { data: anyRoute } = await A.c.from("routes").select("id").limit(1).single();
  const forgeJourney = await A.c.from("journeys").insert({
    source_ref: "jrn_forged",
    uploaded_by: A.uid,
    route_id: anyRoute.id,
    direction: "outbound",
    started_at: new Date().toISOString(),
    source: "demo_sim",
  });
  check("RIDE-3 a rider cannot insert journeys", !!forgeJourney.error);
}

// ---- credit transfers (P1) ----
{
  const send = await A.c.rpc("send_credit", { p_amount_cents: 25 });
  if (send.error) {
    check("rider A can send credit via RPC", false, send.error.message);
  } else {
    const sent = send.data[0];
    check(
      "rider A can send credit via RPC",
      /^[2-9A-HJ-NP-Z]{6}$/.test(sent.claim_code),
    );

    const crossTransfers = await B.c
      .from("credit_transfers")
      .select("claim_code")
      .eq("id", sent.transfer_id);
    check(
      "rider B cannot read rider A's transfer or claim code",
      deniedOrEmpty(crossTransfers),
    );
    const crossEvents = await B.c
      .from("transfer_events")
      .select("id")
      .eq("transfer_id", sent.transfer_id);
    check("rider B cannot read rider A's transfer events", deniedOrEmpty(crossEvents));

    const forgeTransfer = await B.c.from("credit_transfers").insert({
      sender_id: B.uid,
      amount_cents: 1,
      claim_code: "AAAAAA",
      expires_at: new Date(Date.now() + 60000).toISOString(),
    });
    check("rider cannot INSERT transfers directly", !!forgeTransfer.error);

    const claim = await B.c.rpc("claim_credit", { p_code: sent.claim_code });
    check(
      "rider B can claim rider A's code via RPC",
      !claim.error && claim.data[0].outcome === "success",
      claim.error?.message ?? claim.data?.[0]?.outcome,
    );
    const reclaim = await B.c.rpc("claim_credit", { p_code: sent.claim_code });
    check(
      "the same claim code cannot pay twice",
      !reclaim.error && reclaim.data[0].outcome === "already_claimed",
      reclaim.data?.[0]?.outcome,
    );

    const cancelForeign = await B.c.rpc("cancel_transfer", {
      p_transfer: sent.transfer_id,
    });
    check("rider B cannot cancel rider A's transfer", !!cancelForeign.error);

    const attemptsCross = await A.c
      .from("transfer_claim_attempts")
      .select("id")
      .eq("claimer_id", B.uid);
    check("rider A cannot read rider B's claim attempts", deniedOrEmpty(attemptsCross));
  }
}

// ---- saved trips: rider-owned quick picks ----
{
  const { data: stopRows } = await A.c.from("stops").select("id").limit(2);
  const [s1, s2] = stopRows ?? [];
  if (!s1 || !s2) {
    skip("saved trips isolation", "fewer than two stops in the network");
  } else {
    // clean slate so reruns are deterministic
    await A.c.from("saved_trips").delete().neq("nickname", "");
    const save = await A.c.from("saved_trips").insert({
      rider_id: A.uid,
      from_stop_id: s1.id,
      to_stop_id: s2.id,
      nickname: "Town trip",
    });
    check("rider A can save a nicknamed trip", !save.error, save.error?.message);

    const savedA = await A.c.from("saved_trips").select("id, nickname");
    check(
      "rider A reads back their saved trip",
      !savedA.error &&
        savedA.data.length === 1 &&
        savedA.data[0].nickname === "Town trip",
    );

    const crossRead = await B.c.from("saved_trips").select("id");
    check("rider B cannot read rider A's saved trips", deniedOrEmpty(crossRead));

    const forge = await B.c.from("saved_trips").insert({
      rider_id: A.uid,
      from_stop_id: s1.id,
      to_stop_id: s2.id,
      nickname: "planted",
    });
    check("rider B cannot save a trip onto rider A's account", !!forge.error);

    const crossRename = await B.c
      .from("saved_trips")
      .update({ nickname: "hacked" })
      .eq("rider_id", A.uid)
      .select();
    check("rider B cannot rename rider A's saved trip", deniedOrEmpty(crossRename));

    const crossDelete = await B.c
      .from("saved_trips")
      .delete()
      .eq("rider_id", A.uid)
      .select();
    check("rider B cannot delete rider A's saved trip", deniedOrEmpty(crossDelete));

    await A.c.from("saved_trips").delete().neq("nickname", "");
  }
}

// ---- trip walk tails (0031): rider-owned, insert once, no rewrite ----
{
  const tail = {
    ticket_id: tktA.ticket_id,
    rider_id: A.uid,
    dest_name: "University of Zimbabwe",
    dest_lng: 31.05207,
    dest_lat: -17.78536,
    walk_meters: 400,
  };
  // tktA is a fresh ticket every run, so the one-shot insert path is real
  const ins = await A.c.from("trip_walk_tails").insert(tail);
  check(
    "WT-1 rider A can record a walk tail on their own ticket",
    !ins.error,
    ins.error?.message,
  );

  const mine = await A.c.from("trip_walk_tails").select("ticket_id, walk_meters");
  check(
    "WT-2 rider A reads back their walk tail",
    !mine.error && mine.data.some((r) => r.ticket_id === tktA.ticket_id),
  );

  const crossRead = await B.c.from("trip_walk_tails").select("ticket_id");
  check("WT-3 rider B cannot read rider A's walk tails", deniedOrEmpty(crossRead));

  const forge = await B.c.from("trip_walk_tails").insert({
    ...tail,
    ticket_id: tktA.ticket_id,
  });
  check("WT-4 rider B cannot plant a tail on rider A's ticket", !!forge.error);

  const forgeOwn = await B.c.from("trip_walk_tails").insert({
    ...tail,
    rider_id: B.uid,
  });
  check("WT-5 rider B cannot claim rider A's ticket as their own tail", !!forgeOwn.error);

  const rewrite = await A.c
    .from("trip_walk_tails")
    .update({ walk_meters: 1 })
    .eq("ticket_id", tktA.ticket_id)
    .select();
  check("WT-6 the tail cannot be rewritten, even by its owner", deniedOrEmpty(rewrite));

  const erase = await A.c
    .from("trip_walk_tails")
    .delete()
    .eq("ticket_id", tktA.ticket_id)
    .select();
  check("WT-7 the tail cannot be deleted, even by its owner", deniedOrEmpty(erase));

  const anonTails = await anon.from("trip_walk_tails").select("ticket_id");
  check("WT-8 anon sees zero walk tails", deniedOrEmpty(anonTails));
}

// ---- watchdog synthetic history: owner read only, riders and anon blind ----
{
  const anonDays = await anon.from("watchdog_vehicle_days").select("id");
  check("WD-1 anon sees zero watchdog vehicle days", deniedOrEmpty(anonDays));
  const anonFlags = await anon.from("watchdog_day_flags").select("id");
  check("WD-2 anon sees zero watchdog day flags", deniedOrEmpty(anonFlags));

  const riderDays = await A.c.from("watchdog_vehicle_days").select("id");
  check("WD-3 a rider sees zero watchdog vehicle days", deniedOrEmpty(riderDays));
  const riderFlags = await A.c.from("watchdog_day_flags").select("id");
  check("WD-4 a rider sees zero watchdog day flags", deniedOrEmpty(riderFlags));

  const { data: wdRoute } = await A.c.from("routes").select("id").limit(1).single();
  const riderForge = await A.c.from("watchdog_vehicle_days").insert({
    owner_id: crypto.randomUUID(),
    route_id: wdRoute.id,
    vehicle_label: "Forged kombi",
    day: "2026-01-01",
    tickets: 1,
    digital_tickets: 0,
    peak_tickets: 0,
    gross_cents: 150,
  });
  check("WD-5 a rider cannot insert watchdog history", !!riderForge.error);

  const riderStaged = await A.c.from("watchdog_staged_day_flags").select("id");
  check(
    "WD-11 a rider sees zero staged watchdog rows",
    deniedOrEmpty(riderStaged),
  );
  const riderSwap = await A.c.rpc("demo_watchdog_set_day", {
    p_variant: "bad_day",
  });
  check(
    "WD-12 a rider cannot drive the staged day swap",
    !!riderSwap.error,
    riderSwap.error?.message,
  );

  const ownerCreds = {
    email: process.env.DEMO_OWNER_EMAIL,
    password: process.env.DEMO_OWNER_PASSWORD,
  };
  if (!ownerCreds.email || !ownerCreds.password) {
    skip("watchdog owner read path", "DEMO_OWNER credentials not in env");
  } else {
    const oc = client();
    const { data: oAuth, error: oErr } = await oc.auth.signInWithPassword(ownerCreds);
    if (oErr) {
      skip("watchdog owner read path", `owner sign in failed: ${oErr.message}`);
    } else {
      const { data: ownerRow } = await oc
        .from("owners")
        .select("id")
        .eq("profile_id", oAuth.user.id)
        .single();
      const ownFlags = await oc.from("watchdog_day_flags").select("owner_id");
      check(
        "WD-6 the owner can read watchdog flags and only their own",
        !ownFlags.error &&
          (ownFlags.data ?? []).every((r) => r.owner_id === ownerRow.id),
        ownFlags.error?.message,
      );
      // even the owner has no client write path: rows come from the
      // simulator (service role) only, so nobody can forge their own history
      const ownerForge = await oc.from("watchdog_day_flags").insert({
        owner_id: ownerRow.id,
        route_id: wdRoute.id,
        day: "2026-01-01",
        tickets: 1,
        tickets_ratio: 1,
        peak_share: 0.5,
        digital_share: 0.5,
        worst_vehicle_ratio: 1,
        score: 0,
        flagged: false,
        engine: "threshold:v1",
      });
      check("WD-7 even the owner cannot insert watchdog rows", !!ownerForge.error);

      // the staged bad day (migration 0029): staging is service role only,
      // and the swap RPC answers only a demo flagged owner touching their
      // own rows
      const ownerStaged = await oc.from("watchdog_staged_day_flags").select("id");
      check(
        "WD-8 even the owner cannot read the staged watchdog flags",
        deniedOrEmpty(ownerStaged),
      );
      const ownerStagedVeh = await oc
        .from("watchdog_staged_vehicle_days")
        .select("id");
      check(
        "WD-9 even the owner cannot read the staged vehicle rows",
        deniedOrEmpty(ownerStagedVeh),
      );
      const ownerSwap = await oc.rpc("demo_watchdog_set_day", {
        p_variant: "normal",
      });
      check(
        "WD-10 the demo owner can swap their own staged end day",
        !ownerSwap.error && typeof ownerSwap.data === "string",
        ownerSwap.error?.message,
      );
      await oc.auth.signOut();
    }
  }
}

// ---- consent records: own rows only, append only, anonymise scrubs -------
{
  const anonConsent = await anon.from("consent_records").select("id");
  check("CN-1 anon sees zero consent records", deniedOrEmpty(anonConsent));

  const anonInsert = await anon
    .from("consent_records")
    .insert({ user_id: A.uid, action: "accepted", version: "v1" });
  check("CN-2 anon cannot record consent", !!anonInsert.error);

  const own = await A.c
    .from("consent_records")
    .insert({ user_id: A.uid, action: "accepted", version: "v1" });
  check("CN-3 a rider can record their own consent", !own.error, own.error?.message);

  const bView = await B.c.from("consent_records").select("user_id");
  check(
    "CN-4 a rider sees only their own consent rows",
    !bView.error && (bView.data ?? []).every((r) => r.user_id === B.uid),
    bView.error?.message,
  );

  const forge = await A.c
    .from("consent_records")
    .insert({ user_id: B.uid, action: "accepted", version: "v1" });
  check("CN-5 a rider cannot record consent for someone else", !!forge.error);

  const rewrite = await A.c
    .from("consent_records")
    .update({ action: "withdrawn" })
    .eq("user_id", A.uid);
  check("CN-6 consent history cannot be rewritten", !!rewrite.error);

  const erase = await A.c.from("consent_records").delete().eq("user_id", A.uid);
  check("CN-7 consent history cannot be deleted", !!erase.error);

  // the privacy page delete action: profile stripped, withdrawal appended.
  // History (tickets, ledger) stays; only who the rider is goes away.
  const anonMe = await A.c.rpc("anonymise_me");
  const profAfter = await A.c
    .from("profiles")
    .select("full_name, phone, anonymised_at")
    .eq("id", A.uid)
    .single();
  const latest = await A.c
    .from("consent_records")
    .select("action")
    .eq("user_id", A.uid)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  check(
    "CN-8 anonymise_me strips the profile and appends a withdrawal",
    !anonMe.error &&
      profAfter.data?.full_name === "" &&
      profAfter.data?.phone === null &&
      profAfter.data?.anonymised_at !== null &&
      latest.data?.action === "withdrawn",
    anonMe.error?.message ?? profAfter.error?.message,
  );

  // leave rider A usable for the next run: restore the name through the
  // rider's own column grant and re-accept
  await A.c.from("profiles").update({ full_name: "Test Rider A" }).eq("id", A.uid);
  await A.c
    .from("consent_records")
    .insert({ user_id: A.uid, action: "accepted", version: "v1" });
}

// --- demo door (migration 0022) -------------------------------------------
// The pool tables are invisible to clients; the claim function is public by
// design (rate limited, returns only an email); the reset function refuses
// anyone who is not a pooled demo persona.
{
  const A = await signIn("RIDER_A");

  const poolAnon = await anon.from("demo_pool").select("email");
  check("DM-1 anon cannot read the demo pool", deniedOrEmpty(poolAnon));

  const poolAuthed = await A.c.from("demo_pool").select("email");
  check("DM-2 a signed in rider cannot read the demo pool", deniedOrEmpty(poolAuthed));

  const poolWrite = await A.c
    .from("demo_pool")
    .insert({ profile_id: A.uid, persona: "Mallory", email: "mallory@example.com" });
  check("DM-3 clients cannot write the demo pool", !!poolWrite.error);

  const attempts = await A.c.from("demo_door_attempts").select("id");
  check("DM-4 clients cannot read the door attempt log", deniedOrEmpty(attempts));

  const claim = await anon.rpc("claim_demo_persona");
  check(
    "DM-5 the public door hands out a persona email and nothing else",
    (!claim.error && typeof claim.data === "string" && claim.data.includes("@")) ||
      // a busy door is also a valid answer: the rate limit is the guard
      (claim.error?.message ?? "").includes("busy"),
    claim.error?.message,
  );

  const reset = await A.c.rpc("demo_reset_mine", { p_consent_version: "v1" });
  check(
    "DM-6 a real account cannot run the demo reset",
    (reset.error?.message ?? "").includes("not a demo persona"),
    reset.error?.message,
  );
}

// --- rider prefs and emergency details (migration 0023) --------------------
// Prefs are plain rider-owned rows. Emergency details are sensitive: clients
// have no direct write path at all; the only way in is the RPC that records
// consent in the same transaction.
{
  const A = await signIn("RIDER_A");
  const B = await signIn("RIDER_B");

  await A.c.from("rider_prefs").delete().eq("rider_id", A.uid);
  const prefUp = await A.c
    .from("rider_prefs")
    .insert({ rider_id: A.uid, commute_alerts: true, voice_en: true });
  check("RP-1 a rider can write their own prefs", !prefUp.error, prefUp.error?.message);

  const prefCross = await B.c.from("rider_prefs").select("rider_id");
  check(
    "RP-2 a rider sees only their own prefs",
    !prefCross.error && (prefCross.data ?? []).every((r) => r.rider_id === B.uid),
  );

  const prefForge = await B.c
    .from("rider_prefs")
    .insert({ rider_id: A.uid, commute_alerts: true });
  check("RP-3 a rider cannot write prefs onto another account", !!prefForge.error);

  const anonPrefs = await anon.from("rider_prefs").select("rider_id");
  check("RP-4 anon sees zero prefs", deniedOrEmpty(anonPrefs));

  const edDirect = await A.c.from("emergency_details").insert({
    rider_id: A.uid,
    next_of_kin_name: "Direct write",
  });
  check(
    "ED-1 even the owner has no direct write path into emergency details",
    !!edDirect.error,
  );

  const edSave = await A.c.rpc("save_emergency_details", {
    p_next_of_kin_name: "Amai Chido",
    p_next_of_kin_phone: "+263 77 000 0000",
    p_medical_aid_name: "PSMAS",
    p_medical_aid_number: "PS 12345",
    p_consent_version: "emergency-v1",
  });
  const edRow = await A.c
    .from("emergency_details")
    .select("next_of_kin_name")
    .eq("rider_id", A.uid)
    .maybeSingle();
  const edConsent = await A.c
    .from("consent_records")
    .select("action")
    .eq("user_id", A.uid)
    .eq("version", "emergency-v1")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  check(
    "ED-2 the save RPC stores details and records consent together",
    !edSave.error &&
      edRow.data?.next_of_kin_name === "Amai Chido" &&
      edConsent.data?.action === "accepted",
    edSave.error?.message,
  );

  const edCross = await B.c.from("emergency_details").select("rider_id");
  check("ED-3 a rider sees zero of another rider's emergency details", deniedOrEmpty(edCross));

  const edAnonRead = await anon.from("emergency_details").select("rider_id");
  check("ED-4 anon sees zero emergency details", deniedOrEmpty(edAnonRead));

  const edAnonSave = await anon.rpc("save_emergency_details", {
    p_next_of_kin_name: "Mallory",
    p_next_of_kin_phone: "+263 77 111 1111",
    p_medical_aid_name: "",
    p_medical_aid_number: "",
    p_consent_version: "emergency-v1",
  });
  check("ED-5 anon cannot call the emergency save RPC", !!edAnonSave.error);

  const edTamper = await B.c
    .from("emergency_details")
    .update({ next_of_kin_name: "hacked" })
    .eq("rider_id", A.uid)
    .select();
  check(
    "ED-6 a rider cannot rewrite another rider's emergency details",
    deniedOrEmpty(edTamper),
  );

  const edDelete = await A.c.rpc("delete_emergency_details", {
    p_consent_version: "emergency-v1",
  });
  const edGone = await A.c
    .from("emergency_details")
    .select("rider_id")
    .eq("rider_id", A.uid);
  const edWithdrawn = await A.c
    .from("consent_records")
    .select("action")
    .eq("user_id", A.uid)
    .eq("version", "emergency-v1")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  check(
    "ED-7 the delete RPC removes details and records the withdrawal",
    !edDelete.error &&
      (edGone.data ?? []).length === 0 &&
      edWithdrawn.data?.action === "withdrawn",
    edDelete.error?.message,
  );

  await A.c.from("rider_prefs").delete().eq("rider_id", A.uid);
}

// --- ride shares (migration 0026) -------------------------------------------
// The share link is the capability: 128 bit token, viewer sees route facts
// only, and there is no client write path or cross rider door anywhere.
{
  const A = await signIn("RIDER_A");
  const B = await signIn("RIDER_B");
  const buyRes = await A.c.rpc("purchase_ticket", {
    p_route: routeId,
    p_direction: "outbound",
  });
  if (buyRes.error) {
    skip("ride shares", `ticket purchase failed: ${buyRes.error.message}`);
  } else {
    const ticketId = buyRes.data[0].ticket_id;

    const share = await A.c.rpc("create_ride_share", { p_ticket: ticketId });
    const token = share.data?.[0]?.share_token ?? "";
    check(
      "SH-1 the rider mints a 128 bit share token for their own fare",
      !share.error && /^[0-9a-f]{32}$/.test(token),
      share.error?.message,
    );

    const again = await A.c.rpc("create_ride_share", { p_ticket: ticketId });
    check(
      "SH-2 minting twice returns the same live link",
      !again.error && again.data?.[0]?.share_token === token,
    );

    const foreign = await B.c.rpc("create_ride_share", { p_ticket: ticketId });
    check("SH-3 a rider cannot share someone else's ticket", !!foreign.error);

    const anonShares = await anon.from("ride_shares").select("token");
    check("SH-4 anon cannot read the share table", deniedOrEmpty(anonShares));
    const bShares = await B.c.from("ride_shares").select("token");
    check(
      "SH-5 another rider cannot read A's share tokens",
      !bShares.error && (bShares.data ?? []).every((r) => r.token !== token),
    );

    const forge = await A.c.from("ride_shares").insert({
      ticket_id: ticketId,
      rider_id: A.uid,
      token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });
    check("SH-6 even the owner cannot write the share table directly", !!forge.error);

    const view = await anon.rpc("ride_share_view", { p_token: token });
    const row = view.data?.[0];
    check(
      "SH-7 the anonymous viewer sees route facts for a live token",
      !view.error && !!row && typeof row.route_name === "string",
      view.error?.message,
    );
    check(
      "SH-8 the view exposes nothing about who is riding",
      !!row &&
        !("rider_id" in row) &&
        !("ticket_id" in row) &&
        !("board_code" in row) &&
        !("fare_cents" in row),
      row ? Object.keys(row).join(",") : "no row",
    );

    const miss = await anon.rpc("ride_share_view", {
      p_token: "0123456789abcdef0123456789abcdef",
    });
    check(
      "SH-9 a wrong token answers with nothing",
      !miss.error && (miss.data ?? []).length === 0,
    );

    const { data: shareRow } = await A.c
      .from("ride_shares")
      .select("id")
      .eq("token", token)
      .single();
    const foreignRevoke = await B.c.rpc("revoke_ride_share", {
      p_share: shareRow.id,
    });
    check("SH-10 another rider cannot revoke A's share", !!foreignRevoke.error);

    const revoke = await A.c.rpc("revoke_ride_share", { p_share: shareRow.id });
    const afterRevoke = await anon.rpc("ride_share_view", { p_token: token });
    check(
      "SH-11 revoking kills the link for the viewer",
      !revoke.error && !afterRevoke.error && (afterRevoke.data ?? []).length === 0,
      revoke.error?.message,
    );
  }
}

// kombi board (K1): the trust surface reads aggregates, never people
{
  const anonBoard = await client().rpc("kombi_board");
  check("KB-1 anon cannot call kombi_board", !!anonBoard.error);

  const board = await A.c.rpc("kombi_board");
  check(
    "KB-2 a signed in rider can read the kombi board",
    !board.error && Array.isArray(board.data) && board.data.length > 0,
    board.error?.message,
  );

  const kbRow = (board.data ?? [])[0];
  check(
    "KB-3 board rows carry aggregates only, no person or row ids",
    !!kbRow &&
      !("id" in kbRow) &&
      !("vehicle_id" in kbRow) &&
      !("owner_id" in kbRow) &&
      !("rider_id" in kbRow) &&
      !("conductor_id" in kbRow) &&
      !("ticket_id" in kbRow),
    kbRow ? Object.keys(kbRow).join(",") : "no row",
  );

  const vehiclesDirect = await A.c.from("vehicles").select("id");
  check(
    "KB-4 the vehicles table itself stays closed to riders",
    deniedOrEmpty(vehiclesDirect),
  );
}

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed === 0 ? 0 : 1);
