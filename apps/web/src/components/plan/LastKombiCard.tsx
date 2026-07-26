"use client";

// The last kombi warning (batch V7). Marigold on char, the same attention
// grammar the guide cue uses (deviation 12): information a rider must act on,
// never an alarm and never a promise. Every line says "usually".
//
// The cue is spoken only when the rider taps listen. Audio is fetched once
// through CachedPhrase and played from memory afterwards, so a tap in a dead
// zone still speaks. A missing recording just mutes the button.
import { useCallback, useEffect, useRef, useState } from "react";
import { CachedPhrase } from "@/lib/voice/audio-cache";

export interface LastKombiStrings {
  /** "Last kombi on {route}" */
  title: string;
  /** "Usually gone by {time}" */
  usually: string;
  /** "About {minutes} minutes left" */
  left: string;
  /** "The last kombi has usually gone by now" */
  past: string;
  /** "This one varies a lot: some nights an hour either way" */
  wide: string;
  /** "Counted from {days} evenings on this route" */
  basis: string;
  /** the synthetic disclosure line, empty when the history is all real */
  synthetic: string;
  listen: string;
}

interface LastKombiCardProps {
  lang: "en" | "sn";
  state: "warn" | "past";
  routeName: string;
  usualTime: string;
  minutesLeft: number;
  wide: boolean;
  observedDays: number;
  syntheticDays: number;
  strings: LastKombiStrings;
}

export function LastKombiCard({
  lang,
  state,
  routeName,
  usualTime,
  minutesLeft,
  wide,
  observedDays,
  syntheticDays,
  strings,
}: LastKombiCardProps) {
  const phrase = useRef<CachedPhrase | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    phrase.current = new CachedPhrase(`/voice/${lang}/last-kombi.wav`);
    // warm the cache while the rider reads; the tap itself never waits on
    // the network, which is the whole point of a cached library
    void phrase.current.load().then((url) => setMuted(url === null));
  }, [lang]);

  const listen = useCallback(async () => {
    const url = await phrase.current?.load();
    if (!url) {
      setMuted(true);
      return;
    }
    audio.current ??= new Audio();
    audio.current.src = url;
    void audio.current.play().catch(() => setMuted(true));
  }, []);

  return (
    <section
      className="guide-cue guide-cue-warn last-kombi-card"
      data-testid="last-kombi"
      data-state={state}
    >
      <p className="last-kombi-title">{strings.title.replace("{route}", routeName)}</p>
      <p className="last-kombi-line" data-testid="last-kombi-line">
        {state === "past"
          ? strings.past
          : `${strings.usually.replace("{time}", usualTime)} · ${strings.left.replace(
              "{minutes}",
              String(Math.max(0, minutesLeft)),
            )}`}
      </p>
      {wide && <p className="last-kombi-line">{strings.wide}</p>}
      <p className="last-kombi-basis" data-testid="last-kombi-basis">
        {strings.basis.replace("{days}", String(observedDays))}
        {syntheticDays > 0 &&
          ` ${strings.synthetic.replace("{days}", String(syntheticDays))}`}
      </p>
      {!muted && (
        <button
          type="button"
          className="last-kombi-listen touch-target"
          data-testid="last-kombi-listen"
          onClick={() => void listen()}
        >
          {strings.listen}
        </button>
      )}
    </section>
  );
}
