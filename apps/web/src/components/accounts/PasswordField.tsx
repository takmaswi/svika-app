"use client";

// Password with Show/Hide and, on sign up, the four bar strength meter of
// the approved Sign-Up screen. The meter only informs; the rules live in
// the account function.
import { useState } from "react";
import type { AppLanguage } from "@svika/shared";
import { t } from "@/lib/dict";
import { strength } from "@/lib/accounts/format";

export function PasswordField({
  lang,
  id,
  name,
  label,
  autoComplete,
  meter,
  value,
  onChange,
  invalid,
}: {
  lang: AppLanguage;
  id: string;
  name: string;
  label: string;
  autoComplete: "new-password" | "current-password";
  meter?: boolean;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const bars = strength(value);
  const helpId = `${id}-help`;
  return (
    <div className="v2-field">
      <label className="v2-field-label" htmlFor={id}>
        {label}
      </label>
      <span className="v2-input-wrap">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          className="v2-input v2-input-pw"
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid ? "true" : undefined}
          aria-describedby={meter ? helpId : undefined}
          required
          minLength={8}
          maxLength={72}
        />
        <button
          type="button"
          className="v2-input-action"
          aria-pressed={shown}
          aria-controls={id}
          onClick={() => setShown((s) => !s)}
        >
          {t(lang, shown ? "acct.hide" : "acct.show")}
        </button>
      </span>
      {meter && (
        <>
          <span className="v2-meter" aria-hidden>
            {[1, 2, 3, 4].map((n) => (
              <span key={n} data-on={n <= bars ? "true" : "false"} />
            ))}
          </span>
          <span id={helpId} className="v2-help">
            {t(lang, value.length >= 8 ? "acct.pwGood" : "acct.pwShort")}
          </span>
        </>
      )}
    </div>
  );
}
