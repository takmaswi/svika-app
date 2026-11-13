import Link from "next/link";
import { t } from "@/lib/i18n";
import type { AppLanguage } from "@svika/shared";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { HomeSheet } from "@/components/home/HomeSheet";
import { ArrowIcon } from "@/components/icons";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InitialAvatar } from "@/components/profile/InitialAvatar";
import { FormCheck } from "@/components/v2/FormCheck";
import type { AppTheme } from "@/lib/theme";
import type { LiveMapPlaceName } from "@/components/map/LiveMap";

export interface LaunchSavedTrip {
  id: string;
  nickname: string;
  fromStopId: string;
  to: string;
  fromName: string;
  toName: string;
}

// Launch profile home (Step 0, ruling 3): the same search and the real road,
// with no simulated kombis, no arrival estimate, no wallet and no tickets.
// Steps 3 and 7 replace this with the launch-v2 front door and personal home.
export function LaunchHome({
  lang,
  theme,
  signedIn,
  fullName,
  savedTrips,
  placeNames,
}: {
  lang: AppLanguage;
  theme: AppTheme | null;
  signedIn: boolean;
  fullName: string | null;
  savedTrips: LaunchSavedTrip[];
  placeNames: LiveMapPlaceName[];
}) {
  const toWord = t(lang, "common.to");
  return (
    <main className="home-screen" data-testid="launch-home">
      <div className="home-map">
        <LiveMapLazy
          labels={{
            ariaLabel: t(lang, "launch.mapAria"),
            demoChip: "",
            unavailable: t(lang, "map.unavailable"),
          }}
          placeNames={placeNames}
          camera="corridor"
          vehicles={false}
        />
      </div>

      <header className="home-chips">
        <span className="home-chip home-chip-brand svika-glass">
          {/* Exported wordmark, never rebuilt. */}
          <img className="wordmark" src="/wordmark.svg" alt="Svika" height={22} />
        </span>
        <span className="home-chips-right">
          {!signedIn && (
            <Link
              className="home-chip svika-glass touch-target guest-signin-chip"
              href="/login"
              data-testid="guest-signin-chip"
            >
              {t(lang, "guest.signInChip")}
            </Link>
          )}
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
          {signedIn && (
            <Link
              className="home-chip svika-glass home-chip-profile touch-target"
              href="/app/profile"
              aria-label={t(lang, "profile.open")}
              data-testid="profile-chip"
            >
              <InitialAvatar name={fullName} size="chip" />
            </Link>
          )}
        </span>
      </header>

      <HomeSheet
        openLabel={t(lang, "launch.sheetOpen")}
        closeLabel={t(lang, "home.sheetClose")}
        title={t(lang, "rider.searchTitle")}
        hint={t(lang, "home.sheetHint")}
        peek={
          <form className="home-search" action="/app/plan" method="get">
            <label className="v2-field-label v2-only" htmlFor="from">
              {t(lang, "rider.fromLabel")}
            </label>
            <input
              id="from"
              name="from"
              className="home-search-pill"
              placeholder={t(lang, "rider.fromPlaceholder")}
              aria-label={t(lang, "rider.fromLabel")}
              data-error={t(lang, "rider.fromMissing")}
              autoComplete="off"
              required
            />
            <label className="v2-field-label v2-only" htmlFor="to">
              {t(lang, "rider.toLabel")}
            </label>
            <div className="home-search-row">
              <input
                id="to"
                name="to"
                className="home-search-pill"
                placeholder={t(lang, "rider.toPlaceholder")}
                aria-label={t(lang, "rider.toLabel")}
                data-error={t(lang, "rider.toMissing")}
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
            <FormCheck fallback={t(lang, "form.fillThis")} />
          </form>
        }
      >
        <section className="svika-card wallet-panel" data-testid="launch-map-soon">
          <h2 className="svika-title">{t(lang, "launch.mapSoonH")}</h2>
          <p className="svika-body">{t(lang, "launch.mapSoon")}</p>
        </section>

        {savedTrips.length > 0 && (
          <section className="home-picks" aria-label={t(lang, "home.yourTrips")}>
            <h2 className="svika-meta tickets-heading">{t(lang, "home.yourTrips")}</h2>
            <ul className="home-pick-list">
              {savedTrips.map((trip) => (
                <li key={trip.id} className="home-pick svika-card">
                  <Link
                    className="home-pick-link touch-target"
                    href={`/app/plan?from=${trip.fromStopId}&to=${encodeURIComponent(trip.to)}`}
                  >
                    <span className="home-pick-body">
                      <span className="svika-body home-pick-name">{trip.nickname}</span>
                      <span className="svika-meta">
                        {trip.fromName} {toWord} {trip.toName}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="home-sheet-footer">
          {signedIn ? (
            <>
              <Link className="auth-link touch-target" href="/app/profile">
                {t(lang, "profile.open")}
              </Link>
              <Link className="auth-link touch-target" href="/app/privacy">
                {t(lang, "privacy.yourDataLink")}
              </Link>
            </>
          ) : (
            <Link className="auth-link touch-target" href="/privacy">
              {t(lang, "privacy.title")}
            </Link>
          )}
        </footer>
      </HomeSheet>
    </main>
  );
}
