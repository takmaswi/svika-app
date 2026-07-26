// Svika Partner (batch Partner): the full consent round trip on one rider.
//
//   off  -> the recorder is exactly the M1 screen: no leg controls, no marks
//   on   -> board a kombi with a route, a direction and a fare, mark a stop,
//           save, and the contribution counts move because the rows landed
//           on the server
//   off  -> the controls are gone again and nothing new is contributed
//
// Consent history is append only, so this spec never assumes a starting
// state: it reads the switch and puts the rider where the step needs them.
// GPS is Playwright's mocked geolocation walked along a Harare line and
// ?gps=replay compresses the adaptive sampling delays, the M1 pattern.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

const WALK_START = { latitude: -17.8292, longitude: 31.0522 };
const WALK_STEPS = [
  ...Array.from({ length: 6 }, (_, i) => ({
    latitude: WALK_START.latitude - (i + 1) * 0.00036,
    longitude: WALK_START.longitude,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    latitude: WALK_START.latitude - 6 * 0.00036,
    longitude: WALK_START.longitude + (i + 1) * 0.00038,
  })),
];

interface Contribution {
  trips: number;
  stops: number;
}

/** The rider's own counts, read fresh: the router cache would serve a stale
    render for the same URL either side of a write. */
async function contribution(page: Page): Promise<Contribution> {
  await page.goto(`/app/partner?t=${Date.now()}`);
  await expect(page.getByTestId("partner-screen")).toBeVisible();
  if ((await page.getByTestId("partner-contrib-empty").count()) > 0) {
    return { trips: 0, stops: 0 };
  }
  return {
    trips: Number(await page.getByTestId("partner-trips").innerText()),
    stops: Number(await page.getByTestId("partner-stops").innerText()),
  };
}

async function setPartner(page: Page, on: boolean): Promise<void> {
  await page.goto(`/app/partner?t=${Date.now()}`);
  const state = await page.getByTestId("partner-screen").getAttribute("data-partner");
  if (state === String(on)) return;
  await page.getByTestId(on ? "partner-on" : "partner-off").click();
  await expect(page.getByTestId("partner-screen")).toHaveAttribute(
    "data-partner",
    String(on),
    { timeout: 15_000 },
  );
}

/** Walk the mocked line until the recorder has accepted some points. */
async function walkTheLine(page: Page, context: BrowserContext): Promise<void> {
  for (const step of WALK_STEPS) {
    await context.setGeolocation(step);
    await page.waitForTimeout(200);
  }
  await expect
    .poll(async () => await page.getByTestId("record-distance").innerText(), {
      timeout: 15_000,
    })
    .toMatch(/^[1-9]\d{1,2} m$/);
}

/** Save the trip; the journey consent ask appears only on a fresh stream. */
async function saveTrip(page: Page, name: string): Promise<void> {
  await page.getByTestId("journey-name").fill(name);
  await page.getByTestId("journey-save").click();
  const consentAgree = page.getByTestId("journey-consent-agree");
  const savedNote = page.getByTestId("journey-saved-note");
  await expect(consentAgree.or(savedNote)).toBeVisible({ timeout: 20_000 });
  if (await consentAgree.isVisible()) await consentAgree.click();
  await expect(savedNote).toBeVisible({ timeout: 20_000 });
}

