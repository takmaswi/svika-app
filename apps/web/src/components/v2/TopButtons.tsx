"use client";

// The two round hero buttons from the launch-v2 top bar: one language
// button that flips between the live languages (the "ND coming soon" chip
// is gone, plan Step 1.7) and the day/night switch. Both write the same
// cookies the rest of the app reads.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppLanguage } from "@svika/shared";
import { LANG_COOKIE } from "@/lib/dict";
import { THEME_COOKIE, type AppTheme } from "@/lib/theme";
import { MoonV2, SunV2 } from "./icons";

const YEAR_S = 31_536_000;

export function LangButton({ lang, label }: { lang: AppLanguage; label: string }) {
  const router = useRouter();
  const next: AppLanguage = lang === "en" ? "sn" : "en";
  return (
    <button
      type="button"
      className="v2-round"
      data-testid="lang-button"
      onClick={() => {
        document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${YEAR_S}; samesite=lax`;
        router.refresh();
      }}
    >
      {/* the name starts with the visible text (WCAG 2.5.3 label in name) */}
      {lang.toUpperCase()}
      <span className="v2-sr"> {label}</span>
    </button>
  );
}

export function ThemeButton({
  initialTheme,
  toDarkLabel,
  toLightLabel,
}: {
  initialTheme: AppTheme | null;
  toDarkLabel: string;
  toLightLabel: string;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<AppTheme>(initialTheme ?? "light");
  useEffect(() => {
    if (!initialTheme && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, [initialTheme]);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="v2-round v2-theme"
      aria-label={dark ? toLightLabel : toDarkLabel}
      data-testid="theme-toggle"
      onClick={() => {
        const nextTheme: AppTheme = dark ? "light" : "dark";
        setTheme(nextTheme);
        document.documentElement.dataset.theme = nextTheme;
        document.cookie = `${THEME_COOKIE}=${nextTheme}; path=/; max-age=${YEAR_S}; samesite=lax`;
        router.refresh();
      }}
    >
      {dark ? <SunV2 /> : <MoonV2 />}
    </button>
  );
}
