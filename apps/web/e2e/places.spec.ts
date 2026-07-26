// Name the city (batch M3): one rider names a spot and the name is theirs
// alone; two more riders name the same spot the same way; the scheduled
// rule pass (triggered here exactly as pg_cron runs it) promotes the
// cluster; the suggestion appears for everyone with a tappable recommended
// chip; and three independent reports hide it again. The whole loop runs
// through the product surfaces, not the database, except the promotion
// trigger and the personal row cleanup which use the service role the way
// the scheduler and the seed do.
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAs, type DemoRole } from "./helpers";

// inside the Harare tile box, away from the demo corridor. The spot is
// random per run: a hidden community name keeps blocking similar names
// nearby forever (the resurrection shield), so runs must not share ground.
const AT = `${(-17.79 + Math.random() * 0.05).toFixed(5)},${(31.1 + Math.random() * 0.06).toFixed(5)}`;
const RUN_NAME = `Pa e2e ${Date.now().toString(36)}`;

// the home map test names a spot beside the rank the boarding camera opens
// on (the first corridor coordinate, from the seed's field export)
const RANK: [number, number] = [31.0468404, -17.7170019];
const HOME_NAME = `Pahome e2e ${Date.now().toString(36)}`;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing Supabase service env for the promotion pass");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function openPlaces(page: Page): Promise<void> {
  await page.goto(`/app/places?at=${AT}`);
  await expect(page.getByTestId("places-screen")).toBeVisible();
  // interacting before hydration would click a dead button; the map ready
  // flag flips inside React effects, so it doubles as the hydration signal
  await expect(page.getByTestId("places-map")).toHaveAttribute(
    "data-map-ready",
    "true",
    { timeout: 30_000 },
  );
}

// pull the home camera into a neighbourhood frame: the map answers wheel
// deltas the way a pinch would, and the zoom settles in well under a second
async function zoomIn(page: Page): Promise<void> {
  await page.mouse.move(180, 300);
  for (let i = 0; i < 4; i += 1) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(600);
}

async function nameTheSpot(page: Page, role: DemoRole): Promise<void> {
  await loginAs(page, role);
  await openPlaces(page);
  await page.getByTestId("place-name-input").fill(RUN_NAME);
  await page.getByTestId("place-save").click();
  await expect(page.getByTestId("place-outcome")).toHaveAttribute(
    "data-outcome",
    "success",
    { timeout: 15_000 },
  );
}

