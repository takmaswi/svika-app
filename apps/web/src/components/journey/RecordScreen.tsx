"use client";

// The record my trip screen (batch M1). One primary action per state:
// start, then stop, then save. The live trace grows on the map in route
// ink under a recording chip (elapsed and distance, Plex Mono). The finish
// state is the named summary with save or discard, and the journey consent
// ask lives exactly at the save moment: agree uploads, decline keeps the
// trace on this phone (no consent, no upload, M1 law). Denied, insecure
// and unsupported GPS states are named cards, never silence.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { JOURNEY_CONSENT_VERSION, type AppLanguage } from "@svika/shared";
import { t } from "@/lib/dict";
import { createClient } from "@/lib/supabase/client";
import { JourneyRecorder, type RecorderSnapshot } from "@/lib/journey/recorder";
import { RecordingWakeLock } from "@/lib/journey/wake-lock";
import { syncJourney } from "@/lib/journey/sync";
import {
  deleteJourney,
  getActiveJourneyId,
  getJourney,
  listPoints,
  putJourney,
  setActiveJourneyId,
  type LocalJourneyMode,
} from "@/lib/journey/store";
import { TraceMapLazy } from "@/components/map/TraceMapLazy";
import { BackIcon } from "@/components/icons";

interface RecordScreenProps {
  lang: AppLanguage;
  initialMode: LocalJourneyMode;
  /** True when the rider already holds an accepted journey consent. */
  hasConsent: boolean;
  /** Compressed delays for tests and screen recordings (?gps=replay). */
  replay: boolean;
}

