// Every hwindi facing string, Shona first (the surface defaults to Shona and
// toggles to English). No hardcoded copy in components.
export type Lang = "sn" | "en";

type Entry = { en: string; sn: string };

export const dict = {
  "app.brand": { en: "SVIKA · HWINDI", sn: "SVIKA · HWINDI" },

  "signin.title": { en: "Sign in", sn: "Pinda" },
  "signin.email": { en: "Email", sn: "Email" },
  "signin.password": { en: "Password", sn: "Pasiwedhi" },
  "signin.cta": { en: "Sign in", sn: "Pinda" },
  "signin.busy": { en: "Signing in…", sn: "Kupinda…" },
  "signin.error": {
    en: "Sign in failed. Check and try again.",
    sn: "Kupinda kwakundikana. Tarisa uyedze zvakare.",
  },
  "signin.note": {
    en: "Rehearsal sign in. The product login is phone OTP.",
    sn: "Kupinda kwekudzidzira chete.",
  },
  "signin.notConductor": {
    en: "This account is not an active hwindi.",
    sn: "Account iyi haisi yehwindi.",
  },

  // first use consent. Shona is machine drafted and waits for the external
  // translator pass, like every other Shona string in this file.
  "consent.title": { en: "Before you work", sn: "Usati washanda" },
  "consent.intro": {
    en: "Svika records the fares you clear so owners see totals and you earn commission on digital fares. Agree before you start.",
    sn: "Svika inonyora mari yaunotambira kuti varidzi vaone huwandu uye iwe uwane komisheni pamari yedhijitari. Bvuma usati watanga.",
  },
  "consent.point1": {
    en: "Your account details are stored: name, phone and this sign in.",
    sn: "Ruzivo rweakaunti yako runochengetwa: zita, foni nekupinda uku.",
  },
  "consent.point2": {
    en: "Every fare you clear is recorded and never edited or deleted.",
    sn: "Mari imwe neimwe yaunotambira inonyorwa uye haigadziridzwe kana kudzimwa.",
  },
  "consent.point3": {
    en: "Audit checks look at patterns and totals. They never accuse a person.",
    sn: "Kuongorora kunotarisa mafambiro nehuwandu. Hakupomere munhu.",
  },
  "consent.accept": { en: "I understand and agree", sn: "Ndanzwisisa uye ndinobvuma" },
  "consent.busy": { en: "Saving…", sn: "Kuchengetedza…" },
  "consent.error": {
    en: "That did not save. Try again.",
    sn: "Hazvina kuchengetedzwa. Edzazve.",
  },

  "route.title": { en: "Pick your route", sn: "Sarudza nzira yako" },
  "route.towards": { en: "Towards", sn: "Kuenda ku" },

  // the kombi step (V5): which vehicle this shift is clearing fares on
  "vehicle.title": { en: "Which kombi today?", sn: "Ndeipi kombi nhasi?" },
  "vehicle.why": {
    en: "Riders see how full it is getting. Nobody sees who you are.",
    sn: "Vafambi vanoona kuti yava kuzara sei. Hapana anoona kuti ndiwe ani.",
  },
  "vehicle.seats": { en: "{seats} seats", sn: "Zvigaro {seats}" },
  "vehicle.seatsUnknown": { en: "Seats not on record", sn: "Zvigaro hazvina kunyorwa" },
  "vehicle.skip": { en: "Not saying today", sn: "Handisi kutaura nhasi" },

  // the waiting list (V8): a signal to look at, never an instruction. There
  // is no button on that screen that answers anybody, and the law line says
  // so out loud.
  "waiting.pill": { en: "{count} waiting", sn: "{count} vakamirira" },
  "waiting.title": { en: "Who is waiting", sn: "Vakamirira" },
  "waiting.total": {
    en: "{count} people on this route right now",
    sn: "Vanhu {count} panzira iyi izvozvi",
  },
  "waiting.back": { en: "Back to the keypad", sn: "Dzokera kukodhi" },
  "waiting.law": {
    en: "A count, not an instruction. Nobody is assigned to you and you answer to nobody here. Counts disappear on their own after twenty minutes.",
    sn: "Nhamba, kwete murairo. Hapana anopiwa kwauri uye hauna waunopindura pano. Nhamba dzinonyangarika dzega mushure memaminitsi makumi maviri.",
  },

  "keypad.title": { en: "Enter board code", sn: "Isa kodhi" },
  "keypad.clear": { en: "Clear fare", sn: "Tambira mari" },
  "keypad.busy": { en: "Checking…", sn: "Kutarisa…" },
  "keypad.erase": { en: "Erase", sn: "Dzima" },
  "keypad.changeRoute": { en: "Change route", sn: "Chinja nzira" },
  "keypad.signOut": { en: "Sign out", sn: "Buda" },

  "result.success": { en: "Cleared", sn: "Yabhadharwa" },
  "result.already_redeemed": {
    en: "Already used",
    sn: "Yatoshandiswa",
  },
  "result.invalid_code": { en: "Wrong code", sn: "Kodhi isiriyo" },
  "result.rate_limited": {
    en: "Too many tries. Wait 10 minutes.",
    sn: "Wakaedza kakawanda. Mira maminitsi gumi.",
  },
  "result.next": { en: "Next passenger", sn: "Mufambi anotevera" },
  "result.retry": { en: "Try again", sn: "Edzazve" },
  "result.collectCash": { en: "Collect cash", sn: "Tora cash" },
  "result.walletPaid": { en: "Paid from wallet", sn: "Yabhadharwa nechikwama" },
  "result.loaded": { en: "Parcel loaded", sn: "Katundu wakwira" },
  "result.collected": { en: "Parcel collected", sn: "Katundu watorwa" },
  "result.not_ready": {
    en: "Parcel not loaded yet",
    sn: "Katundu hausati wakwira",
  },
  "result.route_not_assigned": {
    en: "Not your route",
    sn: "Haisi nzira yako",
  },

  "change.offer": { en: "Change to credit", sn: "Chenji kuita kiredhiti" },
  "change.title": {
    en: "Which note did they pay with?",
    sn: "Vabhadhara nebepa ripi?",
  },
  "change.faresCovered": { en: "Fares covered", sn: "Vanhu vabhadharirwa" },
  "change.credit": { en: "Credit the change", sn: "Isa chenji muchikwama" },
  "change.done": { en: "Change credited", sn: "Chenji yapinda" },
  "change.busy": { en: "Crediting…", sn: "Kuisa…" },
  "change.none": {
    en: "That note leaves no change.",
    sn: "Bepa iri harina chenji.",
  },
  "change.error": {
    en: "Could not credit the change.",
    sn: "Chenji haina kupinda.",
  },
  "change.queued": {
    en: "Change saved. Credits when signal returns.",
    sn: "Chenji yachengetwa. Ichapinda kana network yadzoka.",
  },

  "status.online": { en: "Online", sn: "Pane network" },
  "status.offline": { en: "Offline", sn: "Hapana network" },
  "status.toSync": { en: "to sync", sn: "kumirira" },
  "result.offlineSaved": {
    en: "Saved offline. Syncs when signal returns.",
    sn: "Yachengetwa. Ichatumirwa kana network yadzoka.",
  },
  "sync.done": { en: "synced", sn: "dzatumirwa" },
  "sync.flagged": { en: "flagged for review", sn: "zvakabatwa kuti zvitariswe" },
  "sync.blocked": {
    en: "Sync paused. Will retry.",
    sn: "Sync yamira. Ichaedzazve.",
  },
} as const satisfies Record<string, Entry>;

export type DictKey = keyof typeof dict;

export function t(lang: Lang, key: DictKey): string {
  return dict[key][lang];
}
