// The journey recorder: navigator.geolocation in front, the shared capture
// rules (@svika/shared journey-trace) deciding what earns a place in the
// trace, IndexedDB behind so a crash or reload never loses a point.
//
// Battery: two phases (lib/journey/policy.ts). WATCHING holds a high
// accuracy watch and gates fixes by the adaptive sampling delay; after a
// streak of still fixes the recorder NAPS, releasing the watch so the GPS
// radio sleeps, and takes one fix per still delay until movement wakes it.
//
// GPS silently fails on plain HTTP (the field gotcha): the recorder names
// that state instead of spinning, and names permission denied too.
import {
  DELAY_STILL_MS,
  haversineMeters,
  sampleDelayMs,
  shouldKeepPoint,
  speedMps,
  TELEPORT_SPEED_MPS,
  type TracePoint,
} from "@svika/shared";
import { nextPhase, type PhaseState } from "./policy";
import {
  addPoint,
  getJourney,
  listPoints,
  putJourney,
  setActiveJourneyId,
  type LocalJourney,
  type LocalJourneyMode,
} from "./store";

export type RecorderStatus =
  | "idle"
  | "recording"
  | "stopped"
  | "denied"
  | "insecure"
  | "unsupported";

export interface RecorderSnapshot {
  status: RecorderStatus;
  journeyId: string | null;
  mode: LocalJourneyMode;
  /** Epoch ms; elapsed time is computed from it by the UI clock. */
  startedAt: number | null;
  distanceM: number;
  pointCount: number;
  lastPoint: TracePoint | null;
}

type Listener = (s: RecorderSnapshot) => void;

/** Replay compression for tests and recordings: same rules, tiny delays. */
const REPLAY_SAMPLE_MS = 50;
const REPLAY_NAP_MS = 300;

export class JourneyRecorder {
  private snapshot: RecorderSnapshot = {
    status: "idle",
    journeyId: null,
    mode: "walk",
    startedAt: null,
    distanceM: 0,
    pointCount: 0,
    lastPoint: null,
  };
  private listeners = new Set<Listener>();
  private watchId: number | null = null;
  private napTimer: ReturnType<typeof setTimeout> | null = null;
  private phaseState: PhaseState = { phase: "watching", stillStreak: 0 };
  private lastAccepted: TracePoint | null = null;
  private nextSampleAt = 0;
  private seq = 0;
  private readonly replay: boolean;

