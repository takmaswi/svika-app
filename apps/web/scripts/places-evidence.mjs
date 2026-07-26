// M3 gate evidence: nickname rendering at the 360px reference viewport in
// both themes and both languages. The script seeds one personal name (the
// signed in rider's own), one suggested community name and one suggested
// community shortcut at a fresh spot, shoots the places screen as the
// rider (personal chip + community chip + walk tone dash + recommended
// row) and once as a guest (community only: the personal wall on camera),
// then removes what it seeded. Needs the dev server on :3000.
// Usage: node scripts/places-evidence.mjs
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
const OUT = join(repoRoot, "docs", "design-evidence", "places");
const MOBILE = { width: 360, height: 740 };

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// a fresh spot in northeast Harare, inside the tile box, off the corridor
const lat = -17.78 + Math.random() * 0.03;
const lng = 31.11 + Math.random() * 0.04;
const at = `${lat.toFixed(5)},${lng.toFixed(5)}`;

// the rider whose personal name shows
const { data: signIn, error: signInErr } = await createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
).auth.signInWithPassword({
  email: process.env.DEMO_RIDER_EMAIL,
  password: process.env.DEMO_RIDER_PASSWORD,
});
if (signInErr) throw new Error(`demo rider sign in failed: ${signInErr.message}`);
const riderId = signIn.user.id;

const seeded = [];
async function seedName(row) {
  const { data, error } = await admin
    .from("place_names")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(`seed failed: ${error.message}`);
  seeded.push(data.id);
  return data.id;
}

// personal: the rider's own quiet chip; community: the agreed chip
await seedName({
  author_id: riderId,
  name: "Pagedhi rechikoro",
  kind: "gate",
  scope: "personal",
  location: `SRID=4326;POINT(${lng - 0.0012} ${lat + 0.0006})`,
});
await seedName({
  author_id: null,
  name: "Pamusika",
  kind: "stop",
  scope: "suggested",
  location: `SRID=4326;POINT(${lng + 0.001} ${lat - 0.0004})`,
});
// a suggested community shortcut: the walk tone dash on camera
const line = [
  [lng - 0.002, lat - 0.001],
  [lng - 0.0008, lat - 0.0002],
  [lng + 0.0006, lat + 0.0008],
]
  .map(([x, y]) => `${x} ${y}`)
  .join(",");
const { data: sc, error: scErr } = await admin
  .from("shortcut_paths")
  .insert({
    author_id: null,
    scope: "suggested",
    path: `SRID=4326;LINESTRING(${line})`,
    distance_m: 260,
  })
  .select("id")
  .single();
if (scErr) throw new Error(`shortcut seed failed: ${scErr.message}`);

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

      await page.goto(`${BASE}/app/places?at=${at}`);
      await page
        .locator('[data-testid="places-map"][data-map-ready="true"]')
        .waitFor({ timeout: 30_000 });
      await page
        .locator('[data-testid="map-place-chip"]')
        .nth(1)
        .waitFor({ timeout: 15_000 });
      await page.waitForTimeout(2200); // tiles settle
      await page.screenshot({
        path: join(OUT, `places-nicknames-${theme}-${lang}.png`),
      });
      await context.close();
      console.log(`places shots ${theme}/${lang}`);
    }
  }

  // the guest view: community chips only, the personal wall on camera
  const guestCtx = await browser.newContext({ viewport: MOBILE });
  await guestCtx.addCookies([
    { name: "svika_theme", value: "light", url: BASE },
    { name: "svika_lang", value: "en", url: BASE },
  ]);
  const guest = await guestCtx.newPage();
  await guest.goto(`${BASE}/app/places?at=${at}`);
  await guest
    .locator('[data-testid="places-map"][data-map-ready="true"]')
    .waitFor({ timeout: 30_000 });
  await guest
    .locator('[data-testid="map-place-chip"]')
    .first()
    .waitFor({ timeout: 15_000 });
  await guest.waitForTimeout(2200);
  await guest.screenshot({ path: join(OUT, "places-guest-community-only.png") });
  await guestCtx.close();
  console.log("guest shot");
} finally {
  await browser.close();
  // remove what this run seeded (no promotion events were ever appended to
  // these rows, so the service role may take them back out)
  for (const id of seeded) {
    await admin.from("place_names").delete().eq("id", id);
  }
  if (sc?.id) await admin.from("shortcut_paths").delete().eq("id", sc.id);
}
console.log("places evidence written to", OUT);
