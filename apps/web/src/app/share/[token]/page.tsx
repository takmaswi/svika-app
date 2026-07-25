import { getLang, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { HomeSheet } from "@/components/home/HomeSheet";
import { EtaBasis } from "@/components/home/EtaBasis";
import { buildShareOverlay } from "@/lib/map/share-overlay";
import { homeEtaProvider } from "@/lib/map/eta-home";
import { CORRIDOR_ROUTE_CODE, corridorMetrics } from "@/lib/map/corridor-data";
import { etaBasisCard, etaBasisLabel } from "@/lib/eta-provenance";
import type { LngLat } from "@/lib/map/geometry";

interface ShareViewRow {
  route_code: string;
  route_name: string;
  direction: "outbound" | "inbound";
  from_stop_id: string | null;
  from_stop_name: string | null;
  to_stop_id: string | null;
  to_stop_name: string | null;
  trip_status: string;
  share_expires_at: string;
}

// The share link's world: a public page (no account, no gate) that answers
// only for a live token. It says plainly what the viewer can and cannot
// see. Dead, revoked, expired and unknown tokens all land on one identical
// quiet state, so the URL space leaks nothing.
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const lang = await getLang();
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("ride_share_view", { p_token: token });
  const view = (data?.[0] ?? null) as ShareViewRow | null;

  if (!view) {
    return (
      <main className="shell">
        <header className="shell-top">
          <img className="wordmark" src="/wordmark.svg" alt="Svika" height={24} />
          <LanguageToggle lang={lang} />
        </header>
        <section
          className="svika-card wallet-panel svika-animate-fade-up"
          data-testid="share-dead"
        >
          <h1 className="svika-headline">{t(lang, "share.deadH")}</h1>
          <p className="svika-body">{t(lang, "share.deadB")}</p>
        </section>
      </main>
    );
  }

  // the trip's two stop points and the corridor's stop order for the ETA
  const stopIds = [view.from_stop_id, view.to_stop_id].filter(
    (id): id is string => !!id,
  );
  const [stopsRes, corridorRes] = await Promise.all([
    supabase.from("stops").select("id, lat, lng").in("id", stopIds),
    supabase
      .from("route_stops")
      .select("stop_id, seq, routes!inner(code)")
      .eq("routes.code", CORRIDOR_ROUTE_CODE)
      .eq("direction", "outbound")
      .order("seq"),
  ]);
  const points = new Map(
    (stopsRes.data ?? []).map((s) => [s.id as string, [s.lng, s.lat] as LngLat]),
  );
  const from = view.from_stop_id ? (points.get(view.from_stop_id) ?? null) : null;
  const to = view.to_stop_id ? (points.get(view.to_stop_id) ?? null) : null;
  const overlay = buildShareOverlay(
    { routeCode: CORRIDOR_ROUTE_CODE, metrics: corridorMetrics },
    view.route_code,
    from,
    to,
  );

  const corridorStopIds = (corridorRes.data ?? []).map((r) => r.stop_id as string);
  const eta =
    view.from_stop_id && view.to_stop_id
      ? await homeEtaProvider(corridorStopIds).estimateArrival(
          view.from_stop_id,
          view.to_stop_id,
        )
      : null;

  // three viewer states: waiting to board, on the kombi, arrived safely
  // (the guardian's notify moment, park tone by class)
  const statusKey =
    view.trip_status === "arrived"
      ? "share.statusArrived"
      : view.trip_status === "redeemed"
        ? "share.statusOnBoard"
        : "share.statusWaiting";
  const hasArrived = view.trip_status === "arrived";

  return (
    <main className="home-screen" data-testid="share-view">
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

      <header className="home-chips">
        <span className="home-chip home-chip-brand svika-glass">
          {/* Exported wordmark, never rebuilt. */}
          <img className="wordmark" src="/wordmark.svg" alt="Svika" height={22} />
        </span>
        <span className="home-chips-right">
          <span className="home-chip svika-glass">
            <LanguageToggle lang={lang} />
          </span>
        </span>
      </header>

      <HomeSheet
        className="plan-sheet"
        openLabel={t(lang, "plan.sheetOpen")}
        closeLabel={t(lang, "home.sheetClose")}
        peek={
          <>
            <p className="svika-meta tickets-heading">{t(lang, "share.viewerTitle")}</p>
            <h1 className="svika-title home-sheet-title">
              {view.from_stop_name} {t(lang, "common.to")} {view.to_stop_name}
            </h1>
            <div className="peek-stats">
              <div>
                <p className="peek-label">{t(lang, "ticket.route")}</p>
                <p className="peek-route">{view.route_name}</p>
                <span
                  className={`peek-route-sub${hasArrived ? " share-status-arrived" : ""}`}
                  data-testid="share-status"
                >
                  {t(lang, statusKey)}
                </span>
              </div>
              {!hasArrived && eta && (
                <div>
                  <p className="peek-label">{t(lang, "share.arrives")}</p>
                  <p className="peek-mono" data-testid="share-eta">
                    ~{eta.minutes} {t(lang, "common.minutes")}
                  </p>
                  {/* public page: the honest card opens here too, without
                      the signed in link into the app */}
                  <EtaBasis
                    className="peek-route-sub"
                    label={etaBasisLabel(lang, eta)}
                    card={etaBasisCard(lang, eta)}
                  />
                </div>
              )}
            </div>
          </>
        }
      >
        <section className="svika-card wallet-panel" data-testid="share-disclosure">
          <h2 className="svika-meta privacy-heading">{t(lang, "share.canSeeH")}</h2>
          <ul className="consent-points">
            <li className="svika-body">{t(lang, "share.canSee1")}</li>
            <li className="svika-body">{t(lang, "share.canSee2")}</li>
          </ul>
          <h2 className="svika-meta privacy-heading">{t(lang, "share.cannotSeeH")}</h2>
          <ul className="consent-points">
            <li className="svika-body">{t(lang, "share.cannotSee1")}</li>
          </ul>
          <p className="svika-meta">{t(lang, "share.expiryNote")}</p>
        </section>
      </HomeSheet>
    </main>
  );
}
