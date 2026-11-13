// svika-accounts rules: the pure parts of the account function, with no
// Deno or network calls, so the web app's vitest suite can prove them
// (apps/web/test/accounts-rules.test.ts).

/**
 * Hidden auth addresses live under the reserved `.invalid` top level
 * domain (RFC 2606 and RFC 6761): it can never resolve, so mail to it can
 * never be delivered, and nobody can ever register it.
 */
export const SYNTHETIC_DOMAIN = "users.svika.invalid";

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72; // bcrypt ceiling

// lockout and rate rails
export const SIGN_IN_FAILS_PER_USER = 5;
export const SIGN_IN_WINDOW_MIN = 15;
export const FAILS_PER_ORIGIN = 30;
/**
 * Account creations per network address per hour. Mobile networks put many
 * riders behind one address, so this is a burst brake, not a per person cap.
 */
export const SIGN_UPS_PER_ORIGIN_HOUR = 10;
export const RECOVER_FAILS_PER_USER_HOUR = 5;
/** "Is this username free" lookups per network address per hour. */
export const CHECKS_PER_ORIGIN_HOUR = 120;
/** The attempt log keeps rows this long, then the function deletes them. */
export const ATTEMPT_RETENTION_DAYS = 30;

/** Callers with no readable address share this one limited bucket. */
export const UNKNOWN_ORIGIN = "unknown";

export const RESERVED = new Set([
  "admin", "administrator", "root", "svika", "support", "help", "mhofu",
  "owner", "conductor", "hwindi", "system", "null", "undefined", "moderator",
]);

// A short local screen of the passwords people guess first. It holds when
// the leaked password check below (Have I Been Pwned) cannot be reached.
export const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwertyuiop", "qwerty123", "11111111", "00000000", "iloveyou", "abc12345",
  "zimbabwe", "harare123", "kombikombi", "letmein1", "welcome1", "admin123",
  "11223344", "87654321", "asdfghjk", "passw0rd", "svika123", "football",
]);

export function syntheticEmail(randomPart: string): string {
  return `r-${randomPart}@${SYNTHETIC_DOMAIN}`;
}

export function checkUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim().toLowerCase();
  return USERNAME_RE.test(u) ? u : null;
}

export function checkPassword(raw: unknown): string | null {
  if (typeof raw !== "string") return "password_short";
  if (raw.length < MIN_PASSWORD) return "password_short";
  if (raw.length > MAX_PASSWORD) return "password_long";
  if (COMMON_PASSWORDS.has(raw.toLowerCase())) return "password_common";
  return null;
}

/**
 * The caller's network address as the platform saw it. Read from the
 * request headers the edge sets, never from the request body, so a caller
 * cannot pick its own bucket. An address that is missing or malformed
 * falls into UNKNOWN_ORIGIN, which is limited like any other.
 */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headers.get("cf-connecting-ip")?.trim() || headers.get("x-real-ip")?.trim();
  if (!candidate || candidate.length > 45 || !/^[0-9a-fA-F:.]+$/.test(candidate)) return UNKNOWN_ORIGIN;
  return candidate.toLowerCase();
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * What the attempt log stores for an address: a peppered hash, never the
 * address itself. The pepper is a server secret, so the log cannot be
 * reversed by hashing every address.
 */
export function originHash(address: string, pepper: string): Promise<string> {
  return sha256Hex(`svika-origin:${pepper}:${address}`);
}

export function signUpAllowed(signUpsFromOriginLastHour: number): boolean {
  return signUpsFromOriginLastHour < SIGN_UPS_PER_ORIGIN_HOUR;
}

export function checkAllowed(checksFromOriginLastHour: number): boolean {
  return checksFromOriginLastHour < CHECKS_PER_ORIGIN_HOUR;
}

/**
 * Leaked password check, k-anonymity style (Have I Been Pwned range API):
 * only the first five hex characters of the password's SHA-1 leave the
 * function; the answer lists every known suffix under that prefix and the
 * match happens here.
 */
export async function hibpQuery(password: string): Promise<{ prefix: string; suffix: string }> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return { prefix: hex.slice(0, 5), suffix: hex.slice(5) };
}

/** How often our suffix appears in a range answer; 0 when absent or padded. */
export function breachCount(rangeBody: string, suffix: string): number {
  for (const line of rangeBody.split(/\r?\n/)) {
    const [s, n] = line.trim().split(":");
    if (s?.toUpperCase() === suffix) return Number(n) || 0;
  }
  return 0;
}
