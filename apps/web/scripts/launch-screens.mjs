// Launch evidence: screenshots of launch routes at the 360px reference
// device, both themes and both languages, "before" (launch flags off) and
// "after" (the preview cookie on). Works against the local dev server or the
// live site.
//
//   node scripts/launch-screens.mjs <step> <route> [<route> ...]
//     BASE_URL     default http://localhost:3000
//     PREVIEW_KEY  the preview token (local e2e token by default)
//     MODES        "before,after" (default) or one of them
//     SIGNED_IN    "1" to sign in through /e2e/login first (local only)
//     SLOW3G       "1" to throttle to slow 3G (400 kbps, 400 ms RTT)
//
// Output: docs/design-evidence/launch/step-<n>/<mode>-<slug>-<theme>-<lang>.png
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "..");
for (const f of [".env.local"]) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const [step, ...routes] = process.argv.slice(2);
if (!step || routes.length === 0) {
  console.error("usage: node scripts/launch-screens.mjs <step> <route> [...]");
  process.exit(2);
}
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const local = BASE.includes("localhost");
const PREVIEW =
  process.env.PREVIEW_KEY ??
  (local ? "e2e-launch-preview-token-0001" : process.env.SVIKA_PREVIEW_TOKEN);
const MODES = (process.env.MODES ?? "before,after").split(",");
const OUT = join(root, "docs", "design-evidence", "launch", `step-${step}`);
mkdirSync(OUT, { recursive: true });

const slug = (r) =>
  r
    .replace(/^\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+$/, "") || "root";
const host = new URL(BASE).hostname;

const browser = await chromium.launch();
for (const mode of MODES) {
  for (const theme of ["light", "dark"]) {
    for (const lang of ["en", "sn"]) {
      const ctx = await browser.newContext({
        viewport: { width: 360, height: 740 },
        deviceScaleFactor: 2,
      });
      const cookies = [
        { name: "svika_theme", value: theme, domain: host, path: "/" },
        { name: "svika_lang", value: lang, domain: host, path: "/" },
      ];
      if (mode === "after" && PREVIEW)
        cookies.push({
          name: "svika_preview",
          value: PREVIEW,
          domain: host,
          path: "/",
          httpOnly: true,
        });
      await ctx.addCookies(cookies);
      const page = await ctx.newPage();
      if (process.env.SLOW3G === "1") {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: 400,
          downloadThroughput: 50_000,
          uploadThroughput: 50_000,
        });
      }
      if (process.env.SIGNED_IN === "1") {
        const res = await page.request.post(`${BASE}/e2e/login`, {
          data: {
            email: process.env.TEST_RIDER_A_EMAIL,
            password: process.env.TEST_RIDER_A_PASSWORD,
          },
        });
        if (!res.ok()) throw new Error(`sign in failed: ${res.status()}`);
      }
      for (const route of routes) {
        await page
          .goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 90_000 })
          .catch(() => {});
        await page.waitForTimeout(1_800); // entrance motion and lazy chips settle
        const file = join(OUT, `${mode}-${slug(route)}-${theme}-${lang}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`captured ${file.slice(root.length + 1)}`);
      }
      await ctx.close();
    }
  }
}
await browser.close();
