// The disclosure register, on screen for a judge to open. This mirrors
// docs/DISCLOSURE-REGISTER.md, the canonical English artifact, verbatim; update
// both in the same commit as any feature that changes tier. Tier 1 is real and
// working against the live database. Tier 2 is clickable with a fixed or
// simulated backend, always labelled on screen. (Tier 3 lives in slides only
// and never in code, so it never appears in the running app.)

export type DisclosureTier = 1 | 2;

export interface DisclosureRow {
  feature: string;
  tier: DisclosureTier;
  detail: string;
}

// The date the canonical register was last updated (docs/DISCLOSURE-REGISTER.md).
export const DISCLOSURE_UPDATED = "2026-07-25";

export const DISCLOSURE_ROWS: readonly DisclosureRow[] = [
  {
    feature: "Trip search, plan, fare quote",
    tier: 1,
    detail:
      "Real graph planner over the seeded network. Fares come from dated fare segments in Postgres.",
  },
  {
    feature: "Ticket purchase (wallet and cash)",
    tier: 1,
    detail:
      "Real double entry ledger. Money moves only through security definer RPCs, proven by ledger invariant tests.",
  },
  {
    feature: "Board codes and conductor redemption",
    tier: 1,
    detail:
      "Real 4 digit codes scoped to route, direction and time window, rate limited, attempts logged.",
  },
  {
    feature: "Offline conductor sync",
    tier: 1,
    detail:
      "Real IndexedDB cache and idempotent sync RPCs, proven against the live database.",
  },
  {
    feature: "Change to credit, split a note, transfers",
    tier: 1,
    detail: "Real ledger operations with RLS isolation tests.",
  },
  {
    feature: "Parcels (LOAD and COLLECT)",
    tier: 1,
    detail: "Real staged codes on the live database.",
  },
  {
    feature: "Owner revenue view",
    tier: 1,
    detail: "Real aggregation over ledger postings.",
  },
  {
    feature: "Live map: corridor geometry and stops",
    tier: 1,
    detail:
      "Real road line and 15 real stop names derived from field GPS rides on 2026-07-07. Map data is OpenStreetMap, self hosted: a Harare extract built by a committed pipeline, drawn by a native Mbare Sun style, day and night, with attribution on the map.",
  },
  {
    feature: "Live map: moving kombis",
    tier: 2,
    detail:
      "Simulated. There is no GPS feed from vehicles yet. A mock adapter moves four markers along the real road by replaying the time curves of the two real rides recorded 2026-07-07, so each direction keeps its own recorded pace, slowdowns and stops. The map carries a permanent Demo movement chip. A real feed swaps in behind the same adapter.",
  },
  {
    feature: "Kombi card and board",
    tier: 2,
    detail:
      "Mixed and labelled on screen. The moving position is the simulated fleet behind the VehicleFeed adapter; plates and declared seats are a seeded staging registry, not fieldwork; the trust record is real rules over the live fare ledger, which holds no vehicle linked fares yet, so every kombi honestly shows the unverified default. Trust states are counts on a vehicle's ledger, never a person. Real positions arrive later from conductor shift GPS behind the same adapter.",
  },
  {
    feature: "Saved trips (nickname a trip)",
    tier: 1,
    detail: "Real rider owned rows under RLS, proven by the security suite.",
  },
  {
    feature: "Destination first planning",
    tier: 1,
    detail:
      "Real. The search accepts any named place from a committed local corpus extracted from the self hosted OSM tiles (suburbs, landmarks, roads); no vendor in the ride path. Alight stops are scored by documented arithmetic rules and the trade is shown plainly, including the honest no service case. Not AI.",
  },
  {
    feature: "Alight guidance on destination trips",
    tier: 1,
    detail:
      "The existing geofence trigger engine armed for any booked corridor trip; a destination booking records its walking tail so the walk cue belongs to the ticket. Cues play from cached audio in both languages; the position driving live cues is still the simulated fleet.",
  },
  {
    feature: "Answer first home peek",
    tier: 1,
    detail:
      "Real UI over the same mined patterns as the commute alerts, gated by the same preference: inside the usual window the peek answers with the usual trip, after it with the ride back, carrying the live wait and its basis label, the fare and whether the wallet covers it; one tap books through the normal ledger path. A rider without a recognised moment keeps the search peek. No new intelligence. The floating commute alert hides whenever this peek already answers with the same trip.",
  },
  {
    feature: "Arrival estimate: the minutes",
    tier: 1,
    detail:
      "Computed by the spine service from the two real corridor rides recorded 2026-07-07: per segment averages with a corridor average fallback. The label under every estimate says how many recorded rides it stands on. When the spine is unreachable or a trip is off the corridor, the mock twin serves and the label says demo estimate.",
  },
  {
    feature: "Arrival estimate: the kombi position",
    tier: 2,
    detail:
      "Simulated. The minutes are measured from the same simulated kombi the live map shows; there is still no GPS feed from real vehicles. A real feed swaps in behind the adapter without touching the estimate.",
  },
  {
    feature: "Day and night theme",
    tier: 1,
    detail:
      "Real, cookie backed, follows the device by default. The map swaps to the Mbare Sun night style in place when the theme flips.",
  },
  {
    feature: "Voice guidance: the trigger engine",
    tier: 1,
    detail:
      "Real geofence engine over vehicle positions, with per language settings on the profile. Audio is preloaded when a ride starts and played from memory; the zero network at play time claim is proven by a unit test. Screen readers ride the same triggers through an aria-live region.",
  },
  {
    feature: "Voice guidance: the voices",
    tier: 2,
    detail:
      "Placeholder audio generated with a local Windows SAPI voice; the Shona lines through an English synthesiser are knowingly wrong and labelled on the settings screen. Recorded Zimbabwean voices with signed consent replace the files later, same names, no code change.",
  },
  {
    feature: "Spine 1 arrival prediction",
    tier: 1,
    detail:
      "Served baseline (per segment averages over real rides) with a committed evaluation: leave one journey out, model versus baseline. The model is promoted only when it beats the baseline with at least 10 recorded journeys; today the verdict is insufficient data and the baseline serves.",
  },
  {
    feature: "Spine 2 commute alerts: the engine",
    tier: 1,
    detail:
      "Real, deliberately plain statistics: recurring trips mined from the rider's own history inside their own RLS scope, fired only when the live wait clears the threshold. The named baseline is the fixed alarm clock, which cannot know today's supply; the alert card always shows what its minutes stand on.",
  },
  {
    feature: "Spine 2 commute alerts: Takunda's history",
    tier: 2,
    detail:
      "Fixture data. The demo persona's two week commute is synthetic, rebuilt around the visit moment so the mined window is live, and every fixture ticket is enumerated in a table. No money moves for fixture rides. A real rider is still gated on their own window.",
  },
  {
    feature: "Spine 3 revenue watchdog: the detector",
    tier: 1,
    detail:
      "A real isolation forest scored against the named fixed threshold baseline on held out labelled days, verdict committed (forest F1 0.756 versus baseline 0; the threshold never fires because leakage hides inside one kombi's takings). Serving follows the committed verdict and nothing else.",
  },
  {
    feature: "Spine 3 revenue watchdog: the history it scans",
    tier: 2,
    detail:
      "Simulated. The network has run for days, not the months a watchdog needs, so ticket histories are generated by a committed, seeded simulator with known injected leakage. Every row carries data_source = synthetic under RLS, and the owner card is labelled Simulated history on screen. Real ledger aggregates replace the simulator once months of real fares exist.",
  },
  {
    feature: "Watchdog explanations",
    tier: 1,
    detail:
      "Template narratives in English and Shona through the language adapter's mock twin; no live vendor sits in the demo path. A unit test proves no template can name a person.",
  },
  {
    feature: "Consent and privacy",
    tier: 1,
    detail:
      "Real first use consent gate over every surface, recorded under RLS and proven by an e2e test that a fresh user cannot reach booking. Deleting anonymises through a security definer RPC because ticket and money history is append only, and the page says so plainly.",
  },
  {
    feature: "Intelligence page: how Svika knows your arrival",
    tier: 1,
    detail:
      "The live map's arrival number carries its basis label, and the intelligence page renders the honest ladder and the committed evaluation table imported from the metrics file itself, never retyped numbers.",
  },
  {
    feature: "Share my ride",
    tier: 1,
    detail:
      "Real 128 bit capability links minted server side from the rider's own live fare. The public viewer answers only for a live, unrevoked, unexpired token and shows route facts, the live map and the arrival estimate, never who is riding, their code or their money.",
  },
  {
    feature: "Record my trip (M1)",
    tier: 1,
    detail:
      "Real GPS journeys recorded on the rider's own phone. Accuracy gating and adaptive sampling are documented geometry rules, points queue offline in IndexedDB and sync in batches through consent gated RPCs with RLS proven isolation, and without the journey consent nothing uploads: the trip stays on the device. Server side is storage only, no map matching, no analysis, no AI.",
  },
  {
    feature: "Share a trip as a guide link (M2)",
    tier: 1,
    detail:
      "Real 128 bit capability links for a saved journey: token scoped, seven day expiry, revocable, viewable with no account. Walking directions are trace replay, not routing: the recorded points ARE the directions, shortcuts included. The viewer's off path, approaching and arrived cues are client side distance to the polyline, and the step list is derived by plain geometry (simplify, then split on turns and mode changes); the page itself says no routing engine, no AI. The viewer never learns who recorded the trip or when. A self hosted walking router for places with no trace is roadmap, slides only.",
  },
  {
    feature: "Guardian mode: family links and safe arrival (V3)",
    tier: 1,
    detail:
      "Real. A link exists only after both sides act: the guardian mints a rate limited invite code, the child enters it on their own phone, and either side ends it instantly. While a link is on, the child's app always shows a visible chip on every screen: no silent tracking, by design. The guardian sees the linked child's fare trips as status words only (booked, on the kombi, arrived), never board codes, fares, wallet or coordinates, RLS proven. Safe arrival is the rider's own tap appended to the event stream; the taking longer than usual flag is a plain timing rule over the route's typical duration and its copy flags trips, never people. No SMS or messaging vendor: the guardian contact link travels through the phone's own share sheet.",
  },
  {
    feature: "Profile welcome and ride stats",
    tier: 1,
    detail:
      "Real. The greeting is computed in Harare time; the name and avatar come from the rider's own profile row. The stats are derived from the same fare tickets the page loads under the rider's own RLS. A reused demo persona shows only the current judge's rides, not a stranger's.",
  },
  {
    feature: "Language support (English, Shona live; Ndebele roadmap)",
    tier: 1,
    detail:
      "English and Shona are the live languages: every rider facing string exists in both and the toggle switches the whole app. Ndebele is roadmap; the control renders it as a disabled coming soon chip that switches no strings, proven by unit and e2e tests.",
  },
];
