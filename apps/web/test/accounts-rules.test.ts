// The svika-accounts Edge Function rules (supabase/functions/svika-accounts):
// hidden addresses that can never receive mail, and a sign up rate limit
// per network address that a caller cannot dodge.
import { describe, expect, test } from "vitest";
import {
  SIGN_UPS_PER_ORIGIN_HOUR,
  SYNTHETIC_DOMAIN,
  UNKNOWN_ORIGIN,
  checkPassword,
  checkUsername,
  clientAddress,
  originHash,
  signUpAllowed,
  syntheticEmail,
} from "../../../supabase/functions/svika-accounts/rules";

describe("hidden auth addresses", () => {
  test("live under the reserved .invalid top level domain, which can never receive mail", () => {
    const email = syntheticEmail("abc123");
    expect(email).toBe(`r-abc123@${SYNTHETIC_DOMAIN}`);
    expect(email.split("@")[1]!.split(".").at(-1)).toBe("invalid");
  });
  test("never carry the username", () => {
    expect(checkUsername("  Tendai.M ")).toBe("tendai.m");
    expect(syntheticEmail("x9")).not.toContain("tendai");
  });
});

describe("sign up rate limit per address", () => {
  test("reads the address the platform saw, first hop of x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "41.57.100.9, 10.0.0.1" });
    expect(clientAddress(h)).toBe("41.57.100.9");
    expect(clientAddress(new Headers({ "cf-connecting-ip": "2C0F:F8F0::1" }))).toBe("2c0f:f8f0::1");
  });
  test("a caller with no readable address still lands in one limited bucket", () => {
    expect(clientAddress(new Headers())).toBe(UNKNOWN_ORIGIN);
    expect(clientAddress(new Headers({ "x-forwarded-for": "<script>" }))).toBe(UNKNOWN_ORIGIN);
  });
  test("refuses once the hour's allowance from one address is used", () => {
    expect(signUpAllowed(0)).toBe(true);
    expect(signUpAllowed(SIGN_UPS_PER_ORIGIN_HOUR - 1)).toBe(true);
    expect(signUpAllowed(SIGN_UPS_PER_ORIGIN_HOUR)).toBe(false);
  });
  test("stores a peppered hash, never the address, stable per address", async () => {
    const a = await originHash("41.57.100.9", "pepper");
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).not.toContain("41.57");
    expect(await originHash("41.57.100.9", "pepper")).toBe(a);
    expect(await originHash("41.57.100.10", "pepper")).not.toBe(a);
    expect(await originHash("41.57.100.9", "other")).not.toBe(a);
  });
});

describe("passwords", () => {
  test("at least 8, at most 72, and not a common guess", () => {
    expect(checkPassword("short")).toBe("password_short");
    expect(checkPassword("x".repeat(73))).toBe("password_long");
    expect(checkPassword("Password123")).toBe("password_common");
    expect(checkPassword("kombi rank at fourth street")).toBeNull();
  });
});
