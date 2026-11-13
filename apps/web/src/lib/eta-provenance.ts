// Provenance at the point of use: every rendered arrival estimate says what
// it stands on, and the label opens a small honest card explaining where the
// number comes from, how many recorded rides sit behind it, and what
// improves it. One place builds the copy so the home, the share viewer and
// any future surface stay word for word consistent.
import { tp } from "./plural";
import type { AppLanguage } from "@svika/shared";
import { t } from "./dict";
import type { EtaEstimate } from "./map/eta";

export interface EtaBasisCard {
  aria: string;
  title: string;
  lines: string[];
  close: string;
}

/** The one line label under the number: recorded rides for the real thing,
 *  the demo label for the mock twin. */
export function etaBasisLabel(lang: AppLanguage, eta: EtaEstimate): string {
  if (eta.isMock) return t(lang, "home.etaDemo");
  const key = eta.rides === 1 ? "home.etaFromRide" : "home.etaFromRides";
  return t(lang, key).replace("{count}", String(eta.rides));
}

/** The honest card behind the label. */
export function etaBasisCard(lang: AppLanguage, eta: EtaEstimate): EtaBasisCard {
  const lines = eta.isMock
    ? [t(lang, "eta.cardDemo"), t(lang, "eta.cardDemoWhen")]
    : [
        tp(lang, "eta.cardMeasured", eta.rides),
        t(lang, "eta.cardModel"),
        t(lang, "eta.cardImprove"),
      ];
  return {
    aria: t(lang, "eta.cardAria"),
    title: t(lang, "eta.cardTitle"),
    lines,
    close: t(lang, "eta.cardClose"),
  };
}
