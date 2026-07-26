// M4 "measured, not felt": Web Vitals on the reference device profile.
//
// The reference device is a cheap Android at 360px on a slow connection, so
// this drives a real production build through Chrome DevTools Protocol with
// 4x CPU throttling and a Fast 3G network profile, and reads the metrics the
// browser itself reports: first contentful paint, largest contentful paint,
// cumulative layout shift, and the transferred bytes per route.
//
// Not Lighthouse: Lighthouse would need the app deployed or a chrome-launcher
// dependency the repo does not carry, and the numbers that matter here (what
// the rider's phone actually downloads and when it paints) come straight from
// the protocol. The throttling profile is Lighthouse's own mobile preset.
//
// Usage: node scripts/perf-profile.mjs [baseUrl] [outFile]
//   defaults: http://localhost:3100 and docs/perf/web-vitals.json
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
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

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? join(repoRoot, "docs", "perf", "web-vitals.json");
const MOBILE = { width: 360, height: 740 };

// Lighthouse's mobile preset: 4x CPU, Fast 3G
const CPU_SLOWDOWN = 4;
const NETWORK = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};

const ROUTES = [
  ["landing", "/"],
  ["home", "/app"],
  ["plan", `/app/plan?from=${encodeURIComponent("2nd boom gate")}&to=${encodeURIComponent("Rezende Rank")}`],
  ["kombis", "/app/kombis"],
  ["wallet", "/app/wallet"],
  ["places", "/app/places"],
];

const browser = await chromium.launch();
const results = [];
try {
  for (const [name, path] of ROUTES) {
    const context = await browser.newContext({ viewport: MOBILE });
    const page = await context.newPage();
    const login = await page.request.post(`${BASE}/e2e/login`, {
      data: {
        email: process.env.DEMO_RIDER_EMAIL,
        password: process.env.DEMO_RIDER_PASSWORD,
      },
    });
    if (!login.ok()) throw new Error(`e2e login failed: ${login.status()}`);

    // LCP only exists for a PerformanceObserver that was watching, so it is
    // installed before any document script runs
    await page.addInitScript(() => {
      window.__lcp = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__lcp = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", NETWORK);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });

    let transferred = 0;
    let requests = 0;
    cdp.on("Network.loadingFinished", (e) => {
      transferred += e.encodedDataLength ?? 0;
      requests += 1;
    });

    const started = Date.now();
    await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120_000 });
    // let the paint metrics and any layout shift settle
    await page.waitForTimeout(4000);

    const vitals = await page.evaluate(() => {
      const paints = performance.getEntriesByType("paint");
      const fcp = paints.find((p) => p.name === "first-contentful-paint");
      const nav = performance.getEntriesByType("navigation")[0];
      return {
        fcpMs: fcp ? Math.round(fcp.startTime) : null,
        lcpMs: window.__lcp ? Math.round(window.__lcp) : null,
        cls: Number((window.__cls ?? 0).toFixed(4)),
        domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      };
    });

    results.push({
      route: name,
      path,
      ...vitals,
      transferredKb: Math.round(transferred / 1024),
      requests,
      wallClockMs: Date.now() - started,
    });
    console.log(
      `${name.padEnd(9)} FCP ${String(vitals.fcpMs).padStart(5)}ms  LCP ${String(vitals.lcpMs).padStart(5)}ms  CLS ${vitals.cls}  ${Math.round(transferred / 1024)} KB over ${requests} requests`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      profile: {
        viewport: MOBILE,
        cpuSlowdown: CPU_SLOWDOWN,
        network: "Fast 3G (1.6 Mbps down, 150 ms RTT)",
        server: BASE,
      },
      routes: results,
    },
    null,
    2,
  ) + "\n",
);
console.log(`\nwritten to ${OUT}`);
