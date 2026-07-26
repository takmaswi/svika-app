"use client";

// Did we get you there right? (batch D2). Two channels, one card:
//   * explicit: three taps, skippable, bilingual. Right kombi, right stop,
//     too much walking. The row saves itself on the third tap; a skip
//     saves nothing and is remembered on this phone only.
//   * implicit: where the rider recorded their journey (M1) over this
//     planned trip, the phone compares the planned alight stop and walking
//     tail against the trace with the documented geometry rules
//     (packages/shared/src/plan-trace-mismatch.ts) and logs any mismatch
//     against the plan that produced it. No model, and the mismatch table
//     is the honest seed for a future learned ranker.
// Neither channel carries a conductor or a vehicle: answers tune plans,
// never people, and the card says so.
import { useEffect, useMemo, useState } from "react";
import type { AppLanguage } from "@svika/shared";
import {
  detectPlanTraceMismatches,
  type MismatchTracePoint,
} from "@svika/shared";
import { t } from "@/lib/dict";
import { createClient } from "@/lib/supabase/client";

export interface FeedbackCardProps {
  lang: AppLanguage;
  ticketId: string;
  purchasedAt: string;
  arrivedAt: string | null;
  alightStop: { lat: number; lng: number } | null;
  walkTail: { lat: number; lng: number; walkMeters: number } | null;
}

type Answers = {
  kombi: boolean | null;
  stop: boolean | null;
  tooMuchWalking: boolean | null;
};

const SKIP_KEY = (ticket: string) => `svika_feedback_skip_${ticket}`;

export function FeedbackCard({
  lang,
  ticketId,
  purchasedAt,
  arrivedAt,
  alightStop,
  walkTail,
}: FeedbackCardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<"loading" | "open" | "thanks" | "skipped">(
    "loading",
  );
  const [answers, setAnswers] = useState<Answers>({
    kombi: null,
    stop: null,
    tooMuchWalking: null,
  });
  const [busy, setBusy] = useState(false);
  const [mismatchCount, setMismatchCount] = useState<number | null>(null);

  // a row already stands, or the rider skipped on this phone
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (window.localStorage.getItem(SKIP_KEY(ticketId))) {
        setState("skipped");
        return;
      }
      const { data } = await supabase
        .from("trip_feedback")
        .select("ticket_id")
        .eq("ticket_id", ticketId)
        .maybeSingle();
      if (!cancelled) setState(data ? "thanks" : "open");
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, ticketId]);

  // the third tap saves the row (imperative on the tap itself: exactly
  // three taps, no send button, no racing effect)
  const tap = (key: keyof Answers, value: boolean) => {
    if (busy || state !== "open") return;
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (next.kombi === null || next.stop === null || next.tooMuchWalking === null) {
      return;
    }
    setBusy(true);
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setBusy(false);
        return;
      }
      const { error } = await supabase.from("trip_feedback").insert({
        ticket_id: ticketId,
        rider_id: user.id,
        right_kombi: next.kombi,
        right_stop: next.stop,
        walk_ok: !next.tooMuchWalking,
      });
      if (!error) setState("thanks");
      setBusy(false);
    })();
  };

  // implicit: compare the plan against a recorded journey, once, quietly
  useEffect(() => {
    if (!alightStop) {
      setMismatchCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const windowEnd = arrivedAt ?? new Date().toISOString();
      const { data: journey } = await supabase
        .from("rider_journeys")
        .select("id, started_at, ended_at")
        .eq("status", "complete")
        .lte("started_at", windowEnd)
        .gte("ended_at", purchasedAt)
        .order("ended_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !journey) {
        if (!cancelled) setMismatchCount(0);
        return;
      }
      const { data: points } = await supabase
        .from("rider_journey_points")
        .select("lat, lng, recorded_at")
        .eq("journey_id", journey.id)
        .order("seq", { ascending: true });
      if (cancelled || !points) return;
      const trace: MismatchTracePoint[] = points.map((p) => ({
        lat: p.lat as number,
        lng: p.lng as number,
        recordedAt: Date.parse(p.recorded_at as string),
      }));
      const found = detectPlanTraceMismatches(
        {
          alightStop,
          destination: walkTail ? { lat: walkTail.lat, lng: walkTail.lng } : null,
          plannedWalkM: walkTail?.walkMeters ?? 0,
        },
        trace,
      );
      if (found.length > 0) {
        // insert once per (plan, kind); a replayed comparison changes nothing
        await supabase.from("plan_trace_mismatches").upsert(
          found.map((m) => ({
            ticket_id: ticketId,
            rider_id: user.id,
            journey_id: journey.id as string,
            kind: m.kind,
            alight_offset_m: m.alightOffsetM,
            planned_walk_m: m.plannedWalkM,
            actual_walk_m: m.actualWalkM,
          })),
          { onConflict: "ticket_id,kind", ignoreDuplicates: true },
        );
      }
      if (!cancelled) setMismatchCount(found.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, ticketId, purchasedAt, arrivedAt, alightStop, walkTail]);

  if (state === "loading" || state === "skipped") {
    return (
      <div
        data-testid="feedback-card"
        data-state={state}
        data-mismatches={mismatchCount ?? ""}
      />
    );
  }

  const question = (
    key: "kombi" | "stop" | "tooMuchWalking",
    label: string,
  ) => (
    <div className="feedback-q-row" data-testid={`feedback-q-${key}`}>
      <span className="svika-body feedback-q-label">{label}</span>
      <span className="feedback-q-chips">
        {([true, false] as const).map((value) => (
          <button
            key={String(value)}
            type="button"
            className="place-kind-chip touch-target"
            data-selected={answers[key] === value}
            data-testid={`feedback-${key}-${value ? "yes" : "no"}`}
            onClick={() => tap(key, value)}
          >
            {t(lang, value ? "feedback.yes" : "feedback.no")}
          </button>
        ))}
      </span>
    </div>
  );

  return (
    <section
      className="svika-card wallet-panel svika-animate-fade-up svika-rise-2"
      data-testid="feedback-card"
      data-state={state}
      data-mismatches={mismatchCount ?? ""}
    >
      <h2 className="svika-title">{t(lang, "feedback.title")}</h2>
      {state === "thanks" ? (
        <p className="wallet-ok svika-body" data-testid="feedback-thanks">
          {t(lang, "feedback.thanks")}
        </p>
      ) : (
        <>
          {question("kombi", t(lang, "feedback.qKombi"))}
          {question("stop", t(lang, "feedback.qStop"))}
          {question("tooMuchWalking", t(lang, "feedback.qWalk"))}
          <button
            type="button"
            className="auth-link touch-target"
            data-testid="feedback-skip"
            onClick={() => {
              window.localStorage.setItem(SKIP_KEY(ticketId), "1");
              setState("skipped");
            }}
          >
            {t(lang, "feedback.skip")}
          </button>
        </>
      )}
      <p className="svika-meta">{t(lang, "feedback.note")}</p>
    </section>
  );
}
