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
  closeLegs,
  currentLegIndex,
  currentLegMode,
  openingLeg,
  transitionLegs,
  type BoardDetails,
  type LegMode,
  type LocalLeg,
} from "./legs";
import {
  addMark,
  addPoint,
  getJourney,
  listLegs,
  listMarks,
  listPoints,
  putJourney,
  putLegs,
  setActiveJourneyId,
  type LocalJourney,
  type LocalJourneyMode,
  type LocalMark,
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
  /** The trip's shape so far: walk, wait, ride, walk (batch Partner). */
  legs: LocalLeg[];
  /** What the rider is doing right now, per the legs they tagged. */
  legMode: LegMode;
  /** Marked stops dropped so far; also the next mark's seq. */
  markCount: number;
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
    legs: [],
    legMode: "walking",
    markCount: 0,
  };
  private listeners = new Set<Listener>();
  private watchId: number | null = null;
  private napTimer: ReturnType<typeof setTimeout> | null = null;
  private phaseState: PhaseState = { phase: "watching", stillStreak: 0 };
  private lastAccepted: TracePoint | null = null;
  private nextSampleAt = 0;
  private seq = 0;
  private markSeq = 0;
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
    const legs = [openingLeg(journey.id, journey.startedAt)];
    await putJourney(journey);
    await putLegs(legs);
    await setActiveJourneyId(journey.id);
    this.seq = 0;
    this.markSeq = 0;
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
      legs,
      legMode: "walking",
      markCount: 0,
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
    // max+1, never a count: a count reuses a seq the moment one write ever
    // failed, and the duplicate lands silently (the field logger's bug)
    this.seq = last ? last.seq + 1 : 0;
    this.lastAccepted = last
      ? {
          lat: last.lat,
          lng: last.lng,
          accuracyM: last.accuracyM,
          recordedAt: last.recordedAt,
        }
      : null;
    const marks = await listMarks(journey.id);
    const lastMark = marks[marks.length - 1];
    this.markSeq = lastMark ? lastMark.markSeq + 1 : 0;
    // the open leg comes back by index; a journey with no legs stored (a
    // recording started before this batch) gets a fresh opening leg rather
    // than a guess about which leg the rider was on
    const stored = await listLegs(journey.id);
    const legs = stored.length > 0 ? stored : [openingLeg(journey.id, journey.startedAt)];
    if (stored.length === 0) await putLegs(legs);
    this.phaseState = { phase: "watching", stillStreak: 0 };
    this.emit({
      status: "recording",
      journeyId: journey.id,
      mode: journey.mode,
      startedAt: journey.startedAt,
      distanceM: journey.distanceM,
      pointCount: journey.pointCount,
      lastPoint: this.lastAccepted,
      legs,
      legMode: currentLegMode(legs),
      markCount: marks.length,
    });
    this.beginWatch();
    return true;
  }

  /**
   * Board a kombi: close the leg you are on and open a riding one carrying
   * the route as a person says it, the direction, and what you paid.
   */
  async board(details: BoardDetails): Promise<void> {
    await this.transition("riding", details);
  }

  /** Get off: back to walking, which may lead to another kombi. */
  async alight(): Promise<void> {
    await this.transition("walking");
  }

  /** Standing at the road waiting; the wait is a leg of its own. */
  async wait(): Promise<void> {
    await this.transition("waiting");
  }

  private async transition(mode: LegMode, details?: BoardDetails): Promise<void> {
    if (this.snapshot.status !== "recording") return;
    const legs = transitionLegs(this.snapshot.legs, Date.now(), mode, details);
    await putLegs(legs);
    this.emit({ legs, legMode: currentLegMode(legs) });
  }

  /**
   * Drop a marked stop where you are. Uses the last accepted fix, so the
   * caller must not offer the control before one exists; `recordedAt` is
   * that fix's time and `markedAt` is now, because the gap between them is
   * how far behind the mark may be, and merging the two hides that.
   */
  async mark(
    kind: LocalMark["kind"],
    name: string | null,
  ): Promise<LocalMark | null> {
    const journeyId = this.snapshot.journeyId;
    const fix = this.lastAccepted;
    if (!journeyId || !fix || this.snapshot.status !== "recording") return null;
    const mark: LocalMark = {
      journeyId,
      markSeq: this.markSeq,
      legIndex: currentLegIndex(this.snapshot.legs),
      kind,
      name: name?.trim() ? name.trim() : null,
      lat: fix.lat,
      lng: fix.lng,
      accuracyM: fix.accuracyM,
      recordedAt: fix.recordedAt,
      markedAt: Date.now(),
    };
    await addMark(mark);
    this.markSeq += 1;
    this.emit({ markCount: this.markSeq });
    return mark;
  }

  /** Stop capturing; the journey stays "recording" until saved or discarded. */
  async stop(): Promise<void> {
    this.releaseSensors();
    const id = this.snapshot.journeyId;
    const endedAt = Date.now();
    if (id) {
      const journey = await getJourney(id);
      if (journey && journey.status === "recording") {
        await putJourney({ ...journey, endedAt });
      }
      // the leg you were on ends when the recording does
      const legs = closeLegs(this.snapshot.legs, endedAt);
      await putLegs(legs);
      this.emit({ status: "stopped", legs });
      return;
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
        // stamped at capture, never joined by wall clock afterwards: a leg
        // boundary is the system clock and a fix is the GPS clock, and the
        // two drift
        legIndex: currentLegIndex(this.snapshot.legs),
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