  constructor(opts?: { replay?: boolean }) {
    this.replay = opts?.replay ?? false;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot);
    return () => this.listeners.delete(fn);
  }

  private emit(patch: Partial<RecorderSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn(this.snapshot);
  }

  private unsupportedReason(): RecorderStatus | null {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return "unsupported";
    }
    // GPS fails silently on plain HTTP; name it instead of spinning
    if (!window.isSecureContext) return "insecure";
    return null;
  }

  async start(mode: LocalJourneyMode): Promise<void> {
    const blocked = this.unsupportedReason();
    if (blocked) {
      this.emit({ status: blocked });
      return;
    }
    const journey: LocalJourney = {
      id: crypto.randomUUID(),
      mode,
      status: "recording",
      startedAt: Date.now(),
      distanceM: 0,
      pointCount: 0,
      syncedThrough: -1,
      serverKnown: false,
      statusSynced: false,
      conflict: false,
    };
    await putJourney(journey);
    await setActiveJourneyId(journey.id);
    this.seq = 0;
    this.lastAccepted = null;
    this.phaseState = { phase: "watching", stillStreak: 0 };
    this.emit({
      status: "recording",
      journeyId: journey.id,
      mode,
      startedAt: journey.startedAt,
      distanceM: 0,
      pointCount: 0,
      lastPoint: null,
    });
    this.beginWatch();
  }

  /** Re-attach to an interrupted recording after a reload. */
  async resume(journeyId: string): Promise<boolean> {
    const blocked = this.unsupportedReason();
    if (blocked) {
      this.emit({ status: blocked });
      return false;
    }
    const journey = await getJourney(journeyId);
    if (!journey || journey.status !== "recording") return false;
    const points = await listPoints(journey.id);
    const last = points[points.length - 1];
    this.seq = last ? last.seq + 1 : 0;
    this.lastAccepted = last
      ? {
          lat: last.lat,
          lng: last.lng,
          accuracyM: last.accuracyM,
          recordedAt: last.recordedAt,
        }
      : null;
    this.phaseState = { phase: "watching", stillStreak: 0 };
    this.emit({
      status: "recording",
      journeyId: journey.id,
      mode: journey.mode,
      startedAt: journey.startedAt,
      distanceM: journey.distanceM,
      pointCount: journey.pointCount,
      lastPoint: this.lastAccepted,
    });
    this.beginWatch();
    return true;
  }

  /** Stop capturing; the journey stays "recording" until saved or discarded. */
  async stop(): Promise<void> {
    this.releaseSensors();
    const id = this.snapshot.journeyId;
    if (id) {
      const journey = await getJourney(id);
      if (journey && journey.status === "recording") {
        await putJourney({ ...journey, endedAt: Date.now() });
      }
    }
    this.emit({ status: "stopped" });
  }

  dispose(): void {
    this.releaseSensors();
    this.listeners.clear();
  }

  private releaseSensors() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.napTimer !== null) {
      clearTimeout(this.napTimer);
      this.napTimer = null;
    }
  }

  private beginWatch() {
    if (this.watchId !== null) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => void this.onFix(pos),
      (err) => this.onError(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
  }

  private napDelay(): number {
    return this.replay ? REPLAY_NAP_MS : DELAY_STILL_MS;
  }

  private scheduleNap() {
    this.napTimer = setTimeout(() => {
      this.napTimer = null;
      navigator.geolocation.getCurrentPosition(
        (pos) => void this.onFix(pos),
        (err) => this.onError(err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
      );
    }, this.napDelay());
  }

  private onError(err: GeolocationPositionError) {
    if (err.code === err.PERMISSION_DENIED) {
      this.releaseSensors();
      this.emit({ status: "denied" });
      return;
    }
    // a timeout or transient unavailability: keep listening; while napping,
    // try again next cycle
    if (this.watchId === null && this.snapshot.status === "recording") {
      this.scheduleNap();
    }
  }

  private async onFix(pos: GeolocationPosition): Promise<void> {
    if (this.snapshot.status !== "recording") return;
    const candidate: TracePoint = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracyM: pos.coords.accuracy,
      recordedAt: pos.timestamp || Date.now(),
    };
    const prev = this.lastAccepted;
    const speed = prev ? speedMps(prev, candidate) : 0;
    const movedM = prev
      ? haversineMeters(prev.lng, prev.lat, candidate.lng, candidate.lat)
      : 0;

    const napping = this.watchId === null;
    if (!napping && candidate.recordedAt < this.nextSampleAt) return;

    const kept = shouldKeepPoint(prev, candidate);
    if (kept) {
      const journeyId = this.snapshot.journeyId!;
      await addPoint({
        journeyId,
        seq: this.seq,
        lat: candidate.lat,
        lng: candidate.lng,
        accuracyM: candidate.accuracyM,
        recordedAt: candidate.recordedAt,
      });
      this.seq += 1;
      const hopSeconds = prev ? (candidate.recordedAt - prev.recordedAt) / 1000 : 0;
      // replay compresses the clock, so every hop would read as a teleport
      const teleport =
        !this.replay && hopSeconds > 0 && movedM / hopSeconds > TELEPORT_SPEED_MPS;
      const distanceM = this.snapshot.distanceM + (prev && !teleport ? movedM : 0);
      this.lastAccepted = candidate;
      const journey = await getJourney(journeyId);
      if (journey) {
        await putJourney({ ...journey, distanceM, pointCount: this.seq });
      }
      this.emit({
        distanceM,
        pointCount: this.seq,
        lastPoint: candidate,
      });
    }

    this.nextSampleAt =
      candidate.recordedAt + (this.replay ? REPLAY_SAMPLE_MS : sampleDelayMs(speed));

    const before = this.phaseState.phase;
    this.phaseState = nextPhase(this.phaseState, { speedMps: speed, movedM });
    if (before === "watching" && this.phaseState.phase === "napping") {
      // release the radio; one fix per still delay from here
      if (this.watchId !== null) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
      this.scheduleNap();
    } else if (before === "napping" && this.phaseState.phase === "watching") {
      this.beginWatch();
    } else if (napping && this.phaseState.phase === "napping") {
      this.scheduleNap();
    }
  }
}
