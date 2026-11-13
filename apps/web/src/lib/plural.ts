// Plurals from the i18n plural rules (plan Step 1.8: never "1 kombis").
// Each entry gives the CLDR "one" and "other" forms per language; Shona
// noun classes change the prefix, not a suffix ("kombi imwe", "makombi 3"),
// which is why whole phrases live here, not a bolted on "s".
import type { AppLanguage } from "@svika/shared";

type Forms = { one: string; other: string };
type PluralEntry = { en: Forms; sn: Forms };

export const plurals = {
  kombis: {
    en: { one: "{count} kombi", other: "{count} kombis" },
    sn: { one: "kombi {count}", other: "makombi {count}" },
  },
  riders: {
    en: { one: "{count} rider", other: "{count} riders" },
    sn: { one: "mutasvi {count}", other: "vatasvi {count}" },
  },
  minutes: {
    en: { one: "{count} min", other: "{count} min" },
    sn: { one: "{count} min", other: "{count} min" },
  },
  minWalk: {
    en: { one: "{count} min walk", other: "{count} min walk" },
    sn: { one: "kufamba {count} min", other: "kufamba {count} min" },
  },
  reports: {
    en: { one: "{count} report", other: "{count} reports" },
    sn: { one: "mushumo {count}", other: "mishumo {count}" },
  },
  confirmations: {
    en: { one: "{count} rider boarded here this week", other: "{count} riders boarded here this week" },
    sn: { one: "mutasvi {count} akakwira pano svondo rino", other: "vatasvi {count} vakakwira pano svondo rino" },
  },
  fixesLive: {
    en: { one: "{count} of your fixes is live", other: "{count} of your fixes are live" },
    sn: { one: "kugadzirisa kwako {count} kuri kushanda", other: "kugadzirisa kwako {count} kuri kushanda" },
  },
  helped: {
    en: { one: "You helped {count} rider this week", other: "You helped {count} riders this week" },
    sn: { one: "Wabatsira mutasvi {count} svondo rino", other: "Wabatsira vatasvi {count} svondo rino" },
  },
  moreToQualify: {
    en: {
      one: "{count} more contribution to qualify for this week's reward",
      other: "{count} more contributions to qualify for this week's reward",
    },
    sn: {
      one: "Wasara nechipo {count} kuti upinde mumubairo wesvondo rino",
      other: "Wasara nezvipo {count} kuti upinde mumubairo wesvondo rino",
    },
  },
  boardings: {
    en: { one: "{count} kombi", other: "{count} kombis" },
    sn: { one: "kombi {count}", other: "makombi {count}" },
  },
} as const satisfies Record<string, PluralEntry>;

export type PluralKey = keyof typeof plurals;

const rules = new Map<AppLanguage, Intl.PluralRules>();
function ruleFor(lang: AppLanguage): Intl.PluralRules {
  let r = rules.get(lang);
  if (!r) {
    r = new Intl.PluralRules(lang === "sn" ? "sn" : "en");
    rules.set(lang, r);
  }
  return r;
}

/** "1 kombi", "3 kombis"; Shona and English from the CLDR plural rules. */
export function tp(lang: AppLanguage, key: PluralKey, count: number): string {
  const forms: Forms = plurals[key][lang];
  const category = ruleFor(lang).select(count) === "one" ? "one" : "other";
  return forms[category].replaceAll("{count}", String(count));
}
