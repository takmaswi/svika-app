// The approved Home-Final front door (launch-v2, plan Step 3.1): the
// marigold hero with the drawn kombi, one search card, quick places, the
// record tile, the live map slot that honestly says coming soon, and the
// bottom bar. Action first: nothing here asks for an account (ruling 5).
// "Ranks near you" and the Ranks tab join with the rank directory (Step 4);
// "Guide a friend" with directions (Step 8), each behind its own flag.
import Link from "next/link";
import type { AppLanguage } from "@svika/shared";
import { t } from "@/lib/i18n";
import type { AppTheme } from "@/lib/theme";
import { dayPart, harareHour, QUICK_PLACES } from "@/lib/door/greeting";
import { BottomNav, BrandPill, HeroKombi, MapSlot } from "@/components/v2/parts";
import { ArrowV2, PinV2, SearchV2 } from "@/components/v2/icons";
import { ThemeButton } from "@/components/v2/TopButtons";
import { LanguageToggle } from "@/components/LanguageToggle";
import { InitialAvatar } from "@/components/profile/InitialAvatar";
import { QuickChips } from "./QuickChips";

const GREETING = {
  morning: "door.greetMorning",
  afternoon: "door.greetAfternoon",
  evening: "door.greetEvening",
} as const;

export function FrontDoor({
  lang,
  theme,
  signedIn,
  fullName,
  guide,
}: {
  lang: AppLanguage;
  theme: AppTheme | null;
  signedIn: boolean;
  fullName: string | null;
  /** Step 8's "Guide a friend" tile, shown only once directions exist. */
  guide: boolean;
}) {
  const greeting = t(lang, GREETING[dayPart(harareHour(new Date()))]);
  return (
    <main className="v2-screen" data-testid="front-door">
      <div className="v2-hero">
        <header className="v2-topbar v2-rise">
          <BrandPill />
          <span className="v2-topbar-actions">
            <LanguageToggle lang={lang} />
            <ThemeButton
              initialTheme={theme}
              toDarkLabel={t(lang, "theme.toDark")}
              toLightLabel={t(lang, "theme.toLight")}
            />
            {signedIn ? (
              <Link
                className="v2-round"
                href="/app/profile"
                aria-label={t(lang, "profile.open")}
                data-testid="profile-chip"
              >
                <InitialAvatar name={fullName} size="chip" />
              </Link>
            ) : (
              <Link className="v2-signin" href="/login" data-testid="guest-signin-chip">
                {t(lang, "guest.signInChip")}
              </Link>
            )}
          </span>
        </header>
        <div className="v2-hero-copy v2-rise v2-d1">
          <span className="v2-hero-kicker">{greeting}</span>
          <h1 className="v2-hero-h1">{t(lang, "door.title")}</h1>
        </div>
        <HeroKombi label={t(lang, "door.kombi")} />
      </div>

      <div className="v2-search-wrap v2-rise v2-d2">
        <Link className="v2-search" href="/app/where" data-testid="door-search">
          <SearchV2 />
          <span className="v2-search-text">
            <span className="v2-search-main">{t(lang, "door.search")}</span>
            <span className="v2-search-sub">{t(lang, "door.searchSub")}</span>
          </span>
          <span className="v2-go" aria-hidden>
            <ArrowV2 />
          </span>
        </Link>
      </div>

      <QuickChips places={QUICK_PLACES} label={t(lang, "door.quick")} />

      <section className="v2-tiles v2-rise v2-d3">
        <Link
          className={`v2-tile v2-tile-a${guide ? "" : " v2-span2"}`}
          href={signedIn ? "/app/record" : "/login?why=record"}
          data-testid="door-record"
        >
          <span className="v2-tile-badge" aria-hidden>
            <span className="v2-live-dot v2-pulse" />
          </span>
          <span className="v2-tile-copy">
            <span className="v2-tile-title">{t(lang, "door.recordTitle")}</span>
            <span className="v2-tile-sub">{t(lang, "door.recordSub")}</span>
          </span>
        </Link>
        {guide && (
          <Link
            className="v2-tile v2-tile-b"
            href="/app/where"
            data-testid="door-guide"
          >
            <span className="v2-tile-badge" aria-hidden>
              <PinV2 />
            </span>
            <span className="v2-tile-copy">
              <span className="v2-tile-title">{t(lang, "door.guideTitle")}</span>
              <span className="v2-tile-sub">{t(lang, "door.guideSub")}</span>
            </span>
          </Link>
        )}
        <MapSlot
          badge={t(lang, "door.soonBadge")}
          title={t(lang, "door.soonTitle")}
          sub={t(lang, "launch.mapSoon")}
        />
      </section>

      <BottomNav
        active="plan"
        labels={{
          plan: t(lang, "nav.plan"),
          ranks: t(lang, "nav.ranks"),
          me: t(lang, "nav.me"),
        }}
        meHref={signedIn ? "/app/profile" : "/login"}
        label={t(lang, "nav.primary")}
        tabs={["plan", "me"]}
      />
    </main>
  );
}
