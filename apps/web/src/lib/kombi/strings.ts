// The kombi card and board strings, resolved server side in the app
// language so the client components stay dictionary free (the standing
// pattern: components receive words, never keys).
import type { AppLanguage } from "@svika/shared";
import { t } from "../dict";

export interface KombiStrings {
  markerTap: string;
  towards: string;
  arrives: string;
  away: string;
  seats: string;
  seatsUnknown: string;
  plateUnknown: string;
  trustTitle: string;
  trustChip: { unverified: string; verified: string; drift: string };
  trustNone: string;
  trustFares: string;
  trustDriftLine: string;
  trustLaw: string;
  provenance: string;
  demoChip: string;
  etaDemo: string;
  etaFromRide: string;
  etaFromRides: string;
  minutes: string;
  boardCta: string;
  boardTitle: string;
  boardBack: string;
  close: string;
}

export function kombiStrings(lang: AppLanguage): KombiStrings {
  return {
    markerTap: t(lang, "kombi.markerTap"),
    towards: t(lang, "kombi.towards"),
    arrives: t(lang, "kombi.arrives"),
    away: t(lang, "kombi.away"),
    seats: t(lang, "kombi.seats"),
    seatsUnknown: t(lang, "kombi.seatsUnknown"),
    plateUnknown: t(lang, "kombi.plateUnknown"),
    trustTitle: t(lang, "kombi.trustTitle"),
    trustChip: {
      unverified: t(lang, "kombi.trustUnverified"),
      verified: t(lang, "kombi.trustVerified"),
      drift: t(lang, "kombi.trustDrift"),
    },
    trustNone: t(lang, "kombi.trustNone"),
    trustFares: t(lang, "kombi.trustFares"),
    trustDriftLine: t(lang, "kombi.trustDriftLine"),
    trustLaw: t(lang, "kombi.trustLaw"),
    provenance: t(lang, "kombi.provenance"),
    demoChip: t(lang, "map.demoChip"),
    etaDemo: t(lang, "home.etaDemo"),
    etaFromRide: t(lang, "home.etaFromRide"),
    etaFromRides: t(lang, "home.etaFromRides"),
    minutes: t(lang, "common.minutes"),
    boardCta: t(lang, "kombi.boardCta"),
    boardTitle: t(lang, "kombi.boardTitle"),
    boardBack: t(lang, "kombi.boardBack"),
    close: t(lang, "eta.cardClose"),
  };
}
