"use client";

// The approved Planner screen (launch-v2, plan Step 3.2). From starts as My
// location and the phone's position is asked for only when the rider picks
// where to go; if it is refused, From becomes a field to type in. To
// suggests stops and places from two letters. Recent destinations live on
// the phone only.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BackButton } from "@/components/v2/parts";
import { PinV2, SwapV2 } from "@/components/v2/icons";
import { whereAmI } from "@/lib/door/locate";
import { RECENT_KEY, pushRecent, readRecent, splitMatch } from "@/lib/door/ends";

type Kind = "stop" | "suburb" | "place" | "poi" | "road";
interface Suggestion {
  name: string;
  kind: Kind;
}
type End = { me: true } | { me: false; text: string };
type Side = "from" | "to";

export interface PlannerStrings {
  title: string;
  back: string;
  from: string;
  to: string;
  myLocation: string;
  swap: string;
  places: string;
  recent: string;
  noMatch: string;
  locating: string;
  locationOff: string;
  locationWhy: string;
  aiHint: string;
  aiExample: string;
  kinds: Record<Kind, string>;
}

const DEBOUNCE_MS = 220;

export function PlannerScreen({
  initialTo,
  missed,
  strings: s,
}: {
  initialTo: string;
  missed: boolean;
  strings: PlannerStrings;
}) {
  const router = useRouter();
  const [from, setFrom] = useState<End>({ me: true });
  const [to, setTo] = useState<End>({ me: false, text: initialTo });
  const [side, setSide] = useState<Side>("to");
  const [list, setList] = useState<Suggestion[]>([]);
  const [listFor, setListFor] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "locating" | "off">("idle");
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(readRecent(localStorage.getItem(RECENT_KEY)));
    toRef.current?.focus();
  }, []);

  const active = side === "from" ? from : to;
  const query = active.me ? "" : active.text.trim();

  useEffect(() => {
    if (query.length < 2) {
      setList([]);
      setListFor("");
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/places/suggest?q=${encodeURIComponent(query)}`);
        const json = res.ok ? ((await res.json()) as Suggestion[]) : [];
        if (live) {
          setList(json);
          setListFor(query);
        }
      } catch {
        if (live) setList([]);
      }
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  async function endParam(end: End): Promise<string | null> {
    if (!end.me) return end.text.trim() || null;
    setStatus("locating");
    try {
      return await whereAmI();
    } catch {
      setStatus("off");
      return null;
    }
  }

  async function go(nextFrom: End, nextTo: End) {
    const fromP = await endParam(nextFrom);
    if (!fromP) {
      // refused or unavailable: From becomes a field to type in
      setFrom({ me: false, text: "" });
      setSide("from");
      fromRef.current?.focus();
      return;
    }
    const toP = await endParam(nextTo);
    if (!toP) {
      setTo({ me: false, text: "" });
      setSide("to");
      toRef.current?.focus();
      return;
    }
    if (!nextTo.me) {
      const updated = pushRecent(recent, nextTo.text);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    }
    router.push(
      `/app/plan?from=${encodeURIComponent(fromP)}&to=${encodeURIComponent(toP)}`,
    );
  }

  function pick(name: string) {
    if (side === "from") {
      const nextFrom: End = { me: false, text: name };
      setFrom(nextFrom);
      if (!to.me && to.text.trim().length >= 2) return void go(nextFrom, to);
      setSide("to");
      toRef.current?.focus();
      return;
    }
    const nextTo: End = { me: false, text: name };
    setTo(nextTo);
    void go(from, nextTo);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (query.length >= 2) pick(query);
  }

  function swap() {
    setFrom(to);
    setTo(from);
    setSide(from.me ? "from" : "to");
  }

  const field = (which: Side, end: End, setEnd: (e: End) => void) => (
    <input
      ref={which === "from" ? fromRef : toRef}
      id={`planner-${which}`}
      className="v2-planner-input"
      value={end.me ? s.myLocation : end.text}
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="go"
      data-testid={`planner-${which}`}
      data-me={end.me ? "true" : undefined}
      onFocus={(e) => {
        setSide(which);
        if (end.me) e.currentTarget.select();
      }}
      onChange={(e) => setEnd({ me: false, text: e.target.value })}
      onBlur={(e) => {
        if (
          which === "from" &&
          e.currentTarget.value.trim() === "" &&
          status !== "off"
        ) {
          setFrom({ me: true });
        }
      }}
    />
  );

  const showRecent = query.length < 2 && side === "to" && recent.length > 0;
  const nothing = query.length >= 2 && listFor === query && list.length === 0;

  return (
    <main className="v2-screen v2-planner" data-testid="planner-screen">
      <div className="v2-planner-head">
        <div className="v2-planner-top">
          <BackButton href="/app" label={s.back} />
          <h1 className="v2-h1">{s.title}</h1>
        </div>
        <form className="v2-planner-card" onSubmit={submit} role="search">
          <div className="v2-planner-row v2-planner-row-from">
            <span className="v2-planner-dot" aria-hidden />
            <span className="v2-planner-col">
              <label className="v2-planner-label" htmlFor="planner-from">
                {s.from}
              </label>
              {field("from", from, setFrom)}
            </span>
            <button
              type="button"
              className="v2-planner-swap"
              aria-label={s.swap}
              onClick={swap}
            >
              <SwapV2 />
            </button>
          </div>
          <div className="v2-planner-row">
            <span className="v2-planner-square" aria-hidden />
            <span className="v2-planner-col">
              <label
                className="v2-planner-label v2-planner-label-to"
                htmlFor="planner-to"
              >
                {s.to}
              </label>
              {field("to", to, setTo)}
            </span>
          </div>
          <button type="submit" className="v2-sr" tabIndex={-1}>
            {s.title}
          </button>
        </form>
      </div>

      <div className="v2-planner-body">
        {status === "locating" && (
          <p className="v2-notice" role="status" data-testid="planner-locating">
            <span className="v2-notice-icon" aria-hidden>
              <PinV2 size={16} />
            </span>
            <span>
              {s.locating}. {s.locationWhy}
            </span>
          </p>
        )}
        {status === "off" && (
          <p className="v2-notice" role="alert" data-testid="planner-location-off">
            <span className="v2-notice-icon" aria-hidden>
              <PinV2 size={16} />
            </span>
            <span>{s.locationOff}</span>
          </p>
        )}
        {(missed || nothing) && (
          <p className="v2-meta" role="status" data-testid="planner-nomatch">
            {s.noMatch}
          </p>
        )}

        {list.length > 0 && (
          <section className="v2-planner-section v2-rise" aria-label={s.places}>
            <span className="v2-planner-heading">{s.places}</span>
            {list.map((p) => {
              const [bold, rest] = splitMatch(p.name, query);
              return (
                <button
                  type="button"
                  key={`${p.kind}|${p.name}`}
                  className="v2-planner-item"
                  data-testid="planner-suggestion"
                  onClick={() => pick(p.name)}
                >
                  <span className="v2-planner-icon v2-planner-icon-place" aria-hidden>
                    <PinV2 />
                  </span>
                  <span className="v2-planner-text">
                    <span className="v2-planner-name">
                      {bold && <b>{bold}</b>}
                      {rest}
                    </span>
                    <span className="v2-meta">{s.kinds[p.kind]}</span>
                  </span>
                </button>
              );
            })}
          </section>
        )}

        {showRecent && (
          <section className="v2-planner-section v2-rise" aria-label={s.recent}>
            <span className="v2-planner-heading">{s.recent}</span>
            {recent.map((name) => (
              <button
                type="button"
                key={name}
                className="v2-planner-item v2-planner-item-recent"
                onClick={() => pick(name)}
              >
                <span className="v2-planner-icon" aria-hidden>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  >
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.5V12l3 2" />
                  </svg>
                </span>
                <span className="v2-planner-name">{name}</span>
              </button>
            ))}
          </section>
        )}

        {s.aiHint && (
          <div className="v2-planner-hint v2-rise">
            <span className="v2-planner-aa" aria-hidden>
              Aa
            </span>
            <span>
              {s.aiHint} <b>{s.aiExample}</b>
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