test.describe("name the city", () => {
  test("a name is personal until three riders agree, then a suggestion appears, and reports hide it", async ({
    page,
    browser,
  }) => {
    // rider one names the spot; the chip renders as theirs alone
    await nameTheSpot(page, "RIDER");
    await expect(
      page.locator(
        `[data-testid="map-place-chip"][data-scope="personal"][data-place-name="${RUN_NAME}"]`,
      ),
    ).toHaveCount(1);

    // rider two, own phone: the personal name is invisible (RLS), then
    // they name the same spot the same way
    const ownerCtx = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
    });
    const owner = await ownerCtx.newPage();
    await loginAs(owner, "OWNER");
    await openPlaces(owner);
    await expect(
      owner.locator(`[data-testid="map-place-chip"][data-place-name="${RUN_NAME}"]`),
    ).toHaveCount(0);
    await owner.getByTestId("place-name-input").fill(RUN_NAME);
    await owner.getByTestId("place-save").click();
    await expect(owner.getByTestId("place-outcome")).toHaveAttribute(
      "data-outcome",
      "success",
      { timeout: 15_000 },
    );

    // rider three
    const conductorCtx = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
    });
    const conductor = await conductorCtx.newPage();
    await nameTheSpot(conductor, "CONDUCTOR");

    // the scheduled rule pass runs (exactly what pg_cron does every 15 min)
    const admin = serviceClient();
    const promoted = await admin.rpc("run_places_promotion");
    expect(promoted.error, promoted.error?.message).toBeNull();

    // the suggestion now stands for everyone, and the recommended naming
    // row offers it to tap instead of retyping
    await openPlaces(page);
    await expect(
      page.locator(
        `[data-testid="map-place-chip"][data-scope="suggested"][data-place-name="${RUN_NAME}"]`,
      ),
    ).toHaveCount(1);
    await expect(
      page.getByTestId("place-recommend").filter({ hasText: RUN_NAME }),
    ).toHaveCount(1);

    // three independent reports hide the name everywhere (the safety rail,
    // driven through the product report door)
    for (const [reporter] of [[page], [owner], [conductor]] as const) {
      await openPlaces(reporter);
      const row = reporter
        .getByTestId("place-nearby-row")
        .filter({ hasText: RUN_NAME });
      await expect(row).toHaveCount(1);
      await row.getByTestId("place-report").click();
      await expect(row.getByTestId("place-reported")).toBeVisible({
        timeout: 15_000,
      });
    }
    // the community chip is gone everywhere; the rider's own personal name
    // stays on their own map, exactly as the personal wall promises
    await openPlaces(page);
    await expect(
      page.locator(
        `[data-testid="map-place-chip"][data-scope="suggested"][data-place-name="${RUN_NAME}"]`,
      ),
    ).toHaveCount(0);
    await expect(
      page.locator(
        `[data-testid="map-place-chip"][data-scope="personal"][data-place-name="${RUN_NAME}"]`,
      ),
    ).toHaveCount(1);

    // cleanup: this run's personal rows go; the hidden community row is
    // append only history and stays invisible on every surface
    await admin
      .from("place_names")
      .delete()
      .eq("scope", "personal")
      .eq("name", RUN_NAME);

    await ownerCtx.close();
    await conductorCtx.close();
  });

  // M3 ruling 3: an agreed name is not a filing cabinet entry, it belongs on
  // the map everybody opens. Public names only, riders and guests alike, and
  // only while the camera is close enough for a neighbourhood to read.
  test("a public name rides the home map for riders and guests, and pulls back with the camera", async ({
    page,
    browser,
  }) => {
    const admin = serviceClient();
    // beside the rank the home camera opens on, so the chip lands in frame
    const { data: seeded, error: seedErr } = await admin
      .from("place_names")
      .insert({
        author_id: null,
        name: HOME_NAME,
        kind: "stop",
        scope: "public",
        location: `SRID=4326;POINT(${RANK[0] + 0.0008} ${RANK[1] - 0.0006})`,
      })
      .select("id")
      .single();
    expect(seedErr, seedErr?.message).toBeNull();

    const chip = `[data-testid="map-place-chip"][data-scope="public"][data-place-name="${HOME_NAME}"]`;
    try {
      await loginAs(page, "RIDER");
      await page.goto("/app");
      await expect(page.getByTestId("live-map")).toHaveAttribute(
        "data-map-ready",
        "true",
        { timeout: 30_000 },
      );
      // the chip is drawn; whether it shows depends on the camera, and the
      // opening frame follows the nearest kombi, so the test sets the zoom
      // itself instead of trusting where the fleet happens to be
      await expect(page.locator(chip)).toHaveCount(1, { timeout: 15_000 });
      await zoomIn(page);
      await expect(page.locator(chip)).toBeVisible({ timeout: 15_000 });

      // one tap out to the whole corridor and the names step back: the route
      // never competes with labels at network zoom
      await page.getByTestId("map-view-toggle").click();
      await expect(page.locator(chip)).toBeHidden({ timeout: 15_000 });

      // community knowledge with no account: the same name on the guest map
      const guestCtx = await browser.newContext({
        baseURL: test.info().project.use.baseURL,
      });
      const guest = await guestCtx.newPage();
      await guest.goto("/app");
      await expect(guest.getByTestId("guest-home")).toBeVisible();
      await expect(guest.getByTestId("live-map")).toHaveAttribute(
        "data-map-ready",
        "true",
        { timeout: 30_000 },
      );
      await zoomIn(guest);
      await expect(guest.locator(chip)).toBeVisible({ timeout: 15_000 });
      await guestCtx.close();
    } finally {
      // the corridor is the demo stage: this row leaves with the test
      if (seeded?.id) await admin.from("place_names").delete().eq("id", seeded.id);
    }
  });
});
