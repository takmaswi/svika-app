import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/roles";
import { formatUsd } from "@svika/shared";
import { RevenueBars, type DayNet } from "@/components/owner/RevenueBars";
import { WatchdogNarratives } from "@/components/owner/WatchdogNarratives";
import { ArrowIcon, BackIcon } from "@/components/icons";

interface RevenueRow {
  day: string;
  route_code: string;
  route_name: string;
  tickets: number;
  gross_cents: number;
  commission_cents: number;
  net_cents: number;
}

interface WatchdogFlagRow {
  day: string;
  flagged: boolean;
  threshold_flagged: boolean;
  explanation_en: string | null;
  explanation_sn: string | null;
}

const WATCHDOG_FLAGS_SHOWN = 3;
const CHART_DAYS = 14;

/** The last CHART_DAYS calendar days ending today, zero filled. */
function chartWindow(rows: RevenueRow[]): DayNet[] {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.net_cents);
  }
  const days: DayNet[] = [];
  const today = new Date();
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ day: key, netCents: byDay.get(key) ?? 0 });
  }
  return days;
}

interface RouteTotal {
  code: string;
  name: string;
  tickets: number;
  gross: number;
  commission: number;
  net: number;
}

function routeTotals(rows: RevenueRow[]): RouteTotal[] {
  const byRoute = new Map<string, RouteTotal>();
  for (const r of rows) {
    const acc = byRoute.get(r.route_code) ?? {
      code: r.route_code,
      name: r.route_name,
      tickets: 0,
      gross: 0,
      commission: 0,
      net: 0,
    };
    acc.tickets += r.tickets;
    acc.gross += r.gross_cents;
    acc.commission += r.commission_cents;
    acc.net += r.net_cents;
    byRoute.set(r.route_code, acc);
  }
  return [...byRoute.values()].sort((a, b) => b.net - a.net);
}

