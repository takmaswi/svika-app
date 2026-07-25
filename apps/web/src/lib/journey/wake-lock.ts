// Keeps the screen awake while a recording runs (the M1 wake lock slice,
// ruled 2026-07-25): a sleeping screen suspends GPS delivery on real
// phones, so a real recording dies without this. The Screen Wake Lock API
// is the whole mechanism; a browser without it gets a clean no-op, never a
// crash, and the recorder itself never depends on the lock. The browser
// auto releases the lock whenever the tab hides, so a visibilitychange
// listener re-requests it on return while the recording is still live.

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
}

interface WakeLockNavigatorLike {
  wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
}

interface WakeLockDocumentLike {
  visibilityState: DocumentVisibilityState;
  addEventListener(type: "visibilitychange", fn: () => void): void;
  removeEventListener(type: "visibilitychange", fn: () => void): void;
}

export interface WakeLockDeps {
  nav?: WakeLockNavigatorLike;
  doc?: WakeLockDocumentLike;
  /** Fires with the held state after every request or release, for the UI. */
  onChange?: (held: boolean) => void;
}

export class RecordingWakeLock {
  private readonly nav: WakeLockNavigatorLike | undefined;
  private readonly doc: WakeLockDocumentLike | undefined;
  private readonly onChange: ((held: boolean) => void) | undefined;
  private sentinel: WakeLockSentinelLike | null = null;
  private active = false;
  private readonly onVisibility = () => {
    if (this.active && this.doc?.visibilityState === "visible") void this.request();
  };

  constructor(deps: WakeLockDeps = {}) {
    this.nav = deps.nav ?? (typeof navigator === "undefined" ? undefined : navigator);
    this.doc = deps.doc ?? (typeof document === "undefined" ? undefined : document);
    this.onChange = deps.onChange;
  }

  get supported(): boolean {
    return Boolean(this.nav?.wakeLock);
  }

  get held(): boolean {
    return this.sentinel !== null && !this.sentinel.released;
  }

  async acquire(): Promise<void> {
    if (this.active) return;
    this.active = true;
    if (!this.supported) return;
    this.doc?.addEventListener("visibilitychange", this.onVisibility);
    await this.request();
  }

  private async request(): Promise<void> {
    try {
      this.sentinel = await this.nav!.wakeLock!.request("screen");
    } catch {
      // low battery or a denying browser: the recording carries on, the
      // screen may sleep; that state is visible to the UI, never fatal
      this.sentinel = null;
    }
    this.onChange?.(this.held);
  }

  async release(): Promise<void> {
    this.active = false;
    this.doc?.removeEventListener("visibilitychange", this.onVisibility);
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch {
        // the browser already dropped it
      }
    }
    this.onChange?.(false);
  }
}
