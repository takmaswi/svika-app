import Link from "next/link";
import { getLang, t } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BackIcon } from "@/components/icons";
import {
  DISCLOSURE_ROWS,
  LAUNCH_DISCLOSURE_ROWS,
  DISCLOSURE_UPDATED,
  type DisclosureTier,
} from "@/lib/disclosure";
import { REPO_URL } from "@/lib/site";
import { flagOn } from "@/lib/flags-server";

// The disclosure register on screen: what is real and what is staged, feature
// by feature, for a judge to open before or during the demo. Public, readable
// without signing in. The rows mirror docs/DISCLOSURE-REGISTER.md; the tier
// chips are the honesty split the whole product is built around.
export default async function RegisterPage() {
  const lang = await getLang();
  const launch = await flagOn("launch");
  const rows = launch ? LAUNCH_DISCLOSURE_ROWS : DISCLOSURE_ROWS;
  const tierLabel = (tier: DisclosureTier): string =>
    tier === 1 ? t(lang, "register.tier1") : t(lang, "register.tier2");

  return (
    <main className="shell">
      <header className="shell-top">
        <Link href="/" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <LanguageToggle lang={lang} />
      </header>

      <section className="svika-card wallet-panel svika-animate-fade-up">
        <h1 className="svika-headline">{t(lang, "register.title")}</h1>
        <p className="svika-body register-intro">{t(lang, launch ? "register.launchIntro" : "register.intro")}</p>

        <div className="register-legend">
          <p className="register-legend-row">
            <span className="tier-chip tier-chip-1">{t(lang, "register.tier1")}</span>
            <span className="svika-meta">{t(lang, "register.tier1Note")}</span>
          </p>
          {!launch && (
            <p className="register-legend-row">
              <span className="tier-chip tier-chip-2">{t(lang, "register.tier2")}</span>
              <span className="svika-meta">{t(lang, "register.tier2Note")}</span>
            </p>
          )}
        </div>

        <ul className="register-list">
          {rows.map((row) => (
            <li key={row.feature} className="register-row">
              <div className="register-row-head">
                <h2 className="svika-title register-feature">{row.feature}</h2>
                <span
                  className={`tier-chip tier-chip-${row.tier}`}
                  aria-label={tierLabel(row.tier)}
                >
                  {row.tier === 1 ? "1" : "2"}
                </span>
              </div>
              <p className="svika-body register-detail">{row.detail}</p>
            </li>
          ))}
        </ul>

        <p className="svika-meta register-updated">
          {t(lang, "register.updated")}:{" "}
          <span className="svika-mono-code">{DISCLOSURE_UPDATED}</span>
        </p>

        <p className="svika-meta register-repo">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            data-testid="repo-link"
          >
            {t(lang, "repo.link")}
          </a>
        </p>
      </section>
    </main>
  );
}
