import Link from "next/link";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { LoginForm } from "@/components/LoginForm";
import { LanguageToggle } from "@/components/LanguageToggle";
import { flagOn } from "@/lib/flags-server";
import { AccountShell } from "@/components/accounts/AccountShell";
import { SignInForm } from "@/components/accounts/SignInForm";

// The wall moments (batch V2) arrive here carrying ?why=pay|save|record so
// the prompt says exactly which moment needed identity, above the general
// promise. ?next brings the rider back to where they were; only same site
// paths are honoured (never an off site redirect).
const WHY_KEY: Record<string, DictKey> = {
  pay: "guest.why.pay",
  save: "guest.why.save",
  record: "guest.why.record",
  name: "guest.why.name",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const why = typeof params.why === "string" ? (WHY_KEY[params.why] ?? null) : null;
  const nextRaw = typeof params.next === "string" ? params.next : "";
  const nextPath = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/app";

  // Launch Step 2: username sign in for everyone. Phone OTP stays only for
  // test and owner accounts (plan 2.4), at ?method=phone, linked from nowhere.
  if ((await flagOn("accounts")) && params.method !== "phone") {
    return (
      <AccountShell
        title={t(lang, "acct.signInTitle")}
        body={why ? t(lang, why) : t(lang, "acct.signInBody")}
        backHref="/app"
        backLabel={t(lang, "common.back")}
      >
        <SignInForm lang={lang} nextPath={nextPath} />
      </AccountShell>
    );
  }

  return (
    <main className="auth">
      <header className="auth-top">
        <Link href="/">
          <img className="wordmark" src="/wordmark.svg" alt="Svika" height={24} />
        </Link>
        <LanguageToggle lang={lang} />
      </header>
      {(why || nextRaw) && (
        <section className="svika-card auth-why svika-animate-fade-up" data-testid="login-why">
          {why && <p className="svika-body auth-why-line">{t(lang, why)}</p>}
          <p className="svika-meta">{t(lang, "guest.why")}</p>
        </section>
      )}
      <LoginForm lang={lang} nextPath={nextPath} />
    </main>
  );
}
