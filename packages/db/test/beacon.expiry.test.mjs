// Demand beacon expiry proof (batch V8).
//
// The RLS suite proves what a conductor can and cannot see. This one proves
// the other half of the boundary: a beacon stops counting on its own. Nobody
// has to withdraw it, no job has to sweep it, and a rider who boarded and
// went home twenty minutes ago cannot send a kombi to an empty stop.
//
// Expiry is tested by ageing a beacon rather than by waiting twenty minutes:
// the service role moves the row's expires_at into the past (beacons are
// ephemeral operational state, deliberately without an append only trigger)
// and the conductor's count is read again through the real RPC. The rule
// under test is the RPC's own `expires_at > now()`, evaluated by the
// database's clock.
//
// Usage: pnpm db:beacon-test
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
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error("Missing Supabase url / anon key / service role key");
  process.exit(2);
}

let passed = 0,
  failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? " :: " + detail : ""}`);
  }
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const signIn = async (email, password) => {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in failed for ${email}: ${error.message}`);
  return { c, uid: data.user.id };
};

const rider = await signIn(
  process.env.TEST_RIDER_A_EMAIL,
  process.env.TEST_RIDER_A_PASSWORD,
);
const conductor = await signIn(
  process.env.TEST_CONDUCTOR_EMAIL,
  process.env.TEST_CONDUCTOR_PASSWORD,
);

const { data: route } = await admin
  .from("routes")
  .select("id")
  .eq("code", "TEST-01")
  .single();
const { data: stop } = await admin
  .from("route_stops")
  .select("stop_id")
  .eq("route_id", route.id)
  .eq("direction", "outbound")
  .order("seq")
  .limit(1)
  .single();

const waitingAt = async (stopId) => {
  const { data, error } = await conductor.c.rpc("beacon_counts", {
    p_route: route.id,
    p_direction: "outbound",
  });
  if (error) throw new Error(`counts failed: ${error.message}`);
  return data.find((r) => r.stop_id === stopId)?.waiting ?? 0;
};

// start clean: whatever this rider left behind from another suite
await rider.c.rpc("withdraw_beacon");
const base = await waitingAt(stop.stop_id);

const raised = await rider.c.rpc("raise_beacon", {
  p_route: route.id,
  p_direction: "outbound",
  p_stop: stop.stop_id,
});
check(
  "E1 a raised beacon is counted",
  raised.data?.[0]?.outcome === "raised" &&
    (await waitingAt(stop.stop_id)) === base + 1,
  raised.error?.message,
);

const life = new Date(raised.data[0].expires_at).getTime() - Date.now();
check(
  "E2 a beacon's life is short: under half an hour, over five minutes",
  life > 5 * 60_000 && life < 30 * 60_000,
  `${Math.round(life / 60_000)} minutes`,
);

// Age it past its expiry: nobody withdrew it, nobody swept it. Both columns
// move, because the table's own check keeps expires_at after created_at: a
// beacon that expired an hour ago must have been raised before that.
const { error: ageErr } = await admin
  .from("demand_beacons")
  .update({
    created_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    expires_at: new Date(Date.now() - 60 * 60_000).toISOString(),
  })
  .eq("rider_id", rider.uid)
  .gt("expires_at", new Date(Date.now() - 60 * 60_000).toISOString());
check("E3 the row can be aged for the test", !ageErr, ageErr?.message);

check(
  "E4 an expired beacon stops counting on its own, with nobody withdrawing it",
  (await waitingAt(stop.stop_id)) === base,
  `expected ${base}`,
);

const mine = await rider.c.rpc("my_beacon");
check(
  "E5 and the rider's own screen agrees it is over",
  (mine.data ?? []).length === 0,
  JSON.stringify(mine.data),
);

// the rider can raise a fresh one afterwards: expiry is not a lockout
const again = await rider.c.rpc("raise_beacon", {
  p_route: route.id,
  p_direction: "outbound",
  p_stop: stop.stop_id,
});
check(
  "E6 expiry is not a lockout: a rider can say they are waiting again",
  again.data?.[0]?.outcome === "raised",
  again.error?.message ?? JSON.stringify(again.data?.[0]),
);
await rider.c.rpc("withdraw_beacon");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
