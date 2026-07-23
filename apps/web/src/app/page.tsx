import Link from "next/link";
import { getLang, t } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { ArrowIcon } from "@/components/icons";
import { REPO_URL } from "@/lib/site";

// The front door (screen 1 grammar): the Kombi highlight headline, the live
// map grown into the hero, one primary CTA into sign in, and the quiet
// register/privacy/repo footer. No theatre.
export default async function LandingPage() {
  const lang = await getLang();

  return (
    <main className="landing">
      <header className="landing-top">
        {/* Exported wordmark, never rebuilt. */}
        <img className="wordmark" src="/wordmark.svg" alt="Svika" height={24} />
        <LanguageToggle lang={lang} />
      </header>

      <h1 className="landing-h1">
        <span className="landing-h1-line svika-animate-fade-up">
          {t(lang, "landing.headline1")}
        </span>
        {/* The marigold Hiace behind the word (DESIGN.md §10), verbatim. */}
        <span className="kombi-hl svika-drive">
          <svg
            className="kombi-hl-svg"
            viewBox="0 0 200 62"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d="M6 62 L6 20 Q6 5 22 5 L130 5 Q145 5 154 14 L186 40 Q200 48 200 56 L200 62 Z"
              fill="#F5B301"
            />
            <path
              d="M156 14 L161 14 Q167 15 171 20 L182 33 L156 33 Q153 33 153 27 L153 17 Q153 14 156 14 Z"
              fill="#161D18"
              opacity="0.8"
            />
          </svg>
          <span className="kombi-hl-word">{t(lang, "landing.headlineWord")}</span>
          <span className="kombi-hl-wheel kombi-hl-wheel-front" aria-hidden />
          <span className="kombi-hl-wheel kombi-hl-wheel-back" aria-hidden />
        </span>
      </h1>

      <p className="landing-body svika-animate-fade-up svika-rise-3">
        {t(lang, "landing.body")}
      </p>

      {/* The live map is the hero: the network moving right now, with its
          provenance chip, before a single word of persuasion. */}
      <div className="landing-map landing-map-hero svika-animate-fade-up svika-rise-4">
        <LiveMapLazy
          labels={{
            ariaLabel: t(lang, "map.ariaLabel"),
            demoChip: t(lang, "map.demoChip"),
            unavailable: t(lang, "map.unavailable"),
          }}
        />
      </div>

      <Link
        className="cta touch-target landing-cta svika-animate-fade-up svika-rise-5"
        href="/login"
        data-testid="landing-cta"
      >
        {t(lang, "landing.cta")}
        <span className="cta-chip" aria-hidden>
          <ArrowIcon />
        </span>
      </Link>
      <p className="landing-signin svika-animate-fade-up svika-rise-6">
        {t(lang, "landing.signinHint")}{" "}
        <Link href="/login">{t(lang, "landing.signinLink")}</Link>
      </p>

      <footer className="landing-foot svika-animate-fade-up svika-rise-7">
        <Link href="/register" data-testid="register-link">
          {t(lang, "register.link")}
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacy">{t(lang, "privacy.title")}</Link>
        <span aria-hidden>·</span>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          data-testid="repo-link"
        >
          {t(lang, "repo.link")}
        </a>
      </footer>
    </main>
  );
}
