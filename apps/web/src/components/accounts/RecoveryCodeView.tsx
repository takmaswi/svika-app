"use client";

// The approved Recovery-Code screen: shown once, right after sign up or a
// reset. The code is never stored on the phone by Svika; Copy and Save as
// photo are the rider's own choice.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppLanguage } from "@svika/shared";
import { t } from "@/lib/dict";
import { codeGroups } from "@/lib/accounts/format";
import { ShieldV2 } from "@/components/v2/icons";
import { CtaPill } from "@/components/v2/parts";

/** A plain PNG of the code, drawn on a canvas, for "Save as photo". */
function codePhoto(username: string, code: string, label: string): string {
  const c = document.createElement("canvas");
  c.width = 720;
  c.height = 360;
  const g = c.getContext("2d")!;
  g.fillStyle = "#161D18";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "rgba(255,255,255,0.62)";
  g.font = "700 22px 'IBM Plex Sans', sans-serif";
  g.textAlign = "center";
  g.fillText(`${label.toUpperCase()} · ${username}`, 360, 120);
  g.fillStyle = "#F5B301";
  g.font = "600 56px 'IBM Plex Mono', monospace";
  g.fillText(codeGroups(code).join("  "), 360, 210);
  return c.toDataURL("image/png");
}

export function RecoveryCodeView({
  lang,
  username,
  code,
  reset,
}: {
  lang: AppLanguage;
  username: string;
  code: string;
  reset?: boolean;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const groups = codeGroups(code);
  const label = t(lang, "acct.codeLabel");
  return (
    <main className="v2-screen v2-code-screen" data-testid="recovery-code-screen">
      <div className="v2-rise v2-code-head">
        <span className="v2-code-badge" aria-hidden>
          <ShieldV2 size={24} />
        </span>
        <h1 className="v2-code-title">
          {t(lang, reset ? "acct.resetTitle" : "acct.readyTitle").replace(
            "{name}",
            username,
          )}
        </h1>
        <span className="v2-code-body">{t(lang, "acct.codeBody")}</span>
      </div>
      <div className="v2-rise v2-code-card">
        <span className="v2-code-label">{label}</span>
        <span
          className="v2-code"
          data-testid="recovery-code"
          aria-label={`${label}: ${groups.join(" ")}`}
        >
          {groups.map((g) => (
            <span key={g}>{g}</span>
          ))}
        </span>
        <div className="v2-code-actions">
          <button
            type="button"
            className="v2-code-btn"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(groups.join("-"))
                .then(() => setCopied(true));
            }}
          >
            {t(lang, copied ? "acct.copied" : "acct.copy")}
          </button>
          <a
            className="v2-code-btn"
            download={`svika-recovery-${username}.png`}
            href="#"
            onClick={(e) => {
              e.currentTarget.href = codePhoto(username, code, label);
            }}
          >
            {t(lang, "acct.savePhoto")}
          </a>
        </div>
      </div>
      <ol className="v2-rise v2-tips">
        <li>
          <span className="v2-tip-n" aria-hidden>
            1
          </span>
          {t(lang, "acct.tip1")}
        </li>
        <li>
          <span className="v2-tip-n" aria-hidden>
            2
          </span>
          {t(lang, "acct.tip2")}
        </li>
      </ol>
      <div className="v2-code-cta">
        <CtaPill
          type="button"
          testId="recovery-saved"
          onClick={() => router.push("/app")}
        >
          {t(lang, "acct.saved")}
        </CtaPill>
      </div>
    </main>
  );
}
