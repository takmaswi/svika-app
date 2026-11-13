// Launch e2e helpers. The suite's dev server gets SVIKA_PREVIEW_TOKEN from
// the Playwright config, so a spec turns every launch flag on for its own
// browser context by carrying the preview cookie. Specs without it keep
// testing the pre launch app, which CI keeps running (ruling 14).
import type { BrowserContext } from "@playwright/test";

export const E2E_PREVIEW_TOKEN = "e2e-launch-preview-token-0001";

export async function enableLaunchPreview(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: "svika_preview",
      value: E2E_PREVIEW_TOKEN,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
