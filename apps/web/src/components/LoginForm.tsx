"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppLanguage } from "@svika/shared";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/dict";
import { ArrowIcon } from "@/components/icons";

type Phase = "phone" | "code";

// Zimbabwe numbers reach here as +263..., but accept any E.164-shaped input and
// let Supabase do the authoritative check.
const E164 = /^\+[1-9]\d{6,14}$/;

export function LoginForm({
  lang,
  nextPath = "/app",
}: {
  lang: AppLanguage;
  nextPath?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [phase, setPhase] = useState<Phase>("phone");
  const [phone, setPhone] = useState("+263");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!E164.test(phone)) {
      setError(t(lang, "login.errPhone"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (error) {
      setError(t(lang, "login.errPhone"));
      return;
    }
    setPhase("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
    setBusy(false);
    if (error) {
      setError(t(lang, "login.errCode"));
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <div className="auth-card svika-card svika-animate-fade-up">
      <h1 className="svika-headline">{t(lang, "login.title")}</h1>

      {phase === "phone" ? (
        <form onSubmit={sendCode} className="auth-form">
          <label className="svika-meta" htmlFor="phone">
            {t(lang, "login.phoneLabel")}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            className="auth-input svika-mono-code"
            value={phone}
            onChange={(e) => setPhone(e.target.value.trim())}
          />
          <button className="cta touch-target" disabled={busy}>
            {busy ? t(lang, "login.sending") : t(lang, "login.send")}
            <span className="cta-chip" aria-hidden>
              <ArrowIcon />
            </span>
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="auth-form">
          <p className="svika-body">
            {t(lang, "login.codeSentTo")}{" "}
            <strong className="svika-mono-code">{phone}</strong>
          </p>
          <label className="svika-meta" htmlFor="code">
            {t(lang, "login.codeLabel")}
          </label>
          <input
            id="code"
            name="code"
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            className="auth-input auth-code svika-mono-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button className="cta touch-target" disabled={busy}>
            {busy ? t(lang, "login.verifying") : t(lang, "login.verify")}
            <span className="cta-chip" aria-hidden>
              <ArrowIcon />
            </span>
          </button>
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setPhase("phone");
              setCode("");
              setError(null);
            }}
          >
            {t(lang, "login.resend")}
          </button>
        </form>
      )}

      {error && (
        <p className="auth-error svika-body" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
