// svika-accounts: username and password accounts (launch Step 2, ruling 4).
//
// The only code that creates, signs in, recovers or closes a username
// account. Runs on Supabase Edge Functions with the platform's own
// SUPABASE_SERVICE_ROLE_KEY, so the web app and the repo never hold it.
//
// Each account gets a synthetic auth address `r-<random>@users.svika.invalid`
// (RFC 2606 reserved TLD: undeliverable and unownable), created with
// email_confirm true so no mail is ever attempted. The username maps to the
// user id in public.account_usernames, never into the address, so a freed
// username can never collide with an old account.
//
// Every attempt is logged here, server side, into public.auth_attempts; a
// username with too many recent failures is refused before a password is
// even checked.
//
// The rate limit bucket is the network address the platform saw (rules.ts
// clientAddress), stored only as a peppered hash. The rider's browser calls
// this function directly, so that address is the rider's own; a call relayed
// through the web server would put every rider in Vercel's bucket.
//
// Actions (POST JSON): check_username, sign_up, sign_in, recover, and
// delete_account, the last step of delete my account: the web app runs
// anonymise_me and forget_my_username as the rider (lib/actions.ts), then
// this removes the auth user itself (migration 0051). Responses are
// { ok: true, ... } or { ok: false, error: <code> } with Svika error codes
// the web app turns into Svika copy.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import {
  ATTEMPT_RETENTION_DAYS,
  ORIGIN_WINDOW_MIN,
  RESERVED,
  SIGN_IN_WINDOW_MIN,
  type Attempt,
  breachCount,
  checkPassword,
  checkUsername,
  clientAddress,
  hibpQuery,
  originHash,
  originLiftsAt,
  secondsUntil,
  sha256Hex,
  signInLockLiftsAt,
  signUpAllowed,
  syntheticEmail,
} from "./rules.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

type Json = Record<string, unknown>;

function reply(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
const fail = (error: string, status = 400) => reply({ ok: false, error }, status);
/** A refusal that says how long to wait, so the screen can tell the rider. */
const wait = (error: "locked" | "rate_limited", liftsAt: number) =>
  reply({ ok: false, error, retry_after: secondsUntil(liftsAt, Date.now()) }, 429);

function randomString(alphabet: string, length: number): string {
  const out: string[] = [];
  const buf = new Uint8Array(length * 2);
  crypto.getRandomValues(buf);
  for (let i = 0; out.length < length && i < buf.length; i++) {
    // rejection sampling keeps every symbol equally likely
    if (buf[i]! < 256 - (256 % alphabet.length)) out.push(alphabet[buf[i]! % alphabet.length]!);
  }
  while (out.length < length) out.push(alphabet[0]!);
  return out.join("");
}

function newRecoveryCode(): string {
  const raw = randomString(RECOVERY_ALPHABET, 12);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function normaliseCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function storeRecoveryCode(userId: string): Promise<string> {
  const code = newRecoveryCode();
  const salt = randomString("abcdefghijklmnopqrstuvwxyz0123456789", 24);
  const hash = await sha256Hex(`${salt}:${normaliseCode(code)}`);
  const { error } = await admin
    .from("account_recovery_codes")
    .upsert({ user_id: userId, code_salt: salt, code_hash: hash, issued_at: new Date().toISOString() });
  if (error) throw error;
  return code;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function log(username: string, kind: string, ok: boolean, origin: string) {
  await admin.from("auth_attempts").insert({ username, kind, ok, origin_hash: origin });
}

async function countSince(filter: { username?: string; origin?: string; kind: string; ok?: boolean }, minutes: number) {
  let q = admin
    .from("auth_attempts")
    .select("id", { count: "exact", head: true })
    .eq("kind", filter.kind)
    .gte("at", new Date(Date.now() - minutes * 60_000).toISOString());
  if (filter.username) q = q.eq("username", filter.username);
  if (filter.origin) q = q.eq("origin_hash", filter.origin);
  if (filter.ok !== undefined) q = q.eq("ok", filter.ok);
  const { count } = await q;
  return count ?? 0;
}

/** Recent attempts for one username or one address, oldest rows ignored. */
async function recentAttempts(filter: { username?: string; origin?: string; kinds: Attempt["kind"][] }, minutes: number): Promise<Attempt[]> {
  let q = admin
    .from("auth_attempts")
    .select("kind, ok, at")
    .in("kind", filter.kinds)
    .gte("at", new Date(Date.now() - minutes * 60_000).toISOString())
    .order("at", { ascending: false })
    .limit(200);
  if (filter.username) q = q.eq("username", filter.username);
  if (filter.origin) q = q.eq("origin_hash", filter.origin);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({ kind: r.kind as Attempt["kind"], ok: r.ok as boolean, at: Date.parse(r.at as string) }));
}

/**
 * The shared allowance per address: wrong passwords, wrong recovery codes
 * and username lookups each get the same 30 inside 15 minutes.
 */
async function originRefusal(origin: string, kind: "sign_in" | "recover" | "check"): Promise<Response | null> {
  const rows = await recentAttempts({ origin, kinds: [kind] }, ORIGIN_WINDOW_MIN);
  // lookups always count; for sign in and recovery only the misses do
  const times = rows.filter((r) => kind === "check" || !r.ok).map((r) => r.at);
  const lifts = originLiftsAt(times, Date.now());
  return lifts === null ? null : wait("rate_limited", lifts);
}

/**
 * Leaked password adapter (plan Step 2.2). Only the first five characters
 * of the SHA-1 leave; padding hides the answer size. If the service is slow
 * or down the answer is null and the local list in checkPassword still
 * holds, so sign up never depends on a vendor being up.
 */
async function timesLeaked(password: string): Promise<number | null> {
  try {
    const { prefix, suffix } = await hibpQuery(password);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "svika-accounts" },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    return breachCount(await res.text(), suffix);
  } catch {
    return null;
  }
}

/** The attempt log keeps ATTEMPT_RETENTION_DAYS; older rows go. */
async function pruneAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - ATTEMPT_RETENTION_DAYS * 86_400_000).toISOString();
  await admin.from("auth_attempts").delete().lt("at", cutoff);
}

