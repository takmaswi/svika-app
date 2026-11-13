// The svika-accounts Edge Function rules (supabase/functions/svika-accounts):
// hidden addresses that can never receive mail, and a sign up rate limit
// per network address that a caller cannot dodge.
import { describe, expect, test } from "vitest";
import {
  FAILS_PER_ORIGIN,
  ORIGIN_WINDOW_MIN,
  RECOVERY_CODE_SPACE,
  RESERVED,
  SIGN_IN_FAILS_PER_USER,
  SIGN_IN_WINDOW_MIN,
  SIGN_UPS_PER_ORIGIN_HOUR,
  SYNTHETIC_DOMAIN,
  UNKNOWN_ORIGIN,
  type Attempt,
  breachCount,
  checkPassword,
  checkUsername,
  hibpQuery,
  clientAddress,
  originHash,
  originLiftsAt,
  secondsUntil,
  signInLockLiftsAt,
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
    expect(clientAddress(new Headers({ "cf-connecting-ip": "2C0F:F8F0::1" }))).toBe(
      "2c0f:f8f0::1",
    );
  });
  test("a caller with no readable address still lands in one limited bucket", () => {
    expect(clientAddress(new Headers())).toBe(UNKNOWN_ORIGIN);
    expect(clientAddress(new Headers({ "x-forwarded-for": "<script>" }))).toBe(
      UNKNOWN_ORIGIN,
    );
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
    expect(await hibpQuery("password")).toEqual({
      prefix: "5BAA6",
      suffix: "1E4C9B93F3F0682250B6CF8331B7EE68FD8",
    });
  });
  test("reads the count for our suffix from the range answer, zero when absent", () => {
    const body =
      "0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\n";
    expect(breachCount(body, "1E4C9B93F3F0682250B6CF8331B7EE68FD8")).toBe(9545824);
    expect(breachCount(body, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")).toBe(0);
    // padded rows (Add-Padding) carry a zero count and never count as seen
    expect(
      breachCount(
        "ABCDEF0123456789ABCDEF0123456789ABC:0\n",
        "ABCDEF0123456789ABCDEF0123456789ABC",
      ),
    ).toBe(0);
  });
});

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 13, 8, 0);
const miss = (minute: number): Attempt => ({
  kind: "sign_in",
  ok: false,
  at: T0 + minute * MIN,
});

describe("per username sign in lock", () => {
  test("is five wrong passwords inside 15 minutes", () => {
    expect(SIGN_IN_FAILS_PER_USER).toBe(5);
    expect(SIGN_IN_WINDOW_MIN).toBe(15);
    const four = [0, 1, 2, 3].map(miss);
    expect(signInLockLiftsAt(four, T0 + 4 * MIN)).toBeNull();
    expect(signInLockLiftsAt([...four, miss(4)], T0 + 4 * MIN)).not.toBeNull();
  });

  test("lifts on its own 15 minutes after the oldest of the five misses", () => {
    const five = [0, 1, 2, 3, 4].map(miss);
    expect(signInLockLiftsAt(five, T0 + 5 * MIN)).toBe(T0 + 15 * MIN);
    expect(signInLockLiftsAt(five, T0 + 15 * MIN - 1)).toBe(T0 + 15 * MIN);
    // nobody has to do anything: at 15 minutes the username is open again
    expect(signInLockLiftsAt(five, T0 + 15 * MIN)).toBeNull();
    // never longer than 15 minutes from the fifth miss
    expect(signInLockLiftsAt(five, T0 + 19 * MIN)).toBeNull();
  });

  test("a valid recovery code opens a locked username at once", () => {
    const locked = [0, 1, 2, 3, 4].map(miss);
    expect(signInLockLiftsAt(locked, T0 + 6 * MIN)).not.toBeNull();
    const recovered: Attempt = { kind: "recover", ok: true, at: T0 + 6 * MIN };
    expect(signInLockLiftsAt([...locked, recovered], T0 + 6 * MIN)).toBeNull();
  });

  test("wrong recovery codes never lock the username", () => {
    const wrongCodes = Array.from(
      { length: 20 },
      (_, i): Attempt => ({ kind: "recover", ok: false, at: T0 + i * 10_000 }),
    );
    expect(signInLockLiftsAt(wrongCodes, T0 + 4 * MIN)).toBeNull();
  });

  test("a correct sign in starts the count again", () => {
    const attempts = [
      miss(0),
      miss(1),
      miss(2),
      miss(3),
      { kind: "sign_in", ok: true, at: T0 + 4 * MIN } as Attempt,
      miss(5),
    ];
    expect(signInLockLiftsAt(attempts, T0 + 6 * MIN)).toBeNull();
  });

  test("a recovery code is far beyond guessing at the per address allowance", () => {
    // a million addresses each at the full allowance, every hour
    const triesPerHour = 1_000_000 * FAILS_PER_ORIGIN * (60 / ORIGIN_WINDOW_MIN);
    const years = RECOVERY_CODE_SPACE / 2 / triesPerHour / (24 * 365);
    expect(years).toBeGreaterThan(100_000);
  });
});

describe("one allowance per address for sign in, recovery and lookups", () => {
  test("is 30 inside a rolling 15 minutes, the same window as the sign in lock", () => {
    expect(FAILS_PER_ORIGIN).toBe(30);
    expect(ORIGIN_WINDOW_MIN).toBe(SIGN_IN_WINDOW_MIN);
    const times = Array.from({ length: 29 }, (_, i) => T0 + i * 10_000);
    expect(originLiftsAt(times, T0 + 5 * MIN)).toBeNull();
    const full = [...times, T0 + 5 * MIN];
    expect(originLiftsAt(full, T0 + 5 * MIN)).toBe(T0 + 15 * MIN);
    expect(originLiftsAt(full, T0 + 15 * MIN)).toBeNull();
  });

  test("the wait is reported in whole seconds, never zero", () => {
    expect(secondsUntil(T0 + 15 * MIN, T0 + 5 * MIN)).toBe(600);
    expect(secondsUntil(T0 + 1, T0)).toBe(1);
    expect(secondsUntil(T0, T0 + 5)).toBe(1);
  });
});

describe("username availability check", () => {
  test("reserved names are never free", () => {
    expect(RESERVED.has("admin")).toBe(true);
    expect(RESERVED.has("svika")).toBe(true);
  });
});
