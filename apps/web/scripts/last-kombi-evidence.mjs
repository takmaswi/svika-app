// V7 gate evidence: the last kombi warning on the plan screen at the 360px
// reference viewport, both themes, both languages, in both states (inside the
// window and past the usual time).
//
// The clock is never faked. The evening history is staged around the real
// wall clock exactly as the e2e does, which means these shots are the real
// server rendering the real rule at the real time of day. Only
// public.synthetic_service_days is touched (every row stamped synthetic);
// tickets, ticket_events and the ledger are not involved. The corridor is
// handed back to the committed generator at the end.
//
// Needs the dev server on :3000.
// Usage: node scripts/last-kombi-evidence.mjs
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
const OUT = join(repoRoot, "docs", "design-evidence", "last-kombi");
const MOBILE = { width: 360, height: 740 };
const ROUTE = "HEIGHTS-REZENDE";
const PLAN = `${BASE}/app/plan?from=${encodeURIComponent("2nd boom gate")}&to=${encodeURIComponent("Rezende Rank")}`;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: route } = await admin
  .from("routes")
  .select("id")
  .eq("code", ROUTE)
  .single();

function harareMinuteNow() {
  const shifted = new Date(Date.now() + 2 * 60 * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** Stage 84 evenings whose usual last kombi sits minutesFromNow away. */
async function stage(minutesFromNow) {
  const usual = Math.min(1439, Math.max(0, harareMinuteNow() + minutesFromNow));
  await admin
    .from("synthetic_service_days")
    .delete()
    .eq("route_id", route.id)
    .eq("direction", "outbound");
  const today = new Date();
  const rows = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (i + 1));
    return {
      route_id: route.id,
      direction: "outbound",
      day: d.toISOString().slice(0, 10),
      last_fare_minute: Math.min(1439, Math.max(0, usual + (((i * 7) % 13) - 6))),
      fares: 12,
    };
  });
  const { error } = await admin.from("synthetic_service_days").insert(rows);
  if (error) throw new Error(`staging failed: ${error.message}`);
  return usual;
}

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
try {
  for (const [label, offset] of [
    ["warn", 35],
    ["past", -25],
  ]) {
    const usual = await stage(offset);
    console.log(`staged ${label}: usual last kombi at minute ${usual}`);
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
        await page.goto(PLAN);
        await page
          .locator('[data-testid="last-kombi"]')
          .waitFor({ timeout: 20_000 });
        await page.waitForTimeout(1400); // map tiles settle behind the sheet
        await page.screenshot({
          path: join(OUT, `last-kombi-${label}-${theme}-${lang}.png`),
        });
        await context.close();
        console.log(`  shot ${label} ${theme}/${lang}`);
      }
    }
  }
} finally {
  await browser.close();
}

console.log("regenerating the committed evening history (pnpm db:service-days)");
