// V8 gate evidence: the rider's beacon card and the hwindi's waiting list at
// the 360px reference viewport, both languages.
//
// The hwindi screen is shot in light mode on purpose: that surface is built
// for sunlight, so the evidence has to show the contrast a conductor actually
// works in. Real beacons are raised through the app's own RPC as demo riders
// and withdrawn at the end, so the corridor is left quiet.
//
// Needs the dev server on :3000 and the hwindi surface on :5174.
// Usage: node scripts/beacon-evidence.mjs
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
const HWINDI = "http://localhost:5174";
const OUT = join(repoRoot, "docs", "design-evidence", "beacon");
const MOBILE = { width: 360, height: 740 };

const anon = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

// a few riders waiting at different stops, so the list has something to say
const RIDERS = [
  [process.env.DEMO_RIDER_EMAIL, process.env.DEMO_RIDER_PASSWORD, 0],
  ["demo.takunda@svika.app", process.env.DEMO_JUDGE_PASSWORD, 3],
  ["demo.rudo@svika.app", process.env.DEMO_JUDGE_PASSWORD, 3],
];

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
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

const clients = [];
for (const [email, password, seq] of RIDERS) {
  if (!email || !password) continue;
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) {
    console.log(`  skipping ${email}: ${error.message}`);
    continue;
  }
  const stop = stops[Math.min(seq, stops.length - 1)];
  const { data, error: raiseErr } = await c.rpc("raise_beacon", {
    p_route: route.id,
    p_direction: "outbound",
    p_stop: stop.stop_id,
  });
  if (raiseErr) console.log(`  ${email} could not raise: ${raiseErr.message}`);
  else console.log(`  ${email} waiting at seq ${stop.seq} (${data[0].outcome})`);
  clients.push(c);
}

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
try {
  // the rider's card, both languages, both themes
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
      await page.locator('[data-testid="beacon-card"]').waitFor({ timeout: 20_000 });
      await page.screenshot({ path: join(OUT, `beacon-rider-${theme}-${lang}.png`) });
      await context.close();
      console.log(`rider shot ${theme}/${lang}`);
    }
  }

  // the hwindi's waiting list, sunlight contrast, both languages
  for (const lang of ["sn", "en"]) {
    const context = await browser.newContext({ viewport: MOBILE });
    const page = await context.newPage();
    await page.goto(HWINDI);
    await page.fill("#email", process.env.DEMO_CONDUCTOR_EMAIL);
    await page.fill("#password", process.env.DEMO_CONDUCTOR_PASSWORD);
    await page.click("button[type=submit]");
    await page.locator(".hwindi-route").first().waitFor({ timeout: 20_000 });
    if (lang === "en") {
      await page.locator(".lang-toggle button", { hasText: "EN" }).click();
    }
    await page
      .locator(".hwindi-route", { hasText: "HEIGHTS-REZENDE" })
      .filter({ hasText: "Rezende Rank" })
      .first()
      .click();
    await page
      .getByTestId("vehicle-picker")
      .waitFor({ timeout: 5_000 })
      .catch(() => {});
    const skip = page.getByTestId("vehicle-skip");
    if ((await skip.count()) > 0) await skip.click();
    await page.getByTestId("waiting-pill").waitFor({ timeout: 20_000 });
    await page.getByTestId("waiting-pill").click();
    await page.getByTestId("waiting-list").waitFor({ timeout: 10_000 });
    await page.screenshot({
      path: join(OUT, `beacon-hwindi-${lang}.png`),
      fullPage: true,
    });
    await context.close();
    console.log(`hwindi shot ${lang}`);
  }
} finally {
  await browser.close();
  for (const c of clients) await c.rpc("withdraw_beacon");
  console.log("beacons withdrawn: the corridor is quiet again");
}
