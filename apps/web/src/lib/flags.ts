// Launch flags (docs/LAUNCH-CROWD-PLAN.md). Every launch step ships behind
// its own flag so main stays deployable after every commit; Step 12 turns
// them all on in production through SVIKA_FLAGS.
//
// Three sources, resolved per request:
// - SVIKA_FLAGS (server env, comma separated) is the deploy's own set.
// - The preview cookie, when it carries SVIKA_PREVIEW_TOKEN, turns every
//   launch flag on for that one browser. This is how a step is checked on
//   the live site before the public switch flips.
// - The pitch cookie, when it carries SVIKA_PITCH_TOKEN, turns every launch
//   flag OFF for that browser: the full simulated vision, reachable only on
//   the private /pitch door (ruling 3), never linked anywhere.
//
// Pure module: no next/headers import, so middleware can use it too.

export const LAUNCH_FLAGS = [
  /** Step 0: the launch profile. Hides paid and operator routes (ruling 14)
   *  and every surface that shows simulated or generated data (ruling 3). */
  "launch",
  "ui_v2",
  "accounts",
  "front_door",
  "ranks",
  "fix_it",
  "trip",
  "personal_home",
  "directions",
  "ai_router",
  "weekly_reward",
  "growth",
] as const;

export type LaunchFlag = (typeof LAUNCH_FLAGS)[number];
export type FlagSet = ReadonlySet<LaunchFlag>;

export const PREVIEW_COOKIE = "svika_preview";
export const PITCH_COOKIE = "svika_pitch";

/**
 * A door token shorter than this is refused outright, so an empty or lazy
 * env value can never open a door. The live tokens are 48 random hex
 * characters (192 bits).
 */
export const MIN_TOKEN_LENGTH = 24;

/** Length safe comparison so a token is not leaked one character at a time. */
export function tokenMatches(given: string | undefined, expected: string | undefined): boolean {
  if (!given || !expected || expected.length < MIN_TOKEN_LENGTH) return false;
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function isLaunchFlag(value: string): value is LaunchFlag {
  return (LAUNCH_FLAGS as readonly string[]).includes(value);
}

/** Parse SVIKA_FLAGS. "all" turns every launch flag on. Unknown names are ignored. */
export function parseFlagList(raw: string | undefined): Set<LaunchFlag> {
  const out = new Set<LaunchFlag>();
  for (const part of (raw ?? "").split(",")) {
    const name = part.trim();
    if (name === "all") return new Set(LAUNCH_FLAGS);
    if (isLaunchFlag(name)) out.add(name);
  }
  return out;
}

export interface FlagInputs {
  envFlags: string | undefined;
  previewToken: string | undefined;
  pitchToken: string | undefined;
  previewCookie: string | undefined;
  pitchCookie: string | undefined;
}

export interface ResolvedFlags {
  flags: FlagSet;
  /** True in the private pitch browser: the simulated vision is allowed. */
  pitch: boolean;
  preview: boolean;
}

export function resolveFlags(input: FlagInputs): ResolvedFlags {
  if (tokenMatches(input.pitchCookie, input.pitchToken)) {
    return { flags: new Set(), pitch: true, preview: false };
  }
  if (tokenMatches(input.previewCookie, input.previewToken)) {
    return { flags: new Set(LAUNCH_FLAGS), pitch: false, preview: true };
  }
  return { flags: parseFlagList(input.envFlags), pitch: false, preview: false };
}

/** Read the inputs from the process env plus a cookie getter. */
export function flagsFrom(getCookie: (name: string) => string | undefined): ResolvedFlags {
  return resolveFlags({
    envFlags: process.env.SVIKA_FLAGS,
    previewToken: process.env.SVIKA_PREVIEW_TOKEN,
    pitchToken: process.env.SVIKA_PITCH_TOKEN,
    previewCookie: getCookie(PREVIEW_COOKIE),
    pitchCookie: getCookie(PITCH_COOKIE),
  });
}

/**
 * Ruling 14: paid and operator features are hidden, not deleted. Under the
 * launch profile these paths answer not found (not merely unlinked); the
 * code, migrations and tests stay and CI keeps running them.
 */
export const HIDDEN_PREFIXES = [
  "/app/kombis",
  "/app/ticket",
  "/app/wallet",
  "/app/gift",
  "/app/owner",
  "/app/intelligence",
  "/app/parcel",
] as const;

export function isHiddenPath(pathname: string): boolean {
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