async function usernameIsClean(u: string): Promise<boolean> {
  if (RESERVED.has(u)) return false;
  const { data, error } = await admin.rpc("username_is_clean", { p_username: u });
  if (error) throw error;
  return data === true;
}

async function userIdFor(username: string): Promise<string | null> {
  const { data } = await admin.from("account_usernames").select("user_id").eq("username", username).maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

async function signInSession(email: string, password: string) {
  const client = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return null;
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user_id: data.user!.id,
  };
}

async function signUp(body: Json, origin: string): Promise<Response> {
  const username = checkUsername(body.username);
  if (!username) return fail("username_invalid");
  const pwErr = checkPassword(body.password);
  if (pwErr) return fail(pwErr);
  // every creation attempt from this address counts, made or refused
  if (!signUpAllowed(await countSince({ origin, kind: "sign_up" }, 60))) {
    return fail("rate_limited", 429);
  }
  if (!(await usernameIsClean(username))) {
    await log(username, "sign_up", false, origin);
    return fail("username_blocked");
  }
  if (await userIdFor(username)) {
    await log(username, "sign_up", false, origin);
    return fail("username_taken", 409);
  }
  if (((await timesLeaked(body.password as string)) ?? 0) > 0) {
    return fail("password_leaked");
  }

  const email = syntheticEmail(randomString("abcdefghijklmnopqrstuvwxyz0123456789", 20));
  const created = await admin.auth.admin.createUser({
    email,
    password: body.password as string,
    email_confirm: true,
    user_metadata: { full_name: username, account: "username" },
  });
  if (created.error || !created.data.user) {
    await log(username, "sign_up", false, origin);
    return fail("sign_up_failed", 500);
  }
  const userId = created.data.user.id;
  const claim = await admin.from("account_usernames").insert({ user_id: userId, username });
  if (claim.error) {
    // lost a race for the same username: undo the auth user (its empty
    // profile and wallet stay behind, anonymous, since migration 0051)
    await admin.auth.admin.deleteUser(userId);
    await log(username, "sign_up", false, origin);
    return fail("username_taken", 409);
  }
  const code = await storeRecoveryCode(userId);
  await log(username, "sign_up", true, origin);
  await pruneAttempts();
  const session = await signInSession(email, body.password as string);
  if (!session) return fail("sign_in_failed", 500);
  return reply({ ok: true, session, recovery_code: code, username });
}

/** "Is this username free" for the sign up screen, limited per address. */
async function checkName(body: Json, origin: string): Promise<Response> {
  const username = checkUsername(body.username);
  const limited = await originRefusal(origin, "check");
  if (limited) return limited;
  await log(username ?? "", "check", true, origin);
  if (!username) return reply({ ok: true, state: "invalid" });
  if (!(await usernameIsClean(username))) return reply({ ok: true, state: "blocked" });
  return reply({ ok: true, state: (await userIdFor(username)) ? "taken" : "free" });
}

