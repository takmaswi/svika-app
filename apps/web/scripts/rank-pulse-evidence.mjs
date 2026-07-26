// V5 gate evidence: the rank pulse row on the kombi board at the 360px
// reference viewport, both themes, both languages.
//
// The fares are REAL. Nothing here writes ticket_events directly: the script
// buys cash tickets through purchase_ticket as the demo rider and clears them
// through redeem_board_code as the demo conductor, with the vehicle stamped
// exactly the way the hwindi surface now stamps it. That is the only honest
// way to shoot this feature, because the count on the card IS the fare
// ledger. It also means the shots cannot be reproduced by seeding: they cost
// real (demo) fares, deliberately kept to a handful.
//
// ticket_events is append only, so nothing here can be cleaned up afterwards.
// Keep the count low.
//
// Needs the dev server on :3000.
// Usage: node scripts/rank-pulse-evidence.mjs
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const BASE = "http://localhost:3000";
const OUT = join(repoRoot, "docs", "design-evidence", "rank-pulse");
const MOBILE = { width: 360, height: 740 };
/** Fares to clear onto the first kombi in the fleet: enough to leave the
    board showing a moving count next to quiet neighbours. */
const FARES = 3;

function anon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
}

const rider = anon();
{
  const { error } = await rider.auth.signInWithPassword({
    email: process.env.DEMO_RIDER_EMAIL,
    password: process.env.DEMO_RIDER_PASSWORD,
  });
  if (error) throw new Error(`rider sign in failed: ${error.message}`);
}

const conductor = anon();
{
  const { error } = await conductor.auth.signInWithPassword({
    email: process.env.DEMO_CONDUCTOR_EMAIL,
    password: process.env.DEMO_CONDUCTOR_PASSWORD,
  });
  if (error) throw new Error(`conductor sign in failed: ${error.message}`);
}

const { data: route } = await rider
  .from("routes")
  .select("id")
  .eq("code", "HEIGHTS-REZENDE")
  .single();

const { data: fleet, error: fleetErr } = await conductor.rpc("conductor_vehicles");
if (fleetErr) throw new Error(`fleet read failed: ${fleetErr.message}`);
const vehicle = fleet[0];
if (!vehicle) throw new Error("the demo conductor's fleet has no vehicles");
console.log(`clearing ${FARES} fares onto ${vehicle.plate} (${vehicle.capacity} seats)`);

for (let i = 0; i < FARES; i += 1) {
  const { data: bought, error: buyErr } = await rider.rpc("purchase_ticket", {
    p_route: route.id,
    p_direction: "outbound",
    p_payment: "cash", // cash keeps the demo wallet where the demo left it
  });
  if (buyErr) throw new Error(`purchase failed: ${buyErr.message}`);
  const { board_code: code } = bought[0];
  const { data: cleared, error: redeemErr } = await conductor.rpc("redeem_board_code", {
    p_route: route.id,
    p_direction: "outbound",
    p_code: code,
    p_vehicle: vehicle.id,
  });
  if (redeemErr) throw new Error(`redeem failed: ${redeemErr.message}`);
  if (cleared[0].outcome !== "success") {
    throw new Error(`redeem refused: ${cleared[0].outcome}`);
  }
}

const { data: board } = await rider.rpc("kombi_board");
for (const row of board) {
  console.log(
    `  ${row.plate}: ${row.pulse_fares} in the last ${row.pulse_window_minutes} min of ${row.capacity} seats`,
  );
}

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
try {
  for (const theme of ["light", "dark"]) {
    for (const lang of ["en", "sn"]) {
      const context = await browser.newContext({ viewport: MOBILE });
      await context.addCookies([
        { name: "svika_theme", value: theme, url: BASE },
        { name: "svika_lang", value: lang, url: BASE },
      ]);
      const page = await context.newPage();
      const login = await page.request.post(`${BASE}/e2e/login`, {
        data: {
          email: process.env.DEMO_RIDER_EMAIL,
          password: process.env.DEMO_RIDER_PASSWORD,
        },
      });
      if (!login.ok()) throw new Error(`e2e login failed: ${login.status()}`);
      await page.goto(`${BASE}/app/kombis`);
      await page.locator('[data-testid="kombi-pulse"]').first().waitFor({
        timeout: 20_000,
      });
      await page.waitForTimeout(900); // the live wait row settles
      await page.screenshot({
        path: join(OUT, `rank-pulse-board-${theme}-${lang}.png`),
        fullPage: true,
      });
      await context.close();
      console.log(`board shot ${theme}/${lang}`);
    }
  }
} finally {
  await browser.close();
}
