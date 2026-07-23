// V1 gate evidence: the three home peek states (usual trip, ride back,
// search fallback) in both themes and both languages at the 360px reference
// viewport. Takunda's fixture history is rebuilt around the capture moment
// to stage each state (same RPC and jitter shape as the seed) and restored
// to the live window afterwards. Needs the dev server on :3000 started with
// E2E_AUTH=on and the repo .env.local credentials.
//
// Usage: node scripts/answer-home-evidence.mjs   (from apps/web)
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
const OUT = join(repoRoot, "docs", "design-evidence", "answer-home");
const MOBILE = { width: 360, height: 740 };
const TAKUNDA_EMAIL = "demo.takunda@svika.app";
const HISTORY_DAYS = 14;

const catNow = new Date(Date.now() + 2 * 60 * 60_000);
const catMinute = catNow.getUTCHours() * 60 + catNow.getUTCMinutes();
const stamp = `cat-${String(catNow.getUTCHours()).padStart(2, "0")}${String(
  catNow.getUTCMinutes(),
).padStart(2, "0")}`;

// same rebuild the e2e helper does (apps/web/e2e/takunda-fixtures.ts)
async function rebuildTakundaHistory(offsetMinutes) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: TAKUNDA_EMAIL,
    password: process.env.DEMO_JUDGE_PASSWORD,
  });
  if (authErr) throw authErr;
  const { data: route } = await supabase
    .from("routes")
    .select("id")
    .eq("code", "HEIGHTS-REZENDE")
    .single();
  const { data: stops } = await supabase
    .from("route_stops")
    .select("stop_id, seq")
    .eq("route_id", route.id)
    .eq("direction", "outbound")
    .order("seq");
  const rides = [];
  for (let d = 0; d < HISTORY_DAYS; d++) {
    const jitterMinutes = 6 + ((d * 7) % 20);
    rides.push({
      at: new Date(
        Date.now() -
          offsetMinutes * 60_000 -
          d * 24 * 60 * 60_000 -
          jitterMinutes * 60_000,
      ).toISOString(),
    });
  }
  const { error } = await supabase.rpc("reset_demo_commute_history", {
    p_profile: auth.user.id,
    p_route: route.id,
    p_direction: "outbound",
    p_from: stops[0].stop_id,
    p_to: stops[stops.length - 1].stop_id,
    p_fare_cents: 150,
    p_rides: rides,
  });
  if (error) throw error;
  await supabase.auth.signOut();
}

async function capture(browser, { state, email, password, lang, theme }) {
  const context = await browser.newContext({ viewport: MOBILE, locale: "en-ZW" });
  await context.addCookies([
    { name: "svika_theme", value: theme, url: BASE },
    { name: "svika_lang", value: lang, url: BASE },
  ]);
  const page = await context.newPage();
  const res = await context.request.post(`${BASE}/e2e/login`, {
    data: { email, password },
  });
  if (!res.ok()) throw new Error(`login failed for ${email}: ${res.status()}`);
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByTestId("home-sheet").waitFor({ state: "visible", timeout: 30_000 });
  await page
    .locator(".maplibregl-canvas")
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => {}); // the sheet is the subject; a missing map still records
  await page.waitForTimeout(3200); // entrances settle, tiles paint
  await page.screenshot({ path: join(OUT, `${state}-${theme}-${lang}.png`) });
  console.log(`${state} ${theme} ${lang} captured (${stamp})`);
  await context.close();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  await fetch(`${BASE}/`).catch(() => {});
  const judgePassword = process.env.DEMO_JUDGE_PASSWORD;
  const riderEmail = process.env.DEMO_RIDER_EMAIL;
  const riderPassword = process.env.DEMO_RIDER_PASSWORD;
  if (!judgePassword || !riderEmail || !riderPassword) {
    throw new Error("missing DEMO_JUDGE_PASSWORD / DEMO_RIDER_EMAIL / DEMO_RIDER_PASSWORD");
  }
  const browser = await chromium.launch({ headless: true });

  const variants = [];
  for (const theme of ["light", "dark"]) {
    for (const lang of ["en", "sn"]) variants.push({ theme, lang });
  }

  // usual trip: the mined window centred on now
  await rebuildTakundaHistory(0);
  for (const v of variants) {
    await capture(browser, {
      state: "usual",
      email: TAKUNDA_EMAIL,
      password: judgePassword,
      ...v,
    });
  }

  // ride back: the window passed a few hours ago (needs room in today)
  if (catMinute >= 270) {
    await rebuildTakundaHistory(180);
    try {
      for (const v of variants) {
        await capture(browser, {
          state: "return",
          email: TAKUNDA_EMAIL,
          password: judgePassword,
          ...v,
        });
      }
    } finally {
      await rebuildTakundaHistory(0);
    }
  } else {
    console.log(`CAT ${stamp}: too early to stage a passed window, return state skipped`);
  }

  // search fallback: a rider with no recognised context
  for (const v of variants) {
    await capture(browser, {
      state: "search",
      email: riderEmail,
      password: riderPassword,
      ...v,
    });
  }

  await browser.close();
  console.log(`answer home evidence written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
