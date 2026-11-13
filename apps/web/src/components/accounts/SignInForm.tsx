"use client";

// Username sign in (launch Step 2). The same answer for an unknown username
// and a wrong password; five misses in 15 minutes locks the username.
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AppLanguage } from "@svika/shared";
import { t } from "@/lib/dict";
import { adoptSession, callAccounts, errorKey } from "@/lib/accounts/client";
import { FormCheck } from "@/components/v2/FormCheck";
import { CtaPill } from "@/components/v2/parts";
import { PasswordField } from "./PasswordField";
import { ServerError } from "./ServerError";

export function SignInForm({
  lang,
  nextPath,
}: {
  lang: AppLanguage;
  nextPath: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await callAccounts({
      action: "sign_in",
      username: username.trim().toLowerCase(),
      password,
    });
    if (!r.ok || !r.session || !(await adoptSession(r.session))) {
      setError(t(lang, r.ok ? "acct.failed" : errorKey(r.error)));
      setBusy(false);
      return;
    }
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form
      className="v2-form v2-account-form v2-rise"
      onSubmit={submit}
      data-testid="signin-form"
    >
      <div className="v2-field">
        <label className="v2-field-label" htmlFor="username">
          {t(lang, "acct.username")}
        </label>
        <input
          id="username"
          name="username"
          className="v2-input"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          maxLength={20}
          data-error={t(lang, "acct.nameMissing")}
        />
      </div>
      <PasswordField
        lang={lang}
        id="password"
        name="password"
        label={t(lang, "acct.password")}
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      <FormCheck fallback={t(lang, "acct.pwShort")} />
      <ServerError message={error} />
      <CtaPill testId="signin-submit" disabled={busy}>
        {t(lang, "acct.signIn")}
      </CtaPill>
      <div className="v2-account-links">
        <Link className="v2-textlink" href="/recover">
          {t(lang, "acct.forgot")}
        </Link>
        <Link className="v2-textlink" href="/signup">
          {t(lang, "acct.newAccount")}
        </Link>
      </div>
    </form>
  );
}
