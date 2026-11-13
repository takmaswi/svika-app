// Playwright e2e for the P1 flows. Runs against the real Supabase project
// with the seeded demo users (global setup re-seeds so wallets and network
// are in a known state). Videos are kept as the flow recordings that back
// the phase gate evidence.
import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// pull Supabase + demo credentials from the repo root .env.local
const repoRoot = join(__dirname, "..", "..");
for (const f of [".env.local", ".env"]) {
  const p = join(repoRoot, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!;
  }
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false, // flows share demo users; keep them ordered
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 360, height: 740 }, // reference device: cheap Android
    video: "on",
    screenshot: "only-on-failure",
    locale: "en-ZW",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
      // the launch preview token lets launch specs turn every launch flag
      // on for their own browser context (e2e/launch-helpers.ts)
      env: { E2E_AUTH: "on", SVIKA_PREVIEW_TOKEN: "e2e-launch-preview-token-0001" },
    },
    {
      // the hwindi surface, driven by the redeem flow specs
      command: "pnpm --filter conductor dev",
      cwd: join(__dirname, "..", ".."),
      url: "http://localhost:5174",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // spine 1 serves the real arrival numbers (SPINE_URL in .env.local);
      // without it the mock twin serves and every basis label says demo
      // estimate, which the intelligence door test refuses to record
      command: "pnpm --filter @svika/spine dev",
      cwd: join(__dirname, "..", ".."),
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
