import Link from "next/link";
import { t } from "@/lib/i18n";
import type { AppLanguage } from "@svika/shared";
import { createClient } from "@/lib/supabase/server";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { HomeSheet } from "@/components/home/HomeSheet";
import { EtaBasis } from "@/components/home/EtaBasis";
import { etaBasisCard, etaBasisLabel } from "@/lib/eta-provenance";
import { ArrowIcon } from "@/components/icons";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { AppTheme } from "@/lib/theme";
import { formatUsd } from "@svika/shared";
import { CORRIDOR_ROUTE_CODE } from "@/lib/map/corridor-data";
import { homeEtaProvider } from "@/lib/map/eta-home";

// The guest home (batch V2): the same live map and search a rider sees,
// fed entirely by the world readable network under the anon role. Nothing
// personal exists to show, so the sheet says exactly why an account exists
// and offers the door. No consent gate here: consent guards accounts, and
// a guest holds no data to consent over.
export async function GuestHome({
  lang,
  theme,
}: {
  lang: AppLanguage;
  theme: AppTheme | null;
}) {
  const supabase = await createClient();
  const [corridorRes, corridorFareRes] = await Promise.all([
    supabase
      .from("route_stops")
      .select("stop_id, seq, stops(name), routes!inner(code, name)")
      .eq("routes.code", CORRIDOR_ROUTE_CODE)
      .eq("direction", "outbound")
      .order("seq"),
    supabase
      .from("route_fares")
      .select("fare_cents, effective_from, routes!inner(code, name)")
      .eq("routes.code", CORRIDOR_ROUTE_CODE)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const corridorRows = (corridorRes.data ?? []) as unknown as {
    stop_id: string;
    stops: { name: string } | null;
  }[];
  const corridorStopIds = corridorRows.map((r) => r.stop_id);
  const corridorFare = corridorFareRes.data as {
    fare_cents: number;
    routes: { code: string; name: string };
  } | null;
  const corridorEta =
    corridorStopIds.length >= 2
      ? await homeEtaProvider(corridorStopIds).estimate(
          corridorStopIds[0]!,
          corridorStopIds[corridorStopIds.length - 1]!,
        )
      : null;
  const corridorFirstStop = corridorRows[0]?.stops?.name ?? "";

  return (
    <main className="home-screen" data-testid="guest-home">
      <div className="home-map">
        <LiveMapLazy
          labels={{
            ariaLabel: t(lang, "map.ariaLabel"),
            demoChip: t(lang, "map.demoChip"),
            unavailable: t(lang, "map.unavailable"),
            viewWhole: t(lang, "map.viewWhole"),
            viewNear: t(lang, "map.viewNear"),
            view3d: t(lang, "map.view3d"),
            viewFlat: t(lang, "map.viewFlat"),
          }}
          camera="boarding"
        />
      </div>

      <header className="home-chips">
        <span className="home-chip home-chip-brand svika-glass">
          {/* Exported wordmark, never rebuilt. */}
          <img className="wordmark" src="/wordmark.svg" alt="Svika" height={22} />
        </span>
        <span className="home-chips-right">
          {/* sign in leads the row: at 360 the disabled ND tail clips
              (CHECKS item 8), never the door into an account */}
          <Link
            className="home-chip svika-glass touch-target guest-signin-chip"
            href="/login"
            data-testid="guest-signin-chip"
          >
            {t(lang, "guest.signInChip")}
          </Link>
          {/* V2 ruling 7: the board is public trust value, guests get the
              same door a rider has (deviation 9 anatomy) */}
          <Link
            className="home-chip svika-glass touch-target home-chip-kombis"
            href="/app/kombis"
            data-testid="kombis-chip"
          >
            {t(lang, "kombi.boardChip")}
          </Link>
          <span className="home-chip svika-glass">
            <ThemeToggle
              initialTheme={theme}
              toDarkLabel={t(lang, "theme.toDark")}
              toLightLabel={t(lang, "theme.toLight")}
            />
          </span>
          <span className="home-chip svika-glass">
            <LanguageToggle lang={lang} />
          </span>
        </span>
      </header>

      <HomeSheet
        openLabel={t(lang, "home.sheetOpen")}
        closeLabel={t(lang, "home.sheetClose")}
        title={t(lang, "rider.searchTitle")}
        hint={t(lang, "home.sheetHint")}
        peek={
          <>
            <form className="home-search" action="/app/plan" method="get">
              <input
                id="from"
                name="from"
                className="home-search-pill"
                placeholder={t(lang, "rider.fromPlaceholder")}
                aria-label={t(lang, "rider.fromLabel")}
                autoComplete="off"
                required
              />
              <div className="home-search-row">
                <input
                  id="to"
                  name="to"
                  className="home-search-pill"
                  placeholder={t(lang, "rider.toPlaceholder")}
                  aria-label={t(lang, "rider.toLabel")}
                  autoComplete="off"
                  required
                />
                <button
                  className="home-search-go touch-target"
                  type="submit"
                  aria-label={t(lang, "rider.planCta")}
                >
                  <ArrowIcon />
                </button>
              </div>
            </form>
            {corridorFare && corridorEta && (
              <div className="peek-stats" data-testid="peek-stats">
                <div>
                  <p className="peek-label">{t(lang, "ticket.route")}</p>
                  <p className="peek-route">{corridorFare.routes.name}</p>
                  <span className="peek-route-sub">
                    {t(lang, "home.peekFrom")} {corridorFirstStop}
                  </span>
                </div>
                <div>
                  <p className="peek-label">{t(lang, "home.peekArrives")}</p>
                  <p className="peek-mono">
                    {corridorEta.minutes} {t(lang, "common.minutes")}
                  </p>
                  <EtaBasis
                    className="peek-route-sub"
                    label={etaBasisLabel(lang, corridorEta)}
                    card={etaBasisCard(lang, corridorEta)}
                  />
                </div>
                <div>
                  <p className="peek-label">{t(lang, "ticket.fare")}</p>
                  <p className="peek-mono">{formatUsd(corridorFare.fare_cents)}</p>
                </div>
              </div>
            )}
          </>
        }
      >
        <section className="svika-card wallet-panel" data-testid="guest-why">
          <h2 className="svika-title">{t(lang, "guest.whyH")}</h2>
          <p className="svika-body">{t(lang, "guest.why")}</p>
          <Link className="cta touch-target" href="/login" data-testid="guest-signin-cta">
            {t(lang, "guest.signInCta")}
            <span className="cta-chip" aria-hidden>
              <ArrowIcon />
            </span>
          </Link>
        </section>

        <footer className="home-sheet-footer">
          <Link className="auth-link touch-target" href="/register">
            {t(lang, "register.link")}
          </Link>
          <Link className="auth-link touch-target" href="/privacy">
            {t(lang, "privacy.title")}
          </Link>
        </footer>
      </HomeSheet>
    </main>
  );
}
