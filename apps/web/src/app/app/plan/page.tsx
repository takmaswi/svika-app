import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { fetchNetwork } from "@/lib/network";
import { bookTrip, saveTrip } from "@/lib/actions";
import { buildPlanOverlay } from "@/lib/map/plan-overlay";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { HomeSheet } from "@/components/home/HomeSheet";
import { ArrowIcon, BackIcon } from "@/components/icons";
import {
  formatUsd,
  planTrip,
  resolveStopQuery,
  type Network,
  type NetworkStop,
} from "@svika/shared";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveParam(
  network: Network,
  raw: string,
): { stop: NetworkStop | null; suggestions: NetworkStop[] } {
  if (UUID_RE.test(raw)) {
    const stop = network.stops.find((s) => s.id === raw) ?? null;
    return { stop, suggestions: stop ? [] : network.stops };
  }
  const result = resolveStopQuery(network, raw);
  return { stop: result.match, suggestions: result.suggestions };
}

// The plan page (reference screen 3). Receives free text or stop ids; free
// text that resolves confidently plans straight away, anything else becomes
// a stop picker. A resolved plan renders on the live map itself: ride legs
// on the real road, walking legs dashed, and one section 5 CTA in the same
// bottom sheet grammar as home.
export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const fromRaw = typeof params.from === "string" ? params.from : "";
  const toRaw = typeof params.to === "string" ? params.to : "";
  const err = typeof params.err === "string" ? params.err : "";
  const justSaved = params.saved === "1";
  if (!fromRaw || !toRaw) redirect("/app");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const network = await fetchNetwork(supabase);
  const from = resolveParam(network, fromRaw);
  const to = resolveParam(network, toRaw);

  // both sides resolved: plan
  const plan =
    from.stop && to.stop ? planTrip(network, from.stop.id, to.stop.id) : null;

  const stopName = (id: string) => network.stops.find((s) => s.id === id)?.name ?? id;
  const routeCode = (name: string) =>
    network.routes.find((r) => r.name === name)?.code ?? name.slice(0, 2);

  if (!from.stop || !to.stop) {
    return (
      <main className="shell">
        <header className="screen-head">
          <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
            <BackIcon />
          </Link>
          <h1 className="svika-headline">
            {!from.stop ? t(lang, "plan.pickFrom") : t(lang, "plan.pickTo")}
          </h1>
        </header>
        <section className="picker-card svika-animate-fade-up">
          <p className="svika-body empty-note">{t(lang, "plan.noMatch")}</p>
          <ul className="picker-list">
            {(!from.stop ? from.suggestions : to.suggestions).map((s) => {
              const href = !from.stop
                ? `/app/plan?from=${s.id}&to=${encodeURIComponent(toRaw)}`
                : `/app/plan?from=${encodeURIComponent(fromRaw)}&to=${s.id}`;
              return (
                <li key={s.id}>
                  <Link className="picker-item touch-target" href={href}>
                    {s.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="shell">
        <header className="screen-head">
          <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
            <BackIcon />
          </Link>
          <h1 className="svika-headline">{t(lang, "plan.title")}</h1>
        </header>
        <section className="picker-card svika-card">
          <p className="svika-body">{t(lang, "plan.noRoute")}</p>
        </section>
      </main>
    );
  }

  const overlay = buildPlanOverlay(network, plan);

  return (
    <main className="home-screen">
      <div className="home-map">
        <LiveMapLazy
          labels={{
            ariaLabel: t(lang, "map.ariaLabel"),
            demoChip: t(lang, "map.demoChip"),
            unavailable: t(lang, "map.unavailable"),
          }}
          overlay={overlay ?? undefined}
        />
      </div>

      <header className="plan-back-row">
        <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <span className="plan-title-pill">{t(lang, "plan.title")}</span>
      </header>

      <HomeSheet
        className="plan-sheet"
        openLabel={t(lang, "plan.sheetOpen")}
        closeLabel={t(lang, "home.sheetClose")}
        defaultOpen={justSaved || err !== ""}
        peek={
          <>
            <div className="plan-sheet-head">
              <h1 className="svika-title home-sheet-title">
                {from.stop.name} {t(lang, "common.to")} {to.stop.name}
              </h1>
            </div>
            <div className="plan-fare-row">
              <p className="plan-total svika-mono-code">
                {formatUsd(plan.totalFareCents)}
              </p>
              <p className="svika-meta plan-fare-meta">
                {t(lang, "plan.about")}{" "}
                <span className="svika-mono-code">{plan.totalMinutes}</span>{" "}
                {t(lang, "common.minutes")} ·{" "}
                <span className="svika-mono-code">{plan.boardings}</span>{" "}
                {t(lang, "plan.boardings")}
              </p>
            </div>
            {err === "balance" && (
              <p className="auth-error svika-body">{t(lang, "plan.insufficient")}</p>
            )}
            {err === "noroute" && (
              <p className="auth-error svika-body">{t(lang, "plan.noRoute")}</p>
            )}
            <form action={bookTrip} className="plan-pay">
              <input type="hidden" name="from" value={from.stop.id} />
              <input type="hidden" name="to" value={to.stop.id} />
              <button
                className="cta touch-target"
                type="submit"
                name="payment"
                value="wallet"
              >
                {t(lang, "plan.payWallet")}
                <span className="cta-chip" aria-hidden>
                  <ArrowIcon />
                </span>
              </button>
              <button
                className="pay-cash touch-target"
                type="submit"
                name="payment"
                value="cash"
              >
                {t(lang, "plan.reserveCash")}
              </button>
            </form>
          </>
        }
      >
        <ol className="plan-legs">
          {plan.legs.map((leg, i) =>
            leg.type === "ride" ? (
              <li key={i} className="plan-leg">
                <span className="route-badge" aria-hidden>
                  {routeCode(leg.routeName)}
                </span>
                <span className="plan-leg-body">
                  <span className="plan-leg-name">{leg.routeName}</span>
                  <span className="plan-leg-sub">
                    {t(lang, "plan.alightAt")} {stopName(leg.alightStopId)}
                  </span>
                </span>
                <span className="plan-leg-figures">
                  <span className="plan-leg-time">
                    {leg.rideMinutes} {t(lang, "common.minutes")}
                  </span>
                  <span className="plan-leg-fare">{formatUsd(leg.fareCents)}</span>
                </span>
              </li>
            ) : (
              <li key={i} className="plan-leg">
                <span className="route-badge route-badge-soft" aria-hidden>
                  {t(lang, "plan.walk").slice(0, 1)}
                </span>
                <span className="plan-leg-body">
                  <span className="plan-leg-name">{t(lang, "plan.walk")}</span>
                  <span className="plan-leg-sub">{stopName(leg.toStopId)}</span>
                </span>
                <span className="plan-leg-figures">
                  <span className="plan-leg-time">
                    {leg.walkMinutes} {t(lang, "common.minutes")}
                  </span>
                  <span className="plan-leg-fare">{leg.walkMeters} m</span>
                </span>
              </li>
            ),
          )}
        </ol>

        {justSaved ? (
          <p className="svika-body plan-saved" data-testid="trip-saved">
            {t(lang, "plan.savedNote")}
          </p>
        ) : (
          <form action={saveTrip} className="plan-save">
            <input type="hidden" name="from" value={from.stop.id} />
            <input type="hidden" name="to" value={to.stop.id} />
            <label className="svika-meta" htmlFor="nickname">
              {t(lang, "plan.saveTitle")}
            </label>
            <div className="plan-save-row">
              <input
                id="nickname"
                name="nickname"
                className="auth-input"
                placeholder={t(lang, "plan.savePlaceholder")}
                maxLength={40}
                autoComplete="off"
                required
              />
              <button className="plan-save-cta touch-target" type="submit">
                {t(lang, "plan.saveCta")}
              </button>
            </div>
            {(err === "nickname" || err === "save") && (
              <p className="auth-error svika-body">{t(lang, "plan.saveErr")}</p>
            )}
          </form>
        )}
      </HomeSheet>
    </main>
  );
}