test.describe("Svika Partner", () => {
  test.use({ geolocation: WALK_START, permissions: ["geolocation"] });

  test("opt in, record, the rows land, opt out and they stop", async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await loginAs(page, "RIDER");

    // --- off: the recorder is the plain M1 screen ---------------------------
    await setPartner(page, false);
    await page.goto("/app/record?gps=replay");
    await expect(page.getByTestId("record-screen")).toHaveAttribute(
      "data-state",
      "idle",
    );
    await page.getByTestId("record-start").click();
    await expect(page.getByTestId("record-screen")).toHaveAttribute(
      "data-state",
      "recording",
    );
    await expect(page.getByTestId("record-board")).toHaveCount(0);
    await expect(page.getByTestId("record-mark")).toHaveCount(0);
    await expect(page.getByTestId("leg-chip")).toHaveCount(0);
    await page.getByTestId("record-stop").click();
    await expect(page.getByTestId("record-screen")).toHaveAttribute(
      "data-state",
      "finish",
    );
    await page.getByTestId("journey-discard").click();
    await expect(page).toHaveURL(/\/app(\?|$)/, { timeout: 20_000 });

    const before = await contribution(page);

    // --- on: the collection engine appears ---------------------------------
    await setPartner(page, true);
    await page.goto("/app/record?gps=replay");
    await page.getByTestId("record-mode-kombi").click();
    await page.getByTestId("record-start").click();
    await expect(page.getByTestId("leg-chip")).toBeVisible();
    await expect(page.getByTestId("leg-mode")).toHaveText("Walking");

    // board a kombi: route, direction and what it cost
    await page.getByTestId("record-board").click();
    await expect(page.getByTestId("board-sheet")).toBeVisible();
    // the confirm stays shut until a direction is picked (the field
    // logger's dead validation branch, fixed)
    await expect(page.getByTestId("board-confirm")).toBeDisabled();
    await page.getByTestId("board-route").fill("Mt Pleasant Heights to Rezende");
    await page.getByTestId("board-fare").fill("1.50");
    await page.getByTestId("board-dir-outbound").click();
    await expect(page.getByTestId("board-confirm")).toBeEnabled();
    await page.getByTestId("board-confirm").click();
    await expect(page.getByTestId("leg-mode")).toHaveText("Riding");

    await walkTheLine(page, context);

    // mark a rank where something actually happened
    await page.getByTestId("record-mark").click();
    await expect(page.getByTestId("mark-sheet")).toBeVisible();
    // no kind is preselected, so a mistap cannot mint a confidently wrong
    // stop (the field logger preselected "drop off")
    await expect(page.getByTestId("mark-drop")).toBeDisabled();
    const markName = `Partner e2e ${Date.now().toString(36)}`;
    await page.getByTestId("mark-kind-rank").click();
    await page.getByTestId("mark-name").fill(markName);
    await expect(page.getByTestId("mark-drop")).toBeEnabled();
    await page.getByTestId("mark-drop").click();
    await expect(page.getByTestId("mark-note")).toContainText(markName);

    await page.getByTestId("record-alight").click();
    await expect(page.getByTestId("leg-mode")).toHaveText("Walking");

    await page.getByTestId("record-stop").click();
    await expect(page.getByTestId("record-screen")).toHaveAttribute(
      "data-state",
      "finish",
    );
    // walk, ride, walk: three legs and one marked stop
    expect(Number(await page.getByTestId("finish-legs").innerText())).toBe(3);
    expect(Number(await page.getByTestId("finish-marks").innerText())).toBe(1);
    await saveTrip(page, "Partner corridor run");

    // a partner is not offered the partner door again
    await expect(page.getByTestId("partner-door")).toHaveCount(0);

    // --- the rows landed on the server -------------------------------------
    const after = await contribution(page);
    expect(after.trips).toBe(before.trips + 1);
    expect(after.stops).toBeGreaterThan(before.stops);
    await expect(page.getByTestId("partner-distance")).toContainText(/m|km/);

    // --- off again: the controls go and nothing new is contributed ---------
    await setPartner(page, false);
    await page.goto("/app/record?gps=replay");
    await page.getByTestId("record-start").click();
    await expect(page.getByTestId("record-board")).toHaveCount(0);
    await expect(page.getByTestId("record-mark")).toHaveCount(0);
    await page.getByTestId("record-stop").click();
    await saveTrip(page, "After opting out");

    // and the door is offered again, gently, to somebody who is not one
    await expect(page.getByTestId("partner-door")).toBeVisible();

    const afterOptOut = await contribution(page);
    expect(afterOptOut.trips).toBe(after.trips);
    expect(afterOptOut.stops).toBe(after.stops);
  });
});