type Screen = "idle" | "recording" | "finish";

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function RecordScreen({ lang, initialMode, hasConsent, replay }: RecordScreenProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const recorder = useMemo(() => new JourneyRecorder({ replay }), [replay]);
  const [snap, setSnap] = useState<RecorderSnapshot | null>(null);
  const [screen, setScreen] = useState<Screen>("idle");
  const [mode, setMode] = useState<LocalJourneyMode>(initialMode);
  const [trace, setTrace] = useState<[number, number][]>([]);
  const [name, setName] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [consented, setConsented] = useState(hasConsent);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [wakeHeld, setWakeHeld] = useState(false);
  const endedAtRef = useRef<number | null>(null);

  // recorder -> UI: snapshots carry counts; the trace grows point by point
  useEffect(() => {
    return recorder.subscribe((s) => {
      setSnap(s);
      if (s.lastPoint) {
        const coord: [number, number] = [s.lastPoint.lng, s.lastPoint.lat];
        setTrace((prev) => {
          const tail = prev[prev.length - 1];
          if (tail && tail[0] === coord[0] && tail[1] === coord[1]) return prev;
          return [...prev, coord];
        });
      }
    });
  }, [recorder]);
  useEffect(() => () => recorder.dispose(), [recorder]);

  // a reload mid recording resumes instead of losing the trip
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await getActiveJourneyId();
      if (!active || cancelled) return;
      const journey = await getJourney(active);
      if (!journey || journey.status !== "recording") return;
      const points = await listPoints(active);
      if (cancelled) return;
      setTrace(points.map((p) => [p.lng, p.lat]));
      setMode(journey.mode);
      const resumed = await recorder.resume(active);
      if (resumed && !cancelled) setScreen("recording");
    })();
    return () => {
      cancelled = true;
    };
  }, [recorder]);

  // the screen stays awake while recording: a sleeping screen kills GPS.
  // Held for the recording state only, released the moment it leaves;
  // browsers without the API record exactly as before, screen may sleep.
  useEffect(() => {
    if (screen !== "recording") return;
    const lock = new RecordingWakeLock({ onChange: setWakeHeld });
    void lock.acquire();
    return () => void lock.release();
  }, [screen]);

  // the chip clock
  useEffect(() => {
    if (screen !== "recording") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [screen]);

  // consented recordings stream to the server in batches while riding
  useEffect(() => {
    if (screen !== "recording" || !consented || !snap?.journeyId) return;
    const journeyId = snap.journeyId;
    const id = setInterval(() => void syncJourney(supabase, journeyId), replay ? 2000 : 20_000);
    return () => clearInterval(id);
  }, [screen, consented, snap?.journeyId, supabase, replay]);

  const start = async () => {
    setTrace([]);
    endedAtRef.current = null;
    await recorder.start(mode);
    setScreen("recording");
  };

  const stop = async () => {
    await recorder.stop();
    endedAtRef.current = Date.now();
    setScreen("finish");
  };

  const finishSave = async (choice: "upload" | "agree" | "local") => {
    const journeyId = snap?.journeyId;
    if (!journeyId || busy) return;
    setBusy(true);
    const journey = await getJourney(journeyId);
    if (!journey) return;
    await putJourney({
      ...journey,
      status: "complete",
      name: name.trim() || undefined,
      mode,
      endedAt: journey.endedAt ?? endedAtRef.current ?? Date.now(),
    });
    let saved = "local";
    if (choice === "agree") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("consent_records").insert({
          user_id: user.id,
          action: "accepted",
          version: JOURNEY_CONSENT_VERSION,
        });
        setConsented(true);
      }
    }
    if (choice !== "local") {
      const outcome = await syncJourney(supabase, journeyId);
      saved = outcome.ok ? "1" : "local";
    }
    await setActiveJourneyId(null);
    router.push(`/app/journeys/${journeyId}?saved=${saved}`);
  };

  const save = () => {
    if (consented) void finishSave("upload");
    else setConsentOpen(true);
  };

  const discard = async () => {
    const journeyId = snap?.journeyId;
    if (!journeyId || busy) return;
    setBusy(true);
    const journey = await getJourney(journeyId);
    if (journey) {
      if (journey.serverKnown) {
        await putJourney({
          ...journey,
          status: "discarded",
          endedAt: journey.endedAt ?? Date.now(),
        });
        await syncJourney(supabase, journeyId);
      } else {
        await deleteJourney(journeyId);
      }
    }
    await setActiveJourneyId(null);
    router.push("/app");
  };

  const status = snap?.status ?? "idle";
  const blockedKey =
    status === "denied"
      ? "journey.deniedB"
      : status === "insecure"
        ? "journey.insecureB"
        : status === "unsupported"
          ? "journey.unsupportedB"
          : null;

  // GPS failed or is missing: a named state with one way forward
  if (blockedKey) {
    return (
      <main className="shell" data-testid="record-screen" data-state={status}>
        <header className="screen-head">
          <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
            <BackIcon />
          </Link>
          <h1 className="svika-headline">{t(lang, "journey.recordTitle")}</h1>
        </header>
        <section className="svika-card wallet-panel svika-animate-fade-up">
          <h2 className="svika-title">{t(lang, "journey.deniedH")}</h2>
          <p className="svika-body" data-testid="record-blocked">
            {t(lang, blockedKey)}
          </p>
          {status === "denied" && (
            <button className="auth-submit touch-target" type="button" onClick={start}>
              {t(lang, "journey.retry")}
            </button>
          )}
        </section>
      </main>
    );
  }

  if (screen === "recording") {
    const startedAt = snap?.startedAt ?? now;
    return (
      <main
        className="home-screen"
        data-testid="record-screen"
        data-state="recording"
        data-wake={wakeHeld ? "held" : "off"}
      >
        <div className="home-map">
          <TraceMapLazy
            labels={{
              ariaLabel: t(lang, "map.ariaLabel"),
              unavailable: t(lang, "map.unavailable"),
            }}
            trace={trace}
            position={snap?.lastPoint ? [snap.lastPoint.lng, snap.lastPoint.lat] : null}
            camera="follow"
          />
        </div>
        <header className="plan-back-row">
          <span className="record-pill svika-glass" data-testid="record-chip">
            <span className="svika-live-dot">
              <span className="svika-ripple-ring" aria-hidden />
              <span className="svika-pulse-dot" aria-hidden />
            </span>
            {t(lang, "journey.rec")}
            <span className="svika-mono-code" data-testid="record-elapsed">
              {formatElapsed(now - startedAt)}
            </span>
            <span className="svika-mono-code" data-testid="record-distance">
              {formatDistance(snap?.distanceM ?? 0)}
            </span>
          </span>
        </header>
        <div className="record-actions">
          <button
            className="auth-submit touch-target"
            type="button"
            onClick={() => void stop()}
            data-testid="record-stop"
          >
            {t(lang, "journey.stop")}
          </button>
        </div>
      </main>
    );
  }

  if (screen === "finish") {
    const startedAt = snap?.startedAt ?? 0;
    const endedAt = endedAtRef.current ?? Date.now();
    return (
      <main className="shell" data-testid="record-screen" data-state="finish">
        <header className="screen-head">
          <h1 className="svika-headline">{t(lang, "journey.finishTitle")}</h1>
        </header>
        {consentOpen ? (
          <section
            className="svika-card wallet-panel svika-animate-fade-up"
            data-testid="journey-consent"
          >
            <h2 className="svika-title">{t(lang, "journey.consentH")}</h2>
            <p className="svika-body">{t(lang, "journey.consentB")}</p>
            <button
              className="auth-submit touch-target"
              type="button"
              disabled={busy}
              onClick={() => void finishSave("agree")}
              data-testid="journey-consent-agree"
            >
              {t(lang, "journey.consentAgree")}
            </button>
            <button
              className="auth-link touch-target"
              type="button"
              disabled={busy}
              onClick={() => void finishSave("local")}
              data-testid="journey-consent-local"
            >
              {t(lang, "journey.consentLocal")}
            </button>
          </section>
        ) : (
          <section className="svika-card wallet-panel svika-animate-fade-up">
            <dl className="record-summary">
              <div className="record-summary-row">
                <dt className="svika-meta">{t(lang, "journey.distance")}</dt>
                <dd className="svika-mono-code" data-testid="finish-distance">
                  {formatDistance(snap?.distanceM ?? 0)}
                </dd>
              </div>
              <div className="record-summary-row">
                <dt className="svika-meta">{t(lang, "journey.duration")}</dt>
                <dd className="svika-mono-code">{formatElapsed(endedAt - startedAt)}</dd>
              </div>
              <div className="record-summary-row">
                <dt className="svika-meta">{t(lang, "journey.points")}</dt>
                <dd className="svika-mono-code" data-testid="finish-points">
                  {snap?.pointCount ?? 0}
                </dd>
              </div>
            </dl>
            <label className="svika-meta" htmlFor="journey-name">
              {t(lang, "journey.nameLabel")}
            </label>
            <input
              id="journey-name"
              className="auth-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(lang, "journey.namePh")}
              maxLength={80}
              autoComplete="off"
              data-testid="journey-name"
            />
            <button
              className="auth-submit touch-target"
              type="button"
              disabled={busy}
              onClick={save}
              data-testid="journey-save"
            >
              {t(lang, "journey.save")}
            </button>
            <button
              className="auth-link touch-target"
              type="button"
              disabled={busy}
              onClick={() => void discard()}
              data-testid="journey-discard"
            >
              {t(lang, "journey.discard")}
            </button>
          </section>
        )}
      </main>
    );
  }

  // idle: pick the mode, one action starts
  return (
    <main className="shell" data-testid="record-screen" data-state="idle">
      <header className="screen-head">
        <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "journey.recordTitle")}</h1>
      </header>
      <section className="svika-card wallet-panel svika-animate-fade-up">
        <div className="record-mode-row" role="radiogroup" aria-label={t(lang, "journey.recordTitle")}>
          {(["walk", "kombi"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={`record-mode-chip touch-target${mode === m ? " record-mode-chip-on" : ""}`}
              onClick={() => setMode(m)}
              data-testid={`record-mode-${m}`}
            >
              {t(lang, m === "walk" ? "journey.mode.walk" : "journey.mode.kombi")}
            </button>
          ))}
        </div>
        <button
          className="auth-submit touch-target"
          type="button"
          onClick={() => void start()}
          data-testid="record-start"
        >
          {t(lang, "journey.start")}
        </button>
      </section>
    </main>
  );
}
