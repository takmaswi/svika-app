// The svika-accounts Edge Function rules (supabase/functions/svika-accounts):
// hidden addresses that can never receive mail, and a sign up rate limit
// per network address that a caller cannot dodge.
import { describe, expect, test } from "vitest";
import {
  CHECKS_PER_ORIGIN_HOUR,
  RESERVED,
  SIGN_UPS_PER_ORIGIN_HOUR,
  SYNTHETIC_DOMAIN,
  UNKNOWN_ORIGIN,
  breachCount,
  checkAllowed,
  checkPassword,
  checkUsername,
  hibpQuery,
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

describe("leaked password check (Have I Been Pwned range API)", () => {
  test("only the first five characters of the SHA-1 ever leave the function", async () => {
    // SHA-1 of "password" is 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    expect(await hibpQuery("password")).toEqual({ prefix: "5BAA6", suffix: "1E4C9B93F3F0682250B6CF8331B7EE68FD8" });
  });
  test("reads the count for our suffix from the range answer, zero when absent", () => {
    const body = "0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\n";
    expect(breachCount(body, "1E4C9B93F3F0682250B6CF8331B7EE68FD8")).toBe(9545824);
    expect(breachCount(body, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")).toBe(0);
    // padded rows (Add-Padding) carry a zero count and never count as seen
    expect(breachCount("ABCDEF0123456789ABCDEF0123456789ABC:0\n", "ABCDEF0123456789ABCDEF0123456789ABC")).toBe(0);
  });
});

describe("username availability check", () => {
  test("has its own allowance per address", () => {
    expect(checkAllowed(CHECKS_PER_ORIGIN_HOUR - 1)).toBe(true);
    expect(checkAllowed(CHECKS_PER_ORIGIN_HOUR)).toBe(false);
  });
  test("reserved names are never free", () => {
    expect(RESERVED.has("admin")).toBe(true);
    expect(RESERVED.has("svika")).toBe(true);
  });
});
