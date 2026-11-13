// Launch Step 2: username and password accounts, end to end against the
// real svika-accounts Edge Function and the real auth project. One account
// per run (the function allows 10 creations per network address an hour):
// sign up, recovery code shown once, sign in, wrong password, recovery with
// the code (new code, old code dead), delete, and the per username lockout.
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { enableLaunchPreview } from "./launch-helpers";

const username = `e2e_${Date.now().toString(36)}`.slice(0, 20);
// random so the leaked password check can never have seen it
const password = `Kombi rider ${Math.random().toString(36).slice(2, 10)}`;
const newPassword = `Rank walk ${Math.random().toString(36).slice(2, 10)}`;
const CODE_RE = /^[A-Z0-9]{4} [A-Z0-9]{4} [A-Z0-9]{4}$/;

async function signedOut(context: BrowserContext): Promise<void> {
  await context.clearCookies();
  await enableLaunchPreview(context);
}

async function signIn(page: Page, pw: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(pw);
  await page.getByTestId("signin-submit").click();
}

async function readCode(page: Page): Promise<string> {
  const code = page.getByTestId("recovery-code");
  await expect(code).toBeVisible({ timeout: 20_000 });
  const text = (await code.innerText()).replace(/\s+/g, " ").trim();
  expect(text).toMatch(CODE_RE);
  return text;
}

test.describe.configure({ mode: "serial" });

test.describe("username accounts", () => {
  test.setTimeout(120_000);
  let firstCode = "";

  test.beforeEach(async ({ context }) => {
    await enableLaunchPreview(context);
  });

  test("sign up with a username and a password, then the code once", async ({
    page,
  }) => {
    await page.goto("/signup");
    await expect(page.getByText("No phone number, no email.")).toBeVisible();
    await page.locator("#username").fill(username);
    await expect(page.getByTestId("username-help")).toHaveText(
      "This username is free",
      { timeout: 15_000 },
    );
    await page.locator("#password").fill(password);
    await page.getByTestId("signup-submit").click();
    firstCode = await readCode(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `Your account is ready, ${username}`,
    );
    // the same name is now taken for anyone else
    await page.getByTestId("recovery-saved").click();
    // a new account meets the consent screen first, and it never claims a
    // phone number or a name the rider was never asked for
    const accept = page.getByTestId("consent-accept");
    const chip = page.getByTestId("profile-chip");
    await expect(accept.or(chip)).toBeVisible({ timeout: 20_000 });
    if (await accept.isVisible()) {
      await expect(page.getByText("Your username and language choice")).toBeVisible();
      await expect(page.getByText(/phone number/i)).toHaveCount(0);
      await accept.click();
    }
    await expect(chip).toBeVisible({ timeout: 20_000 });
  });

  test("the name is taken once claimed", async ({ page, context }) => {
    await signedOut(context);
    await page.goto("/signup");
    await page.locator("#username").fill(username);
    await expect(page.getByTestId("username-help")).toHaveText(
      "Someone already has this username. Try another.",
      { timeout: 15_000 },
    );
  });

  test("a wrong password gets the same answer as an unknown name; the right one signs in", async ({
    page,
    context,
  }) => {
    await signedOut(context);
    await signIn(page, "not the password at all");
    await expect(page.getByTestId("account-error")).toHaveText(
      "That username and password do not match.",
    );
    await signIn(page, password);
    await expect(page.getByTestId("profile-chip")).toBeVisible({ timeout: 20_000 });
  });

  test("the recovery code resets the password, once, and a new code replaces it", async ({
    page,
    context,
  }) => {
    await signedOut(context);
    await page.goto("/recover");
    await page.locator("#username").fill(username);
    await page.locator("#code").fill(firstCode);
    await page.locator("#new-password").fill(newPassword);
    await page.getByTestId("recover-submit").click();
    const secondCode = await readCode(page);
    expect(secondCode).not.toBe(firstCode);

    // the old code is dead
    await signedOut(context);
    await page.goto("/recover");
    await page.locator("#username").fill(username);
    await page.locator("#code").fill(firstCode);
    await page.locator("#new-password").fill(`${newPassword}x`);
    await page.getByTestId("recover-submit").click();
    await expect(page.getByTestId("account-error")).toHaveText(
      "That username and recovery code do not match.",
    );

    // the new password works, the old one does not
    await signIn(page, password);
    await expect(page.getByTestId("account-error")).toHaveText(
      "That username and password do not match.",
    );
    await signIn(page, newPassword);
    await expect(page.getByTestId("profile-chip")).toBeVisible({ timeout: 20_000 });
  });

  test("delete my account erases the sign in, and five misses lock the name", async ({
    page,
  }) => {
    await signIn(page, newPassword);
    await expect(page.getByTestId("profile-chip")).toBeVisible({ timeout: 20_000 });
    await page.goto("/app/privacy");
    await page.getByTestId("delete-data").click();
    await page.getByTestId("delete-data-confirm").click();
    await page.waitForURL((url) => !url.pathname.startsWith("/app/privacy"));

    // the account can no longer be reached with its old details
    await signIn(page, newPassword);
    await expect(page.getByTestId("account-error")).toHaveText(
      "That username and password do not match.",
    );
    // misses so far in this run: one in the sign in test, the old password
    // after recovery, and the one above; two more make five, and the sixth
    // try is refused before any password is checked
    for (let i = 0; i < 2; i++) {
      await signIn(page, `wrong guess ${i}`);
      await expect(page.getByTestId("account-error")).toHaveText(
        "That username and password do not match.",
      );
    }
    await signIn(page, newPassword);
    await expect(page.getByTestId("account-error")).toHaveText(
      "Too many tries for this username. Wait 15 minutes, then try again.",
    );
  });
});
