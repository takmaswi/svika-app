// Pure helpers for the account screens (no network, no framework), so the
// unit suite can prove them.
import type { DictKey } from "../dict";

/** The function's error codes, in Svika copy. */
export const ERROR_COPY: Record<string, DictKey> = {
  username_invalid: "acct.nameRules",
  username_blocked: "acct.nameBlocked",
  username_taken: "acct.nameTaken",
  password_short: "acct.pwShort",
  password_long: "acct.pwLong",
  password_common: "acct.pwCommon",
  password_leaked: "acct.pwLeaked",
  wrong_details: "acct.wrong",
  wrong_code: "acct.wrongCode",
  locked: "acct.locked",
  rate_limited: "acct.rateLimited",
  offline: "acct.offline",
};

export function errorKey(code: string): DictKey {
  return ERROR_COPY[code] ?? "acct.failed";
}

/** "K7QM4XRT9PLW" as the three groups the screen shows. */
export function codeGroups(code: string): string[] {
  const raw = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return [raw.slice(0, 4), raw.slice(4, 8), raw.slice(8, 12)];
}

/** Password strength for the meter: 0 to 4 filled bars, never a gate. */
export function strength(password: string): number {
  if (password.length < 8) return password.length > 0 ? 1 : 0;
  let score = 2;
  if (password.length >= 12) score++;
  if (/[a-z]/i.test(password) && /\d/.test(password) && /[^a-z\d]/i.test(password))
    score++;
  return Math.min(score, 4);
}
