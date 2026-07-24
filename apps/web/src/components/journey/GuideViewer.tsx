"use client";

// The guide viewer (batch M2): a friend opens a shared trip with no
// account and follows it. Walking directions v1 are trace replay, not
// routing: the recorded points ARE the directions, shortcuts included.
// The viewer sees the trace in route ink, their own live dot once they
// allow location, and cues computed CLIENT SIDE from distance to the
// polyline (@svika/shared trace-guide: off path with hysteresis,
// approaching, arrived). Steps are derived geometrically from turns and
// mode changes; the screen says plainly that none of this is AI. Voice:
// the approaching cue plays from the pre generated cached library, the
// only phrase that fits it; no new vendor calls, ever.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  deriveSteps,
  guideCue,
  type AppLanguage,
  type GuideCue,
  type GuidePoint,
  type GuideStep,
} from "@svika/shared";
import { t, type DictKey } from "@/lib/dict";
import { VoiceAudioCache } from "@/lib/voice/audio-cache";
import { TraceMap } from "@/components/map/TraceMap";

export interface GuideViewerProps {
  lang: AppLanguage;
  name: string | null;
  /** The mode the sharer declared when saving the trip. */
  mode: "kombi" | "walk" | "mixed";
  distanceM: number;
  /** [lng, lat, offset_ms] rows from journey_share_view. */
  points: [number, number, number][];
}

function stepKey(step: GuideStep, index: number): DictKey {
  if (index === 0) {
    return step.mode === "ride" ? "guide.step.startRide" : "guide.step.startWalk";
  }
  if (step.turn === "left") return "guide.step.left";
  if (step.turn === "right") return "guide.step.right";
  return step.mode === "ride" ? "guide.step.ride" : "guide.step.walk";
}

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function GuideViewer({ lang, name, mode, distanceM, points }: GuideViewerProps) {
  const trace = useMemo<[number, number][]>(
    () => points.map((p) => [p[0], p[1]]),
    [points],
  );
  const guidePoints = useMemo<GuidePoint[]>(
    () => points.map((p) => ({ lng: p[0], lat: p[1], recordedAt: p[2] })),
    [points],
  );
  // the sharer declared what this trip was: a walk stays a walk and a
  // kombi ride stays a ride; only a mixed trip lets segment speed decide
  const steps = useMemo(() => {
    const derived = deriveSteps(guidePoints);
    if (mode === "mixed") return derived;
    const declared = mode === "kombi" ? ("ride" as const) : ("walk" as const);
    return derived.map((s) => ({ ...s, mode: declared }));
  }, [guidePoints, mode]);

  const [position, setPosition] = useState<[number, number] | null>(null);
  const [cue, setCue] = useState<GuideCue>("on-path");
  const [locating, setLocating] = useState<"idle" | "on" | "denied">("idle");
  const cueRef = useRef<GuideCue>("on-path");
  const watchRef = useRef<number | null>(null);
  const voiceRef = useRef<VoiceAudioCache | null>(null);

  useEffect(
    () => () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    },
    [],
  );

  const locate = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocating("denied");
      return;
    }
    // the cached voice library loads now, once; play time never fetches
    if (!voiceRef.current) {
      voiceRef.current = new VoiceAudioCache();
      void voiceRef.current.preload(lang);
    }
    setLocating("on");
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const here: GuidePoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setPosition([here.lng, here.lat]);
        const next = guideCue(guidePoints, here, cueRef.current);
        if (next !== cueRef.current) {
          cueRef.current = next;
          setCue(next);
          if (next === "approaching") {
            const src = voiceRef.current?.src("approaching");
            if (src) void new Audio(src).play().catch(() => {});
          }
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocating("denied");
          if (watchRef.current !== null) {
            navigator.geolocation.clearWatch(watchRef.current);
            watchRef.current = null;
          }
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
  };

  return (
    <div data-testid="guide-view">
      <div className="journey-map svika-animate-fade-up">
        <TraceMap
          labels={{
            ariaLabel: t(lang, "map.ariaLabel"),
            unavailable: t(lang, "map.unavailable"),
          }}
          trace={trace}
          position={position}
          camera={position ? "follow" : "fit"}
          testId="guide-trace-map"
        />
      </div>

      <p
        className={`guide-cue${cue === "off-path" ? " guide-cue-warn" : ""}`}
        data-testid="guide-cue"
        data-cue={cue}
        aria-live="polite"
        hidden={cue === "on-path"}
      >
        {cue === "on-path" ? "" : t(lang, `guide.cue.${cue}` as DictKey)}
      </p>

      {locating === "idle" && (
        <button
          className="auth-submit touch-target"
          type="button"
          onClick={locate}
          data-testid="guide-locate"
        >
          {t(lang, "guide.locate")}
        </button>
      )}
      {locating === "denied" && (
        <p className="svika-body journey-local-note" data-testid="guide-denied">
          {t(lang, "guide.denied")}
        </p>
      )}

      <section className="svika-card wallet-panel svika-animate-fade-up svika-rise-2">
        <div className="guide-head">
          <h2 className="svika-title" data-testid="guide-name">
            {name ?? t(lang, "guide.sharedTrip")}
          </h2>
          <span className="svika-mono-code">{formatDistance(distanceM)}</span>
        </div>
        <p className="svika-body">{t(lang, "guide.intro")}</p>
        <h3 className="svika-meta guide-steps-h">{t(lang, "guide.stepsH")}</h3>
        <ol className="guide-steps" data-testid="guide-steps">
          {steps.map((step, i) => (
            <li key={i} className="guide-step svika-body">
              {t(lang, stepKey(step, i)).replace("{m}", String(step.meters))}
            </li>
          ))}
        </ol>
        <p className="svika-meta guide-not-ai" data-testid="guide-not-ai">
          {t(lang, "guide.notAi")}
        </p>
      </section>
    </div>
  );
}
