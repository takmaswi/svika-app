// The approved Trip-Result screen (launch-v2, plan Step 3.3): a small map of
// the real trip, then the step card (walk to the stop, board, get off, walk
// to the place) and one primary action. Fares are riders reported only; with
// no reports yet the card says so instead of quoting the network table.
import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  planBetween,
  resolveStopQuery,
  type AppLanguage,
  type BetweenPlan,
  type Network,
  type TripEnd,
} from "@svika/shared";
import { t } from "@/lib/i18n";
import { flagOn } from "@/lib/flags-server";
import { fetchPublicNetwork } from "@/lib/public-network";
import { buildPlanOverlay } from "@/lib/map/plan-overlay";
import { loadPlaces, resolvePlaceQuery } from "@/lib/geocode/search";
import { fetchPublicPlaces } from "@/lib/geocode/public-places";
import { parseLocationParam } from "@/lib/door/ends";
import { saveTrip } from "@/lib/actions";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { BackButton, CtaPill } from "@/components/v2/parts";
import { FirstWinCard } from "./FirstWinCard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

/** A plan URL end as a stop, a point, or nothing the planner knows. */
async function resolveEnd(
  supabase: SupabaseClient,
  network: Network,
  raw: string,
  myLocation: string,
): Promise<{ end: TripEnd; label: string } | null> {
  const here = parseLocationParam(raw);
  if (here)
    return {
      end: { kind: "point", point: { name: myLocation, ...here } },
      label: myLocation,
    };
  if (UUID_RE.test(raw)) {
    const stop = network.stops.find((s) => s.id === raw);
    return stop ? { end: { kind: "stop", stopId: stop.id }, label: stop.name } : null;
  }
  const stop = resolveStopQuery(network, raw).match;
  if (stop) return { end: { kind: "stop", stopId: stop.id }, label: stop.name };
  const corpus = loadPlaces();
  const place = resolvePlaceQuery(
    [...corpus, ...(await fetchPublicPlaces(supabase, raw, corpus))],
    raw,
  ).match;
  return place ? { end: { kind: "point", point: place }, label: place.name } : null;
}

interface Step {
  title: string;
  sub: string;
  time: string;
  tone: "walk" | "board" | "off";
}

function stepsOf(
  lang: AppLanguage,
  network: Network,
  r: BetweenPlan,
  destLabel: string,
): Step[] {
  const stopName = (id: string) => network.stops.find((s) => s.id === id)?.name ?? id;
  const mins = (n: number) => fill(t(lang, "trip.minutes"), { count: n });
  const out: Step[] = [];
  if (r.head) {
    out.push({
      tone: "walk",
      title: fill(t(lang, "trip.walkTo"), { stop: stopName(r.head.toStopId) }),
      sub: r.reachableFrom
        ? t(lang, "trip.fromYou")
        : fill(t(lang, "trip.fromFar"), { meters: r.head.meters }),
      time: mins(r.head.minutes),
    });
  }
  r.plan.legs.forEach((leg, i) => {
    if (leg.type === "walk") {
      out.push({
        tone: "walk",
        title: fill(t(lang, "trip.walkTo"), { stop: stopName(leg.toStopId) }),
        sub: `${leg.walkMeters} m`,
        time: mins(leg.walkMinutes),
      });
      return;
    }
    const last = i === r.plan.legs.length - 1;
    out.push({
      tone: "board",
      title: fill(t(lang, "trip.board"), { route: leg.routeName }),
      sub: t(lang, "trip.payCash"),
      time: "",
    });
    out.push({
      tone: "off",
      title: fill(t(lang, "trip.getOff"), { stop: stopName(leg.alightStopId) }),
      sub: !last ? t(lang, "trip.change") : r.tail ? "" : t(lang, "trip.arrive"),
      time: mins(leg.rideMinutes),
    });
  });
  if (r.tail) {
    out.push({
      tone: "walk",
      title: fill(t(lang, "trip.walkDest"), { place: destLabel }),
      sub: r.reachableTo
        ? t(lang, "trip.arrive")
        : fill(t(lang, "plan.noService"), {
            place: destLabel,
            stop: stopName(r.alightStopId),
            meters: r.tail.meters,
          }),
      time: mins(r.tail.minutes),
    });
  }
  return out;
}

