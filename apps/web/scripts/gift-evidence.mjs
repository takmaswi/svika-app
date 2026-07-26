// V6 gate evidence: the shareable ride card at the 360px reference viewport,
// both themes, both languages.
//
// The gift is real: the script buys one through the app's own RPC as the demo
// rider and takes it back at the end, so the wallet finishes where it
// started and no fare is stranded on a code nobody will ever use.
//
// Needs the dev server on :3000.
// Usage: node scripts/gift-evidence.mjs
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
const OUT = join(repoRoot, "docs", "design-evidence", "gift");
const MOBILE = { width: 360, height: 740 };

const rider = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
const { error: signInErr } = await rider.auth.signInWithPassword({
  email: process.env.DEMO_RIDER_EMAIL,
  password: process.env.DEMO_RIDER_PASSWORD,
});
if (signInErr) throw new Error(`demo rider sign in failed: ${signInErr.message}`);

const { data: route } = await rider
  .from("routes")
  .select("id")
  .eq("code", "HEIGHTS-REZENDE")
  .single();
const { data: stops } = await rider
  .from("route_stops")
  .select("stop_id, seq, stops(name)")
  .eq("route_id", route.id)
  .eq("direction", "outbound")
  .order("seq");
const from = stops[0];
const to = stops[stops.length - 1];

const { data: gift, error: giftErr } = await rider.rpc("gift_ticket", {
  p_route: route.id,
  p_direction: "outbound",
  p_from_stop: from.stop_id,
  p_to_stop: to.stop_id,
});
if (giftErr) throw new Error(`gift failed: ${giftErr.message}`);
const ticketId = gift[0].ticket_id;
console.log(`gifted ride ${ticketId}, code ${gift[0].board_code}`);

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
      await page.goto(`${BASE}/app/gift/${ticketId}`);
      await page.locator('[data-testid="gift-card"]').waitFor({ timeout: 20_000 });
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(OUT, `gift-card-${theme}-${lang}.png`) });
      await context.close();
      console.log(`  shot ${theme}/${lang}`);
    }
  }
} finally {
  await browser.close();
  const { data: back } = await rider.rpc("revoke_gift", { p_ticket: ticketId });
  console.log(`taken back: ${JSON.stringify(back?.[0])}`);
}