async function signIn(body: Json, origin: string): Promise<Response> {
  const username = checkUsername(body.username);
  if (!username || typeof body.password !== "string") return fail("wrong_details", 401);
  // the lock lifts on its own; a refused try is not logged, so it never
  // extends the lock
  const now = Date.now();
  const lockLifts = signInLockLiftsAt(
    await recentAttempts({ username, kinds: ["sign_in", "recover"] }, SIGN_IN_WINDOW_MIN),
    now,
  );
  if (lockLifts !== null) return wait("locked", lockLifts);
  const limited = await originRefusal(origin, "sign_in");
  if (limited) return limited;
  const userId = await userIdFor(username);
  const user = userId ? (await admin.auth.admin.getUserById(userId)).data.user : null;
  const session = user?.email ? await signInSession(user.email, body.password) : null;
  await log(username, "sign_in", Boolean(session), origin);
  // the same answer for an unknown username and a wrong password
  if (!session) return fail("wrong_details", 401);
  return reply({ ok: true, session, username });
}

async function recover(body: Json, origin: string): Promise<Response> {
  const username = checkUsername(body.username);
  const code = typeof body.code === "string" ? normaliseCode(body.code) : "";
  if (!username || code.length !== 12) return fail("wrong_code", 401);
  const pwErr = checkPassword(body.new_password);
  if (pwErr) return fail(pwErr);
  // no lock per username here: a sign in lock (even one set on purpose by
  // someone else) never stops the owner's saved code. Guessing is held back
  // per address, and a code is one of about 7.9e17.
  const limited = await originRefusal(origin, "recover");
  if (limited) return limited;
  if (((await timesLeaked(body.new_password as string)) ?? 0) > 0) return fail("password_leaked");
  const userId = await userIdFor(username);
  const { data: row } = userId
    ? await admin.from("account_recovery_codes").select("code_salt, code_hash").eq("user_id", userId).maybeSingle()
    : { data: null };
  const matches = row ? timingSafeEqual(await sha256Hex(`${row.code_salt}:${code}`), row.code_hash as string) : false;
  if (!userId || !matches) {
    await log(username, "recover", false, origin);
    return fail("wrong_code", 401);
  }
  const updated = await admin.auth.admin.updateUserById(userId, { password: body.new_password as string });
  if (updated.error || !updated.data.user?.email) return fail("recover_failed", 500);
  // single use: the old code dies here and a new one is shown once
  const fresh = await storeRecoveryCode(userId);
  await log(username, "recover", true, origin);
  const session = await signInSession(updated.data.user.email, body.new_password as string);
  if (!session) return fail("sign_in_failed", 500);
  return reply({ ok: true, session, recovery_code: fresh, username });
}

/**
 * Delete my account, last step. Only the caller's own account, read from the
 * caller's access token and never from the body; only a username account;
 * and only once forget_my_username has run, so the order is always
 * anonymise, forget, then this. The auth user goes outright (address,
 * password hash, identities, sessions); the emptied profile stays as the
 * anchor for append only money history.
 */
async function deleteAccount(req: Request): Promise<Response> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return fail("not_signed_in", 401);
  if (data.user.user_metadata?.account !== "username") return fail("not_username_account", 403);
  const held = await admin.from("account_usernames").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (held.error) throw held.error;
  if (held.data) return fail("forget_first", 409);
  const removed = await admin.auth.admin.deleteUser(data.user.id);
  if (removed.error) return fail("delete_failed", 500);
  return reply({ ok: true });
}

// The rider's browser calls this directly, so only Svika's own pages may.
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("SVIKA_ALLOWED_ORIGINS") ?? "https://svika-web.vercel.app,http://localhost:3000")
    .split(",")
    .map((o) => o.trim()),
);

function withCors(req: Request, res: Response): Response {
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return res;
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-headers", "authorization, apikey, content-type, x-client-info");
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("vary", "origin");
  return new Response(res.body, { status: res.status, headers });
}

Deno.serve(async (req) => withCors(req, await handle(req)));

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return fail("method", 405);
  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return fail("bad_request");
  }
  // the rate limit bucket comes from the address the platform saw, never
  // from the body; only its peppered hash is stored
  const origin = await originHash(clientAddress(req.headers), SERVICE);
  try {
    switch (body.action) {
      case "check_username":
        return await checkName(body, origin);
      case "sign_up":
        return await signUp(body, origin);
      case "sign_in":
        return await signIn(body, origin);
      case "recover":
        return await recover(body, origin);
      case "delete_account":
        return await deleteAccount(req);
      default:
        return fail("bad_request");
    }
  } catch {
    return fail("server_error", 500);
  }
}