// The owner ledger view: settled digital fares aggregated per day and route,
// every number derived from the double entry ledger at read time. Audit
// language talks about patterns and totals, never about a named person.
export default async function OwnerPage() {
  const lang = await getLang();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await resolveRole(supabase, user.id);
  if (role !== "owner") redirect("/app");

  const [summaryRes, balanceRes, watchdogRes] = await Promise.all([
    supabase.rpc("owner_revenue_summary"),
    supabase
      .from("account_balances")
      .select("balance_cents")
      .eq("kind", "owner_wallet")
      .maybeSingle(),
    supabase
      .from("watchdog_day_flags")
      .select("day, flagged, threshold_flagged, explanation_en, explanation_sn")
      .order("day", { ascending: false }),
  ]);

  const rows = (summaryRes.data ?? []) as RevenueRow[];
  const balance = balanceRes.data?.balance_cents ?? 0;
  const totalNet = rows.reduce((sum, r) => sum + r.net_cents, 0);
  const days = chartWindow(rows);
  const windowNet = days.reduce((sum, d) => sum + d.netCents, 0);
  const routes = routeTotals(rows);

  const watchdogDays = (watchdogRes.data ?? []) as WatchdogFlagRow[];
  const flaggedDays = watchdogDays.filter((d) => d.flagged);
  const watchdogSummary = t(lang, "owner.watchdogSummary")
    .replace("{count}", String(watchdogDays.length))
    .replace("{flagged}", String(flaggedDays.length));

  const today = new Date();
  const dateLine = today.toLocaleDateString(lang === "sn" ? "sn-ZW" : "en-ZW", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const monthLine = today.toLocaleDateString(lang === "sn" ? "sn-ZW" : "en-ZW", {
    month: "long",
    year: "numeric",
  });

  const watchdogCard = (
    <section className="svika-card wallet-panel" data-testid="owner-watchdog">
      <div className="watchdog-head">
        <h2 className="svika-headline">{t(lang, "owner.watchdog")}</h2>
        <span className="svika-meta watchdog-label">
          {t(lang, "owner.watchdogSimulated")}
        </span>
      </div>
      {watchdogDays.length === 0 ? (
        <p className="svika-body empty-note">{t(lang, "owner.watchdogEmpty")}</p>
      ) : (
        <>
          <p className="svika-meta">{watchdogSummary}</p>
          {flaggedDays.length === 0 ? (
            <p className="svika-body empty-note">{t(lang, "owner.watchdogNone")}</p>
          ) : (
            <WatchdogNarratives
              initial={lang}
              englishLabel={t(lang, "lang.english")}
              shonaLabel={t(lang, "lang.shona")}
              forestLabel={t(lang, "owner.wdForest")}
              thresholdSilentLabel={t(lang, "owner.wdThresholdSilent")}
              thresholdFiredLabel={t(lang, "owner.wdThresholdFired")}
              flags={flaggedDays.slice(0, WATCHDOG_FLAGS_SHOWN).map((d) => ({
                day: d.day,
                en: d.explanation_en ?? "",
                sn: d.explanation_sn ?? d.explanation_en ?? "",
                thresholdFlagged: d.threshold_flagged,
              }))}
            />
          )}
        </>
      )}
      <p className="svika-meta empty-note">{t(lang, "owner.watchdogNote")}</p>
    </section>
  );

  return (
    <main className="shell">
      <header className="screen-head">
        <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <div>
          <h1 className="svika-headline owner-head-title">{t(lang, "owner.title")}</h1>
          <p className="owner-head-sub">{dateLine}</p>
        </div>
      </header>

      <section className="feature-card owner-hero svika-animate-fade-up">
        <p className="feature-label">{t(lang, "owner.balance")}</p>
        <p className="feature-amount amount-marigold" data-testid="owner-balance">
          {formatUsd(balance)}
        </p>
        <dl className="owner-hero-figures">
          <div>
            <dt>{t(lang, "owner.netToDate")}</dt>
            <dd className="svika-mono-code">{formatUsd(totalNet)}</dd>
          </div>
        </dl>
      </section>

      <section className="svika-card wallet-panel svika-animate-fade-up svika-rise-2">
        <div className="owner-chart-head">
          <h2 className="svika-meta tickets-heading">{t(lang, "owner.chartTitle")}</h2>
          <p className="svika-mono-code owner-chart-net">{formatUsd(windowNet)}</p>
        </div>
        <RevenueBars days={days} ariaLabel={t(lang, "owner.chartTitle")} />
        {rows.length === 0 && (
          <p className="svika-body empty-note">{t(lang, "owner.none")}</p>
        )}
      </section>

      {routes.length > 0 && (
        <section className="owner-routes" data-testid="owner-revenue">
          <h2 className="svika-meta tickets-heading">{t(lang, "owner.routesTitle")}</h2>
          {routes.map((r) => (
            <article
              key={r.code}
              className="svika-card owner-route"
              data-route-code={r.code}
            >
              <header className="owner-route-head">
                <span className="owner-route-title">
                  <span className="route-badge" aria-hidden>
                    {r.code.slice(0, 2)}
                  </span>
                  <span className="svika-body owner-route-name">{r.name}</span>
                </span>
              </header>
              <dl className="owner-route-figures">
                <div>
                  <dt className="svika-meta">{t(lang, "owner.tickets")}</dt>
                  <dd className="svika-mono-code">{r.tickets}</dd>
                </div>
                <div>
                  <dt className="svika-meta">{t(lang, "owner.gross")}</dt>
                  <dd className="svika-mono-code">{formatUsd(r.gross)}</dd>
                </div>
                <div>
                  <dt className="svika-meta">{t(lang, "owner.commission")}</dt>
                  <dd className="svika-mono-code">{formatUsd(r.commission)}</dd>
                </div>
                <div>
                  <dt className="svika-meta">{t(lang, "owner.net")}</dt>
                  <dd className="svika-mono-code owner-route-net">
                    {formatUsd(r.net)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
          <p className="svika-meta empty-note">{t(lang, "owner.note")}</p>
        </section>
      )}

      {watchdogCard}

      <section className="svika-card wallet-panel owner-tax">
        <div className="watchdog-head">
          <h2 className="svika-headline">{t(lang, "owner.taxTitle")}</h2>
          <span className="svika-meta watchdog-label">{monthLine}</span>
        </div>
        <p className="owner-tax-amount svika-mono-code">$50 to $60</p>
        <p className="svika-body">{t(lang, "owner.taxBody")}</p>
      </section>

      <Link className="cta touch-target owner-cta" href="/app/owner/statement">
        {t(lang, "owner.statementOpen")}
        <span className="cta-chip" aria-hidden>
          <ArrowIcon />
        </span>
      </Link>
      <p className="owner-note">{t(lang, "owner.taxHint")}</p>
    </main>
  );
}
