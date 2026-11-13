import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { CONSENT_VERSION, hasActiveConsent, type ConsentRecord } from "@svika/shared";
import { acceptConsent } from "@/lib/actions";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SignOutButton } from "@/components/SignOutButton";
import { ArrowIcon } from "@/components/icons";

// First use consent. The /app layout redirects here until the latest consent
// record says accepted; accepting appends that record and opens the app.
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("consent_records")
    .select("action, created_at")
    .eq("version", CONSENT_VERSION);
  if (hasActiveConsent((data ?? []) as ConsentRecord[])) redirect("/app");

  const usernameAccount = user.user_metadata?.account === "username";
  const points = [
    usernameAccount ? "consent.point1Username" : "consent.point1",
    "consent.point2",
    "consent.point3",
    "consent.point4",
  ] as const;

  return (
    <main className="shell">
      <header className="shell-top">
        <img className="wordmark" src="/wordmark.svg" alt="Svika" height={24} />
        <LanguageToggle lang={lang} />
      </header>

      <section className="svika-card wallet-panel svika-animate-fade-up">
        <h1 className="svika-headline">{t(lang, "consent.title")}</h1>
        <p className="svika-body">{t(lang, "consent.intro")}</p>
        <ul className="consent-points">
          {points.map((key) => (
            <li key={key} className="svika-body">
              {t(lang, key)}
            </li>
          ))}
        </ul>
        <Link className="inline-link" href="/privacy">
          {t(lang, "consent.noticeLink")}
        </Link>
        {params.err === "1" && (
          <p className="auth-error svika-body">{t(lang, "consent.err")}</p>
        )}
        <form action={acceptConsent}>
          <button
            className="cta touch-target"
            type="submit"
            data-testid="consent-accept"
          >
            {t(lang, "consent.accept")}
            <span className="cta-chip" aria-hidden>
              <ArrowIcon />
            </span>
          </button>
        </form>
        <p className="svika-meta">{t(lang, "consent.declineHint")}</p>
        <SignOutButton label={t(lang, "app.signOut")} />
      </section>
    </main>
  );
}
