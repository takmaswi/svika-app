// Launch Step 3: how a trip end travels in the plan URL, and the device
// only list of recent destinations. Pure, so the unit suite proves it.

/**
 * "My location" travels as "@lat,lng", rounded to three decimals (about
 * 110 m), so the exact spot never reaches the server or its logs. The walk
 * to the first stop is an estimate either way.
 */
export const LOCATION_DECIMALS = 3;

export function locationParam(lat: number, lng: number): string {
  const f = (n: number) => n.toFixed(LOCATION_DECIMALS);
  return `@${f(lat)},${f(lng)}`;
}

export function parseLocationParam(raw: string): { lat: number; lng: number } | null {
  const m = /^@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(raw.trim());
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return null;
  const round = (n: number) => Number(n.toFixed(LOCATION_DECIMALS));
  return { lat: round(lat), lng: round(lng) };
}

/** Recent destinations live on the phone only, newest first. */
export const RECENT_KEY = "svika_recent_to";
export const RECENT_MAX = 5;

export function pushRecent(list: readonly string[], name: string): string[] {
  const clean = name.trim();
  if (clean.length < 2 || clean.startsWith("@")) return [...list];
  const rest = list.filter((x) => x.toLowerCase() !== clean.toLowerCase());
  return [clean, ...rest].slice(0, RECENT_MAX);
}

export function readRecent(raw: string | null): string[] {
  try {
    const v: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

/** "Avon" + "Avondale Shops" as the bold typed part and the rest. */
export function splitMatch(name: string, typed: string): [string, string] {
  const q = typed.trim();
  return q && name.toLowerCase().startsWith(q.toLowerCase())
    ? [name.slice(0, q.length), name.slice(q.length)]
    : ["", name];
}
