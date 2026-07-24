// M1 gate evidence: battery and payload numbers for journey recording,
// computed by replaying Mhofu's REAL ride pings (2026-07-07 field data,
// assets/Takunda real kombi ride data) through the exact capture rules the
// recorder ships with. Real fix cadence, real accuracy values, real
// stillness at ranks; nothing synthetic.
//
// Battery is reported as GPS radio duty: the recorder NAPS after a still
// streak (watch released, one fix per still delay) and WATCHES while
// moving. Radio-on time = watching time + an assumed 3 s acquisition per
// nap fix. That is a duty cycle model, not a measured mAh figure, and the
// gate report says so.
//
// Constants are mirrored from packages/shared/src/journey-trace.ts and
// apps/web/src/lib/journey/policy.ts (source of truth); if those change,
// re-run and re-check this mirror.
//
// Usage: node scripts/journey-profile.mjs   (from apps/web)
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const dataRoot = join(repoRoot, "assets", "Takunda real kombi ride data");

// --- mirrored capture rules (journey-trace.ts / policy.ts) -----------------
const ACCURACY_REJECT_METERS = 50;
const STILL_SPEED_MPS = 0.5;
const MOVING_SPEED_MPS = 3.5;
const DELAY_STILL_MS = 20_000;
const DELAY_WALKING_MS = 6_000;
const DELAY_MOVING_MS = 3_000;
const MIN_MOVE_METERS = 8;
const HEARTBEAT_MS = 45_000;
const STILL_STREAK_TO_NAP = 3;
const SYNC_BATCH_SIZE = 200;
const NAP_FIX_ACQUIRE_MS = 3_000;

const EARTH_R = 6_371_000;
function haversine(aLng, aLat, bLng, bLat) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

function sampleDelayMs(speed) {
  if (speed < STILL_SPEED_MPS) return DELAY_STILL_MS;
  if (speed < MOVING_SPEED_MPS) return DELAY_WALKING_MS;
  return DELAY_MOVING_MS;
}

function loadPings(dir) {
  const folder = join(dataRoot, dir);
  const csv = readdirSync(folder).find((f) => f.endsWith(".pings.csv"));
  const lines = readFileSync(join(folder, csv), "utf8").trim().split("\n");
  const header = lines[0].split(",");
  const col = (name) => header.indexOf(name);
  const [iT, iLat, iLng, iAcc] = [
    col("recorded_at"),
    col("lat"),
    col("lng"),
    col("accuracy_m"),
  ];
  return lines.slice(1).map((line) => {
    const parts = line.split(",");
    return {
      t: Date.parse(parts[iT]),
      lat: Number(parts[iLat]),
      lng: Number(parts[iLng]),
      acc: Number(parts[iAcc]) || 0,
    };
  });
}

/** Replay a ping stream through the capture rules. */
function simulate(pings) {
  let lastAccepted = null;
  let nextSampleAt = 0;
  let phase = "watching";
  let stillStreak = 0;
  let watchingMs = 0;
  let napFixes = 0;
  let phaseSince = pings[0].t;
  const kept = [];

  for (const p of pings) {
    const speed = lastAccepted
      ? haversine(lastAccepted.lng, lastAccepted.lat, p.lng, p.lat) /
        Math.max((p.t - lastAccepted.t) / 1000, 0.001)
      : 0;
    const moved = lastAccepted
      ? haversine(lastAccepted.lng, lastAccepted.lat, p.lng, p.lat)
      : Infinity;

    if (phase === "napping") {
      // the radio sleeps; only the fix on each still-delay tick is seen
      if (p.t < nextSampleAt) continue;
      napFixes += 1;
      if (moved >= MIN_MOVE_METERS) {
        phase = "watching";
        stillStreak = 0;
        phaseSince = p.t;
      } else {
        nextSampleAt = p.t + DELAY_STILL_MS;
      }
    } else if (p.t < nextSampleAt) {
      continue;
    }

    const keep =
      p.acc <= ACCURACY_REJECT_METERS &&
      (!lastAccepted ||
        moved >= MIN_MOVE_METERS ||
        p.t - lastAccepted.t >= HEARTBEAT_MS);
    if (keep) {
      kept.push(p);
      lastAccepted = p;
    }
    nextSampleAt = p.t + sampleDelayMs(speed);

    if (phase === "watching") {
      if (speed < STILL_SPEED_MPS && moved < MIN_MOVE_METERS) {
        stillStreak += 1;
        if (stillStreak >= STILL_STREAK_TO_NAP) {
          watchingMs += p.t - phaseSince;
          phase = "napping";
          stillStreak = 0;
          phaseSince = p.t;
          nextSampleAt = p.t + DELAY_STILL_MS;
        }
      } else {
        stillStreak = 0;
      }
    }
  }
  const last = pings[pings.length - 1];
  if (phase === "watching") watchingMs += last.t - phaseSince;

  const payload = kept.map((p, seq) => ({
    seq,
    lat: p.lat,
    lng: p.lng,
    accuracy_m: p.acc,
    recorded_at: new Date(p.t).toISOString(),
  }));
  const bytes = JSON.stringify(payload).length;
  const totalMs = last.t - pings[0].t;
  const radioMs = watchingMs + napFixes * NAP_FIX_ACQUIRE_MS;
  return {
    minutes: totalMs / 60_000,
    offered: pings.length,
    kept: kept.length,
    bytes,
    batches: Math.ceil(kept.length / SYNC_BATCH_SIZE),
    radioDuty: Math.min(radioMs / totalMs, 1),
    napFixes,
  };
}

function report(label, pings) {
  const s = simulate(pings);
  const row = (k, v) => console.log(`  ${k.padEnd(34)} ${v}`);
  console.log(`\n${label} (${s.minutes.toFixed(1)} min of real ride)`);
  row("raw GPS fixes offered", s.offered);
  row("points kept by the capture rules", `${s.kept} (${((s.kept / s.offered) * 100).toFixed(0)}%)`);
  row("upload payload (JSON, uncompressed)", `${(s.bytes / 1024).toFixed(1)} KB in ${s.batches} batch(es)`);
  row("GPS radio duty cycle (modelled)", `${(s.radioDuty * 100).toFixed(0)}% on`);
  row("nap wake fixes while still", s.napFixes);
}

/** The first N minutes of a ping stream. */
function windowMinutes(pings, minutes) {
  const end = pings[0].t + minutes * 60_000;
  return pings.filter((p) => p.t <= end);
}

const inbound = loadPings("Mount Pleasant Heights to Rezende");
const returnRun = loadPings("Rezende to Mount Pleasant Heights");

report("Inbound run, full (walk + wait + detour-heavy ride)", inbound);
report("Inbound run, first 20 minutes", windowMinutes(inbound, 20));
report("Return run, full (clean ride)", returnRun);
report("Return run, first 20 minutes", windowMinutes(returnRun, 20));
