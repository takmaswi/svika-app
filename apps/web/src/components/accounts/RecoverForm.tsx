"use client";

// Recovery (launch Step 2.3): the username plus the saved code sets a new
// password. The old code dies with the reset and a new one is shown once.
import { useState, type FormEvent } from "react";
import type { AppLanguage } from "@svika/shared";
import { t } from "@/lib/dict";
import { adoptSession, callAccounts, errorText } from "@/lib/accounts/client";
import { FormCheck } from "@/components/v2/FormCheck";
import { CtaPill } from "@/components/v2/parts";
import { PasswordField } from "./PasswordField";
import { RecoveryCodeView } from "./RecoveryCodeView";
import { ServerError } from "./ServerError";
import { AccountShell, type ShellText } from "./AccountShell";

export function RecoverForm({ lang, shell }: { lang: AppLanguage; shell: ShellText }) {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ username: string; code: string } | null>(null);

  // the code screen stands alone, with no hero (approved Recovery-Code)
  if (done) {
    return (
      <RecoveryCodeView lang={lang} username={done.username} code={done.code} reset />
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const clean = username.trim().toLowerCase();
    const r = await callAccounts({
      action: "recover",
      username: clean,
      code,
      new_password: password,
    });
    if (!r.ok || !r.session || !r.recovery_code || !(await adoptSession(r.session))) {
      setError(r.ok ? t(lang, "acct.failed") : errorText(lang, r.error, r.retry_after));
      setBusy(false);
      return;
    }
    setDone({ username: r.username ?? clean, code: r.recovery_code });
  }

  return (
    <AccountShell {...shell}>
      <form
        className="v2-form v2-account-form v2-rise"
        onSubmit={submit}
        data-testid="recover-form"
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
        <div className="v2-field">
          <label className="v2-field-label" htmlFor="code">
            {t(lang, "acct.codeLabel")}
          </label>
          <input
            id="code"
            name="code"
            className="v2-input v2-input-code"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            pattern="[A-Za-z0-9 \-]{12,16}"
            maxLength={16}
            data-error={t(lang, "acct.codeMissing")}
          />
        </div>
        <PasswordField
          lang={lang}
          id="new-password"
          name="new_password"
          label={t(lang, "acct.newPassword")}
          autoComplete="new-password"
          meter
          value={password}
          onChange={setPassword}
        />
        <FormCheck fallback={t(lang, "acct.pwShort")} />
        <ServerError message={error} />
        <CtaPill testId="recover-submit" disabled={busy}>
          {t(lang, "acct.recoverCta")}
        </CtaPill>
      </form>
    </AccountShell>
  );
}
