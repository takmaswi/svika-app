// Partner gate evidence: the opt in card, the partner screen with its
// honest contribution counts, the tagging controls live over a recording,
// and both sheets, at the 360px reference viewport in both themes and both
// languages.
//
// Everything is captured through the real doors. The partner switch posts
// the real consent record, the recording runs the real recorder against
// mocked geolocation walked along a Harare line, and the counts on the
// partner screen are the rider's own rows read back through RLS.
//
// The run leaves the rider a partner (that is the state the contribution
// shots need); the last step turns it back off so a rerun and the e2e both
// start from the default.
//
// Needs the dev server on :3000 started with E2E_AUTH=on.
// Usage: node scripts/partner-evidence.mjs   (from apps/web)
import { chromium } from "@playwright/test";
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
const OUT = join(repoRoot, "docs", "design-evidence", "partner");
const MOBILE = { width: 360, height: 740 };
const START = { latitude: -17.8292, longitude: 31.0522 };
const STEPS = [
  ...Array.from({ length: 6 }, (_, i) => ({
    latitude: START.latitude - (i + 1) * 0.00036,
    longitude: START.longitude,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    latitude: START.latitude - 6 * 0.00036,
    longitude: START.longitude + (i + 1) * 0.00038,
  })),
];

async function riderContext(browser, theme, lang) {
  const context = await browser.newContext({
    viewport: MOBILE,
    locale: "en-ZW",
    geolocation: START,
    permissions: ["geolocation"],
  });
  await context.addCookies([
    { name: "svika_theme", value: theme, url: BASE },
    { name: "svika_lang", value: lang, url: BASE },
  ]);
  const page = await context.newPage();
  const res = await page.request.post(`${BASE}/e2e/login`, {
    data: {
      email: process.env.DEMO_RIDER_EMAIL,
      password: process.env.DEMO_RIDER_PASSWORD,
    },
  });
  if (!res.ok()) throw new Error(`rider login failed: ${res.status()}`);
  return { context, page };
}

// the svk-rise entrances stagger to .95s; a full page shot taken before
// they land catches half the screen at part opacity
const SETTLE_MS = 1400;

async function settled(page) {
  await page.waitForTimeout(SETTLE_MS);
}

async function setPartner(page, on) {
  await page.goto(`${BASE}/app/partner?t=${Date.now()}`);
  const state = await page.getByTestId("partner-screen").getAttribute("data-partner");
  if (state === String(on)) return;
  await page.getByTestId(on ? "partner-on" : "partner-off").click();
  await page
    .getByTestId("partner-screen")
    .and(page.locator(`[data-partner="${on}"]`))
    .waitFor({ timeout: 20_000 });
}

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });

// --- the off state, so the door reads as an invitation not a setting -------
{
  const { context, page } = await riderContext(browser, "light", "en");
  await setPartner(page, false);
  await settled(page);
  await page.screenshot({
    path: join(OUT, "partner-screen-off-light-en.png"),
    fullPage: true,
  });
  await page.goto(`${BASE}/app/profile`);
  await settled(page);
  await page.getByTestId("profile-partner").scrollIntoViewIfNeeded();
  await page.getByTestId("profile-partner").screenshot({
    path: join(OUT, "partner-card-off-light-en.png"),
  });
  await context.close();
  console.log("off state captured");
}

