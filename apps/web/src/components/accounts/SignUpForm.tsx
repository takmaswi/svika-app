"use client";

// Sign up (launch Step 2, ruling 4): a username and a password, nothing
// else. The availability line under the username is the account function's
// answer, debounced; the recovery code screen follows on success.
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { AppLanguage } from "@svika/shared";
import { t, type DictKey } from "@/lib/dict";
import {
  adoptSession,
  callAccounts,
  errorKey,
  type NameState,
} from "@/lib/accounts/client";
import { FormCheck } from "@/components/v2/FormCheck";
import { CtaPill } from "@/components/v2/parts";
import { ShieldV2 } from "@/components/v2/icons";
import { PasswordField } from "./PasswordField";
import { RecoveryCodeView } from "./RecoveryCodeView";
import { ServerError } from "./ServerError";
import { AccountShell, type ShellText } from "./AccountShell";

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
const NAME_HELP: Record<NameState, DictKey> = {
  free: "acct.nameFree",
  taken: "acct.nameTaken",
  blocked: "acct.nameBlocked",
  invalid: "acct.nameRules",
};

export function SignUpForm({ lang, shell }: { lang: AppLanguage; shell: ShellText }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nameState, setNameState] = useState<NameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ username: string; code: string } | null>(null);

  const clean = username.trim().toLowerCase();
  useEffect(() => {
    setNameState(null);
    if (clean.length < 3) return;
    if (!USERNAME_RE.test(clean)) {
      setNameState("invalid");
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      const r = await callAccounts({ action: "check_username", username: clean });
      if (live && r.ok && r.state) setNameState(r.state);
    }, 450);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [clean]);

  // the code screen stands alone, with no hero (approved Recovery-Code)
  if (done)
    return <RecoveryCodeView lang={lang} username={done.username} code={done.code} />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await callAccounts({ action: "sign_up", username: clean, password });
    if (!r.ok) {
      if (r.error === "username_taken") setNameState("taken");
      setError(t(lang, errorKey(r.error)));
      setBusy(false);
      return;
    }
    if (!r.session || !r.recovery_code || !(await adoptSession(r.session))) {
      setError(t(lang, "acct.failed"));
      setBusy(false);
      return;
    }
    setDone({ username: r.username ?? clean, code: r.recovery_code });
  }

  const nameOk = nameState === "free";
  return (
    <AccountShell {...shell}>
      <form
        className="v2-form v2-account-form v2-rise"
        onSubmit={submit}
        data-testid="signup-form"
      >
        <div className="v2-field">
          <label className="v2-field-label" htmlFor="username">
            {t(lang, "acct.username")}
          </label>
          <input
            id="username"
            name="username"
            className="v2-input"
            data-state={nameOk ? "ok" : undefined}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            pattern="[A-Za-z0-9_.]{3,20}"
            maxLength={20}
            aria-describedby="username-help"
            data-error={t(lang, "acct.nameRules")}
          />
          <span
            id="username-help"
            className={`v2-help${nameOk ? " v2-help-ok" : ""}`}
            aria-live="polite"
            data-testid="username-help"
          >
            {t(lang, nameState ? NAME_HELP[nameState] : "acct.nameRules")}
          </span>
        </div>
        <PasswordField
          lang={lang}
          id="password"
          name="password"
          label={t(lang, "acct.password")}
          autoComplete="new-password"
          meter
          value={password}
          onChange={setPassword}
        />
        <div className="v2-notice">
          <span className="v2-notice-icon" aria-hidden>
            <ShieldV2 />
          </span>
          <span>{t(lang, "acct.notice")}</span>
        </div>
        <FormCheck fallback={t(lang, "acct.pwShort")} />
        <ServerError message={error} />
        <CtaPill testId="signup-submit" disabled={busy}>
          {t(lang, "acct.create")}
        </CtaPill>
        <Link className="v2-textlink" href="/login">
          {t(lang, "acct.haveAccount")}
        </Link>
      </form>
    </AccountShell>
  );
}