export async function TripResult({
  lang,
  supabase,
  signedIn,
  fromRaw,
  toRaw,
  justSaved,
}: {
  lang: AppLanguage;
  supabase: SupabaseClient;
  signedIn: boolean;
  fromRaw: string;
  toRaw: string;
  justSaved: boolean;
}) {
  const network = await fetchPublicNetwork(supabase);
  const myLocation = t(lang, "planner.myLocation");
  const [from, to] = await Promise.all([
    resolveEnd(supabase, network, fromRaw, myLocation),
    resolveEnd(supabase, network, toRaw, myLocation),
  ]);
  if (!to) redirect(`/app/where?q=${encodeURIComponent(toRaw)}&miss=1`);
  if (!from) redirect("/app/where?miss=1");

  const result = planBetween(network, from.end, to.end);
  const planUrl = `/app/plan?from=${encodeURIComponent(fromRaw)}&to=${encodeURIComponent(toRaw)}`;
  if (!result) {
    return (
      <main className="v2-screen" data-testid="trip-none">
        <div className="v2-section">
          <BackButton href="/app/where" label={t(lang, "common.back")} />
          <h1 className="v2-h1">{fill(t(lang, "trip.to"), { place: to.label })}</h1>
          <p className="v2-body">{t(lang, "plan.noRoute")}</p>
        </div>
      </main>
    );
  }

  const [accounts, reward] = await Promise.all([
    flagOn("accounts"),
    flagOn("weekly_reward"),
  ]);
  const destPoint = to.end.kind === "point" ? to.end.point : null;
  const overlay = buildPlanOverlay(
    network,
    result.plan,
    destPoint ? [destPoint.lng, destPoint.lat] : undefined,
  );
  const steps = stepsOf(lang, network, result, to.label);
  const nickname = fill(t(lang, "trip.to"), { place: to.label }).slice(0, 40);

  return (
    <main className="v2-screen v2-trip" data-testid="trip-result">
      <div className="v2-mapband">
        <LiveMapLazy
          labels={{
            ariaLabel: t(lang, "trip.mapAria"),
            demoChip: "",
            unavailable: t(lang, "map.unavailable"),
          }}
          overlay={overlay ?? undefined}
          vehicles={false}
        />
        <BackButton href="/app/where" label={t(lang, "common.back")} floating />
      </div>

      <div className="v2-sheet">
        <span className="v2-grabber" aria-hidden />
        <div className="v2-trip-head v2-rise v2-d1">
          <h1 className="v2-h1">{fill(t(lang, "trip.to"), { place: to.label })}</h1>
          <div className="v2-stats">
            <span className="v2-stat v2-stat-hot">
              <span className="v2-stat-l">{t(lang, "trip.fare")}</span>
              <span className="v2-stat-n v2-stat-none" data-testid="trip-fare">
                {t(lang, "trip.notYet")}
              </span>
            </span>
            <span className="v2-stat">
              <span className="v2-stat-l">{t(lang, "trip.time")}</span>
              <span className="v2-stat-n" data-testid="trip-minutes">
                {fill(t(lang, "trip.minutes"), { count: result.totalMinutes })}
              </span>
            </span>
            <span className="v2-stat">
              <span className="v2-stat-l">{t(lang, "trip.kombis")}</span>
              <span className="v2-stat-n" data-testid="trip-kombis">
                {result.plan.boardings}
              </span>
            </span>
          </div>
          <span className="v2-trip-note">{t(lang, "trip.noteNoFare")}</span>
        </div>

        <ol className="v2-steps v2-rise v2-d2" data-testid="trip-steps">
          {steps.map((step, i) => (
            <li className="v2-step" key={i} data-testid="trip-step">
              <span className="v2-step-rail" aria-hidden>
                <span
                  className={`v2-step-n${step.tone === "board" ? " v2-step-n-board" : step.tone === "off" ? " v2-step-n-off" : ""}`}
                >
                  {i + 1}
                </span>
                <span
                  className={`v2-step-line${step.tone === "board" ? " v2-step-line-board" : ""}`}
                  style={
                    i === steps.length - 1 ? { background: "transparent" } : undefined
                  }
                />
              </span>
              <span className="v2-step-body">
                <span className="v2-step-title">{step.title}</span>
                {step.sub && <span className="v2-step-sub">{step.sub}</span>}
              </span>
              <span className="v2-step-time">{step.time}</span>
            </li>
          ))}
        </ol>

        <div className="v2-trip-actions v2-rise v2-d3">
          <CtaPill
            href={signedIn ? "/app/record?mode=kombi" : "/login?why=record"}
            testId="trip-start"
          >
            {t(lang, "trip.start")}
          </CtaPill>
          <div className="v2-trip-more">
            {!signedIn ? (
              <Link
                className="v2-pill-soft"
                href={
                  accounts
                    ? "/signup"
                    : `/login?why=save&next=${encodeURIComponent(planUrl)}`
                }
                data-testid="trip-save"
              >
                {t(lang, "trip.save")}
              </Link>
            ) : justSaved ? (
              <span
                className="v2-pill-soft"
                data-testid="trip-saved"
                aria-live="polite"
              >
                {t(lang, "trip.saved")}
              </span>
            ) : (
              <form action={saveTrip} className="v2-pill-form">
                <input type="hidden" name="from" value={result.boardStopId} />
                {to.end.kind === "stop" ? (
                  <input type="hidden" name="to" value={to.end.stopId} />
                ) : (
                  <>
                    <input type="hidden" name="dest" value={to.end.point.name} />
                    <input type="hidden" name="destLat" value={to.end.point.lat} />
                    <input type="hidden" name="destLng" value={to.end.point.lng} />
                  </>
                )}
                <input type="hidden" name="nickname" value={nickname} />
                <input type="hidden" name="back" value={planUrl} />
                <button className="v2-pill-soft" type="submit" data-testid="trip-save">
                  {t(lang, "trip.save")}
                </button>
              </form>
            )}
          </div>
        </div>

        {!signedIn && accounts && (
          <FirstWinCard
            title={t(lang, reward ? "win.titleReward" : "win.title")}
            body={t(lang, "win.body")}
            cta={t(lang, "win.cta")}
            dismiss={t(lang, "win.dismiss")}
            href="/signup"
          />
        )}
      </div>
    </main>
  );
}