// --- record one tagged trip so the counts have something honest to show ----
// Skipped when this rider has already contributed, so a rerun captures the
// same screens without minting another trip every time.
{
  const { context, page } = await riderContext(browser, "light", "en");
  await setPartner(page, true);
  const already =
    (await page.getByTestId("partner-contrib-empty").count()) === 0 &&
    Number(await page.getByTestId("partner-trips").innerText()) > 0;
  if (already) {
    console.log("rider already has contributions; skipping the recording step");
    await context.close();
  } else {
  await page.goto(`${BASE}/app/record?gps=replay`);
  await page.getByTestId("record-mode-kombi").click();
  await page.getByTestId("record-start").click();
  await page.getByTestId("leg-chip").waitFor({ timeout: 20_000 });

  // the board sheet, mid answer: route typed, direction not yet picked, so
  // the shot carries the disabled primary that the field logger never had
  await page.getByTestId("record-board").click();
  await page.getByTestId("board-sheet").waitFor();
  await page.getByTestId("board-route").fill("Mt Pleasant Heights to Rezende");
  await page.getByTestId("board-fare").fill("1.50");
  await page.screenshot({ path: join(OUT, "partner-board-sheet-light-en.png") });
  await page.getByTestId("board-dir-outbound").click();
  await page.getByTestId("board-confirm").click();

  for (const step of STEPS) {
    await context.setGeolocation(step);
    await page.waitForTimeout(200);
  }

  // the tagging controls live over the map
  await page.screenshot({ path: join(OUT, "partner-recording-light-en.png") });

  await page.getByTestId("record-mark").click();
  await page.getByTestId("mark-sheet").waitFor();
  await page.getByTestId("mark-kind-rank").click();
  await page.getByTestId("mark-name").fill("Pamachurch");
  await page.screenshot({ path: join(OUT, "partner-mark-sheet-light-en.png") });
  await page.getByTestId("mark-drop").click();
  await page.getByTestId("mark-note").waitFor();

  await page.getByTestId("record-alight").click();
  await page.getByTestId("record-stop").click();
  await page.getByTestId("journey-name").fill("Evidence corridor run");
  await page.getByTestId("journey-save").click();
  const agree = page.getByTestId("journey-consent-agree");
  const saved = page.getByTestId("journey-saved-note");
  await agree.or(saved).waitFor({ timeout: 25_000 });
  if (await agree.isVisible()) await agree.click();
  await saved.waitFor({ timeout: 25_000 });
  await context.close();
  console.log("tagged trip recorded");
  }
}

// --- the contribution view and the card, both themes, both languages ------
for (const theme of ["light", "dark"]) {
  for (const lang of ["en", "sn"]) {
    const { context, page } = await riderContext(browser, theme, lang);
    await page.goto(`${BASE}/app/partner?t=${Date.now()}`);
    await page.getByTestId("partner-contributions").waitFor({ timeout: 20_000 });
    await settled(page);
    await page.screenshot({
      path: join(OUT, `partner-screen-on-${theme}-${lang}.png`),
      fullPage: true,
    });
    await page.getByTestId("partner-contributions").screenshot({
      path: join(OUT, `partner-contributions-${theme}-${lang}.png`),
    });
    await page.goto(`${BASE}/app/profile`);
    await settled(page);
    await page.getByTestId("profile-partner").scrollIntoViewIfNeeded();
    await page.getByTestId("profile-partner").screenshot({
      path: join(OUT, `partner-card-on-${theme}-${lang}.png`),
    });
    await context.close();
    console.log(`contribution shots ${theme}/${lang}`);
  }
}

// --- the gentle door, as somebody who is not a partner sees it ------------
{
  const { context, page } = await riderContext(browser, "light", "en");
  await setPartner(page, false);
  await page.goto(`${BASE}/app/journeys`);
  await page
    .getByTestId("journeys-list")
    .and(page.locator('[data-loaded="true"]'))
    .waitFor({ timeout: 20_000 });
  await page.getByTestId("journey-card").first().click();
  await page.waitForURL(/\/app\/journeys\//);
  // the door opens off a save, so ask for the same view the save lands on
  await page.goto(`${page.url().split("?")[0]}?saved=1`);
  await page.getByTestId("partner-door").waitFor({ timeout: 20_000 });
  for (const lang of ["en", "sn"]) {
    await context.addCookies([{ name: "svika_lang", value: lang, url: BASE }]);
    await page.reload();
    await page.getByTestId("partner-door").waitFor({ timeout: 20_000 });
    await settled(page);
    await page.getByTestId("partner-door").screenshot({
      path: join(OUT, `partner-door-light-${lang}.png`),
    });
  }
  await context.close();
  console.log("partner door captured; rider left as a non partner");
}

await browser.close();
console.log("partner evidence written to", OUT);
