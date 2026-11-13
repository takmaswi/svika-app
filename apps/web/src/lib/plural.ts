// Plurals from the CLDR plural rules (plan Step 1.8: never "1 kombis").
//
// Every count phrase lives in the translation file (lib/dict.ts) twice: the
// "other" form under its key and the "one" form under `<key>.one`. Whole
// phrases, because Shona changes the noun class prefix rather than adding
// a suffix ("kombi 1", "makombi 3"). English and Shona share the CLDR rule
// (one for exactly 1), read here from Intl.PluralRules rather than assumed.
import type { AppLanguage } from "@svika/shared";
import { dict, t, type DictKey } from "./dict";

const rules = new Map<AppLanguage, Intl.PluralRules>();
function ruleFor(lang: AppLanguage): Intl.PluralRules {
  let r = rules.get(lang);
  if (!r) {
    r = new Intl.PluralRules(lang);
    rules.set(lang, r);
  }
  return r;
}

/** The dict key for this count: `<key>.one` when the rule says one and it exists. */
export function pluralKey(lang: AppLanguage, key: DictKey, count: number): DictKey {
  const one = `${key}.one`;
  return ruleFor(lang).select(count) === "one" && one in dict ? (one as DictKey) : key;
}

/** "1 kombi", "3 kombis", "kombi 1", "makombi 3". */
export function tp(lang: AppLanguage, key: DictKey, count: number): string {
  return t(lang, pluralKey(lang, key, count)).replaceAll("{count}", String(count));
}

/** The phrase split around its number, so the count can sit in mono. */
export function tpParts(
  lang: AppLanguage,
  key: DictKey,
  count: number,
): [string, string] {
  const [before = "", after = ""] = t(lang, pluralKey(lang, key, count)).split(
    "{count}",
  );
  return [before, after];
}

/**
 * For client components handed both forms by the server: true when the
 * live languages say "one" (English and Shona share the CLDR rule).
 */
export function isOne(count: number): boolean {
  return ruleFor("en").select(count) === "one";
}
