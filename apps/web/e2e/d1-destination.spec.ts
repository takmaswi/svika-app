// D1, destination first planning. The search accepts any place from the
// local OSM corpus (no vendor in the ride path): a plan to a point scores
// candidate alight stops on ride plus walking tail and shows the trade
// honestly, the no service case says so plainly, the picker labels place
// kinds, and in ride alight guidance fires on the trace replay of a booked
// destination trip, with the walking tail cue proving the recorded tail
// rode the ticket. Playwright records video for every test; the guidance
// test's video is the gate recording.
import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loginAs, waitForHydration } from "./helpers";

const TAKUNDA_EMAIL = "demo.takunda@svika.app";
const UZ = "University of Zimbabwe";
const PLAN_UZ = `/app/plan?from=Heights&to=${encodeURIComponent(UZ)}`;

async function loginTakunda(page: Page): Promise<void> {
  const res = await page.request.post("/e2e/login", {
    data: { email: TAKUNDA_EMAIL, password: process.env.DEMO_JUDGE_PASSWORD },
  });
  expect(res.ok(), `Takunda login failed: ${res.status()}`).toBeTruthy();
}

async function conductorClient(): Promise<SupabaseClient> {
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await c.auth.signInWithPassword({
    email: process.env.DEMO_CONDUCTOR_EMAIL!,
    password: process.env.DEMO_CONDUCTOR_PASSWORD!,
  });
  if (error) throw new Error(`conductor sign in failed: ${error.message}`);
  return c;
}

test.describe("D1 destination first planning", () => {
  test("an address search lands a plan with an alight stop and a walking tail", async ({
    page,
  }) => {
    await loginAs(page, "RIDER");
    await page.goto("/app");
    await waitForHydration(page);
    await page.fill("#from", "Heights");
    await page.fill("#to", UZ);
    await page.click(".home-search-go");

    // the honest trade, on screen with the fare
    const trade = page.getByTestId("plan-trade");
    await expect(trade).toBeVisible({ timeout: 20_000 });
    await expect(trade).toContainText(/Drop at .+, then a \d+ m walk\./);

    // the walking tail is a leg of the plan, in metres and minutes; the
    // sheet toggle is React state, so never race hydration on this page
    await waitForHydration(page);
    await page.locator(".home-sheet-grabber").click();
    const tail = page.getByTestId("walk-tail-leg");
    await expect(tail).toBeVisible();
    await expect(tail).toContainText(UZ);
    await expect(tail).toContainText(/\d+ m/);

    // one tap books the ride legs through the normal ledger path
    await waitForHydration(page);
    await page.click("button[value=wallet]");
    await page.waitForURL(/booked=1/, { timeout: 30_000 });
    await expect(page.locator(".ticket-item-code").first()).toHaveText(/^\d{4}$/);
  });

  test("a place no kombi reaches is said plainly, closest drop and walk shown", async ({
    page,
  }) => {
    await loginAs(page, "RIDER");
    await page.goto(`/app/plan?from=Heights&to=${encodeURIComponent("Kuwadzana")}`);
    const trade = page.getByTestId("plan-trade");
    await expect(trade).toBeVisible({ timeout: 20_000 });
    await expect(trade).toContainText(/No kombi reaches Kuwadzana yet\./);
    await expect(trade).toContainText(/The closest drop is .+, then a \d+ m walk\./);
  });

  test("the trade speaks Shona when the app does", async ({ page }) => {
    await loginAs(page, "RIDER");
    await page.context().addCookies([
      { name: "svika_lang", value: "sn", url: "http://localhost:3000" },
    ]);
    await page.goto(PLAN_UZ);
    const trade = page.getByTestId("plan-trade");
    await expect(trade).toBeVisible({ timeout: 20_000 });
    await expect(trade).toContainText(/Buruka pa.+, wofamba \d+ m netsoka\./);
  });

  test("the picker labels geocoded places by kind", async ({ page }) => {
    await loginAs(page, "RIDER");
    // "primary school" matches dozens of places and no stop: never a
    // confident match, always the picker with its kind labels
    await page.goto(
      `/app/plan?from=Heights&to=${encodeURIComponent("primary school")}`,
    );
    await expect(page.locator(".picker-kind").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("alight guidance fires at the right stop on the trace replay, walk cue last", async ({
    page,
  }) => {
    // Takunda has voice prefs on and a wallet float: book the UZ trip
    await loginTakunda(page);
    await page.goto(PLAN_UZ);
    await expect(page.getByTestId("plan-trade")).toBeVisible({ timeout: 20_000 });
    await waitForHydration(page);
    await page.click("button[value=wallet]");
    await page.waitForURL(/booked=1/, { timeout: 30_000 });
    const code = await page.locator(".ticket-item-code").first().innerText();
    expect(code).toMatch(/^\d{4}$/);

    // the hwindi clears the code through the same RPC the keypad uses
    const conductor = await conductorClient();
    const { data: route } = await conductor
      .from("routes")
      .select("id")
      .eq("code", "HEIGHTS-REZENDE")
      .single();
    const { data: verdict, error } = await conductor.rpc("redeem_board_code", {
      p_route: route!.id,
      p_direction: "outbound",
      p_code: code,
    });
    expect(error).toBeNull();
    expect((verdict as { outcome: string }[])[0]?.outcome).toBe("success");

    // boarded: the guide arms; ?voice=replay compresses the last stretch
    // through the same engine, so the cues land in seconds on video
    await page.goto("/app?voice=replay");
    const caption = page.getByTestId("voice-caption");
    await expect(caption).toContainText("Your stop is coming up.", {
      timeout: 30_000,
    });
    await expect(caption).toContainText("This is your stop. Get off here.", {
      timeout: 30_000,
    });
    // the walk cue exists only because the booked plan carried a walking
    // tail to the destination: the recorded tail proves itself here
    await expect(caption).toContainText("Your walking leg starts here.", {
      timeout: 20_000,
    });

    // V3 ruling 3: the at-the-stop cue opened the skippable arrival confirm.
    // It only asks: the dismiss door is real, and only the rider's own tap
    // posts the arrival (never a geofence acting for them).
    const arrivePrompt = page.getByTestId("voice-arrive");
    await expect(arrivePrompt).toBeVisible();
    await expect(page.getByTestId("voice-arrive-dismiss")).toBeVisible();
    await page.getByTestId("voice-arrive-confirm").click();
    await page.waitForURL(/\/app\/ticket\//, { timeout: 20_000 });
    await expect(page.locator(".boarding-card")).toHaveAttribute(
      "data-status",
      "arrived",
    );
    await expect(page.getByTestId("ticket-arrived-note")).toBeVisible();
  });
});
