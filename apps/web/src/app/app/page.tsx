import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/roles";
import { cookies } from "next/headers";
import { SignOutButton } from "@/components/SignOutButton";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { HomeSheet } from "@/components/home/HomeSheet";
import { REPO_URL } from "@/lib/site";
import { EtaBasis } from "@/components/home/EtaBasis";
import { etaBasisCard, etaBasisLabel } from "@/lib/eta-provenance";
import {
  ArrowIcon,
  HomeIcon,
  RidesIcon,
  WalletIcon,
  YouIcon,
} from "@/components/icons";
import { InitialAvatar } from "@/components/profile/InitialAvatar";
import { formatUsd, planTrip, type RideLeg } from "@svika/shared";
import { fetchNetwork } from "@/lib/network";
import { bookTrip } from "@/lib/actions";
import { boardCodesOf, type BoardCodeEmbed } from "@/lib/tickets";
import {
  CORRIDOR_ROUTE_CODE,
  corridorMetrics,
  corridorStops,
} from "@/lib/map/corridor-data";
import { distanceAlongLine } from "@/lib/map/eta-live";
import { VoiceGuideLazy } from "@/components/voice/VoiceGuideLazy";
import type { EtaEstimate } from "@/lib/map/eta";
import { homeEtaProvider } from "@/lib/map/eta-home";
import {
  alertPattern,
  etaSaysNear,
  LOOKBACK_DAYS,
  mineCommutePatterns,
  type RideFact,
} from "@/lib/commute/patterns";
import { homePeekState } from "@/lib/commute/home-peek";

interface SavedTripRow {
  id: string;
  nickname: string;
  from_stop_id: string;
  to_stop_id: string;
  from_stop: { name: string } | null;
  to_stop: { name: string } | null;
}

interface TicketRow {
  id: string;
  fare_cents: number;
  payment_method: "wallet" | "cash";
  purchased_at: string;
  direction: "outbound" | "inbound";
  from_stop_id: string;
  to_stop_id: string;
  routes: { code: string; name: string } | null;
  from_stop: { name: string } | null;
  to_stop: { name: string } | null;
  board_codes: BoardCodeEmbed | BoardCodeEmbed[] | null;
}

interface CorridorStopRow {
  stop_id: string;
  seq: number;
  stops: { name: string } | null;
}

// Rider home (reference screen 2): the live map is the whole screen, the
// peek sheet always shows route + arrival + fare with no scroll (§9), and
// the bottom nav floats over everything. The search degrades exactly as
// before: free text the planner cannot place lands on the stop picker.
export default async function RiderHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const params = await searchParams;
  const justBooked = params.booked === "1";
  const sheetOpen = params.sheet === "open";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await resolveRole(supabase, user.id);

  const lookbackIso = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60_000,
  ).toISOString();
  const [
    balanceRes,
    savedRes,
    ticketsRes,
    corridorRes,
    corridorFareRes,
    prefsRes,
    historyRes,
    profileRes,
  ] = await Promise.all([
    supabase
      .from("account_balances")
      .select("balance_cents")
      .eq("kind", "rider_wallet")
      .maybeSingle(),
    supabase
      .from("saved_trips")
      .select(
        "id, nickname, from_stop_id, to_stop_id, from_stop:stops!saved_trips_from_stop_id_fkey(name), to_stop:stops!saved_trips_to_stop_id_fkey(name)",
      )
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("tickets")
      .select(
        "id, fare_cents, payment_method, purchased_at, direction, from_stop_id, to_stop_id, routes(code, name), from_stop:stops!tickets_from_stop_id_fkey(name), to_stop:stops!tickets_to_stop_id_fkey(name), board_codes(code, valid_until)",
      )
      .eq("kind", "fare")
      .order("purchased_at", { ascending: false })
      .limit(8),
    supabase
      .from("route_stops")
      .select("stop_id, seq, stops(name), routes!inner(code, name)")
      .eq("routes.code", CORRIDOR_ROUTE_CODE)
      .eq("direction", "outbound")
      .order("seq"),
    supabase
      .from("route_fares")
      .select("fare_cents, effective_from, routes!inner(code, name)")
      .eq("routes.code", CORRIDOR_ROUTE_CODE)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("rider_prefs")
      .select("commute_alerts, voice_en, voice_sn")
      .maybeSingle(),
    // spine 2 raw material: the rider's own recent rides, under their RLS
    supabase
      .from("tickets")
      .select(
        "from_stop_id, to_stop_id, purchased_at, from_stop:stops!tickets_from_stop_id_fkey(name), to_stop:stops!tickets_to_stop_id_fkey(name)",
      )
      .eq("kind", "fare")
      .gte("purchased_at", lookbackIso)
      .order("purchased_at", { ascending: false })
      .limit(120),
    // the profile door's initial avatar reads the rider's own name; demo_sim
    // tells the alert to run on any stage clock (see the alert block below)
    supabase
      .from("profiles")
      .select("full_name, demo_sim")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const balance = balanceRes.data?.balance_cents ?? 0;
  const savedTrips = (savedRes.data ?? []) as unknown as SavedTripRow[];
  const tickets = (ticketsRes.data ?? []) as unknown as TicketRow[];
  const fullName = profileRes.data?.full_name ?? null;
  const toWord = t(lang, "common.to");

  // the "your kombi is N minutes away" slot: Spine 1 answers with a number
  // built from recorded rides (measured against the map's simulated kombi);
  // the mock twin serves off corridor trips or a downed spine, labelled demo
  const corridorRows = (corridorRes.data ?? []) as unknown as CorridorStopRow[];
  const corridorStopIds = corridorRows.map((r) => r.stop_id);
  const etaProvider = homeEtaProvider(corridorStopIds);
  const etaByTrip = new Map<string, EtaEstimate>();
  for (const trip of savedTrips) {
    etaByTrip.set(
      trip.id,
      await etaProvider.estimate(trip.from_stop_id, trip.to_stop_id),
    );
  }

  // Spine 2, commute alerts: recurring trips mined from the rider's own
  // history as plain statistics; the alert fires only when the pref is on,
  // the moment sits in the usual window, and the live wait (Spine 1) says
  // the usual kombi is near. A demo persona (demo_sim) waives the window so
  // the alert plays on any stage clock; the mined route, the live ETA and the
  // basis label stay real. See docs/SPINE-2-COMMUTE-ALERTS.md.
  interface HistoryRow {
    from_stop_id: string;
    to_stop_id: string;
    purchased_at: string;
    from_stop: { name: string } | null;
    to_stop: { name: string } | null;
  }
  const facts: RideFact[] = ((historyRes.data ?? []) as unknown as HistoryRow[]).map(
    (r) => ({
      fromStopId: r.from_stop_id,
      toStopId: r.to_stop_id,
      fromName: r.from_stop?.name ?? "",
      toName: r.to_stop?.name ?? "",
      purchasedAt: r.purchased_at,
    }),
  );
  const isDemo = profileRes.data?.demo_sim === true;
  const patterns = mineCommutePatterns(facts, new Date());

  let commuteAlert: {
    fromName: string;
    toName: string;
    eta: EtaEstimate;
  } | null = null;
  if (prefsRes.data?.commute_alerts) {
    const pattern = alertPattern(patterns, new Date(), { demo: isDemo });
    if (pattern) {
      const eta = await etaProvider.estimate(pattern.fromStopId, pattern.toStopId);
      if (etaSaysNear(eta.minutes)) {
        commuteAlert = { fromName: pattern.fromName, toName: pattern.toName, eta };
      }
    }
  }

  // V1, answer first home: a known commuter's peek answers their moment (the
  // usual trip inside its window, the ride back once it has passed) with the
  // live wait, the fare and what one tap will do to the wallet. Pure UI over
  // the same mined patterns; anyone else keeps the search peek. The same
  // commute_alerts pref gates it: one switch means "act on my patterns", so
  // a rider who opted out keeps the plain search home.
  const peekState = prefsRes.data?.commute_alerts
    ? homePeekState(patterns, new Date(), { demo: isDemo })
    : ({ kind: "search" } as const);
  let answer: {
    kind: "commute" | "return";
    fromStopId: string;
    toStopId: string;
    fromName: string;
    toName: string;
    routeName: string;
    eta: EtaEstimate;
    fareCents: number;
    covered: boolean;
  } | null = null;
  if (peekState.kind !== "search") {
    const network = await fetchNetwork(supabase);
    const answerPlan = planTrip(network, peekState.fromStopId, peekState.toStopId);
    const firstRide = answerPlan?.legs.find((l): l is RideLeg => l.type === "ride");
    if (answerPlan && firstRide) {
      const eta = await etaProvider.estimate(
        peekState.fromStopId,
        peekState.toStopId,
      );
      answer = {
        ...peekState,
        routeName: firstRide.routeName,
        eta,
        fareCents: answerPlan.totalFareCents,
        covered: balance >= answerPlan.totalFareCents,
      };
    }
  }

  // the peek card (§9): route + arrival + fare, never behind a scroll
  const corridorFare = corridorFareRes.data as {
    fare_cents: number;
    routes: { code: string; name: string };
  } | null;
  const corridorEta =
    corridorStopIds.length >= 2
      ? await etaProvider.estimate(
          corridorStopIds[0]!,
          corridorStopIds[corridorStopIds.length - 1]!,
        )
      : null;
  const corridorFirstStop = corridorRows[0]?.stops?.name ?? "";

  // statuses only for the tickets on screen; the rider's full history is
  // unbounded and grows forever
  const statusRes = await supabase
    .from("ticket_status")
    .select("ticket_id, status")
    .in(
      "ticket_id",
      tickets.map((t) => t.id),
    );
  const statusByTicket = new Map(
    (statusRes.data ?? []).map((s) => [s.ticket_id as string, s.status as string]),
  );

  // The voice guide rides the newest boarded corridor fare, in whichever
  // enabled voice matches the app language (falling back to the other
  // enabled one). Replay mode compresses the ride's last stretch for story
  // steps; the story caption says so.
  const prefs = prefsRes.data;
  const voiceLang =
    lang === "sn" && prefs?.voice_sn
      ? ("sn" as const)
      : lang === "en" && prefs?.voice_en
        ? ("en" as const)
        : prefs?.voice_sn
          ? ("sn" as const)
          : prefs?.voice_en
            ? ("en" as const)
            : null;
  const boarded = tickets.find(
    (tk) =>
      (statusByTicket.get(tk.id) ?? "issued") === "redeemed" &&
      tk.routes?.code === CORRIDOR_ROUTE_CODE &&
      Date.now() - new Date(tk.purchased_at).getTime() < 2 * 60 * 60_000,
  );
  let voiceTrip: {
    targetMeters: number;
    direction: "outbound" | "inbound";
    hasWalkAfter: boolean;
  } | null = null;
  if (voiceLang && boarded && corridorStopIds.length === corridorStops.length) {
    const alightIndex = corridorStopIds.indexOf(boarded.to_stop_id);
    if (alightIndex !== -1) {
      // a walking leg follows when another boarding waits at a different
      // stop, or when the trip was planned to a place (D1): the recorded
      // walk tail on this ticket carries the destination beyond the stop
      const tailRes = await supabase
        .from("trip_walk_tails")
        .select("walk_meters")
        .eq("ticket_id", boarded.id)
        .maybeSingle();
      const hasWalkAfter =
        tailRes.data !== null ||
        tickets.some(
          (other) =>
            other.id !== boarded.id &&
            (statusByTicket.get(other.id) ?? "issued") === "issued" &&
            other.from_stop_id !== boarded.to_stop_id &&
            Math.abs(
              new Date(other.purchased_at).getTime() -
                new Date(boarded.purchased_at).getTime(),
            ) <
              30 * 60_000,
        );
      voiceTrip = {
        targetMeters: distanceAlongLine(
          corridorMetrics,
          corridorStops[alightIndex]!.lngLat,
        ),
        direction: boarded.direction,
        hasWalkAfter,
      };
    }
  }

  const searchForm = (
    <form className="home-search" action="/app/plan" method="get">
      <input
        id="from"
        name="from"
        className="home-search-pill"
        placeholder={t(lang, "rider.fromPlaceholder")}
        aria-label={t(lang, "rider.fromLabel")}
        autoComplete="off"
        required
      />
      <div className="home-search-row">
        <input
          id="to"
          name="to"
          className="home-search-pill"
          placeholder={t(lang, "rider.toPlaceholder")}
          aria-label={t(lang, "rider.toLabel")}
          autoComplete="off"
          required
        />
        <button
          className="home-search-go touch-target"
          type="submit"
          aria-label={t(lang, "rider.planCta")}
        >
          <ArrowIcon />
        </button>
      </div>
    </form>
  );

  return (
    <main className="home-screen">
      <div className="home-map">
        <LiveMapLazy
          labels={{
            ariaLabel: t(lang, "map.ariaLabel"),
            demoChip: t(lang, "map.demoChip"),
            unavailable: t(lang, "map.unavailable"),
            viewWhole: t(lang, "map.viewWhole"),
            viewNear: t(lang, "map.viewNear"),
            view3d: t(lang, "map.view3d"),
            viewFlat: t(lang, "map.viewFlat"),
          }}
          camera="boarding"
        />
      </div>

      <header className="home-chips">
        <span className="home-chip home-chip-brand svika-glass">
          {/* Exported wordmark, never rebuilt. */}
          <img className="wordmark" src="/wordmark.svg" alt="Svika" height={22} />
        </span>
        <span className="home-chips-right">
          <span className="home-chip svika-glass">
            <ThemeToggle
              initialTheme={theme}
              toDarkLabel={t(lang, "theme.toDark")}
              toLightLabel={t(lang, "theme.toLight")}
            />
          </span>
          <span className="home-chip svika-glass">
            <LanguageToggle lang={lang} />
          </span>
          <Link
            className="home-chip svika-glass home-chip-profile touch-target"
            href="/app/profile"
            aria-label={t(lang, "profile.open")}
            data-testid="profile-chip"
          >
            <InitialAvatar name={fullName} size="chip" />
          </Link>
        </span>
      </header>

      {voiceTrip && (
        <VoiceGuideLazy
          key={boarded!.id}
          lang={voiceLang}
          trip={voiceTrip}
          // ?voice=replay compresses the ride's last stretch through the
          // same engine (the old story step mechanic): the e2e suite and
          // the gate recording use it; no product surface links to it
          mode={params.voice === "replay" ? "replay" : "live"}
          captions={{
            approaching: t(voiceLang!, "voice.approaching"),
            getOff: t(voiceLang!, "voice.getOff"),
            walk: t(voiceLang!, "voice.walk"),
          }}
        />
      )}

      {commuteAlert && (
        <aside className="commute-alert svika-glass-strong" data-testid="commute-alert">
          <span className="svika-live-dot" aria-hidden>
            <span className="svika-ripple-ring" />
            <span className="svika-pulse-dot" />
          </span>
          <span className="commute-alert-body">
            <span className="svika-body commute-alert-title">
              {t(lang, "alert.title")}
            </span>
            <span className="svika-meta">
              {commuteAlert.fromName} {toWord} {commuteAlert.toName} ·{" "}
              <EtaBasis
                label={etaBasisLabel(lang, commuteAlert.eta)}
                card={etaBasisCard(lang, commuteAlert.eta)}
                moreHref="/app/intelligence"
                moreLabel={t(lang, "eta.cardMore")}
              />
            </span>
          </span>
          <span className="peek-mono commute-alert-eta">
            ~{commuteAlert.eta.minutes} {t(lang, "common.minutes")}
          </span>
        </aside>
      )}

      <HomeSheet
        openLabel={t(lang, "home.sheetOpen")}
        closeLabel={t(lang, "home.sheetClose")}
        title={answer ? undefined : t(lang, "rider.searchTitle")}
        hint={answer ? undefined : t(lang, "home.sheetHint")}
        defaultOpen={justBooked || sheetOpen}
        peek={
          answer ? (
            // the answer peek: the known commuter's moment, §9 trio intact
            // (route + arrival + fare), one §5 CTA that books in one tap.
            // Wallet honesty rides the fare cell so the peek stays compact
            // enough to clear the floating nav on the reference device.
            <div className="peek-answer" data-testid="peek-answer">
              <div>
                <p className="peek-label">
                  {t(
                    lang,
                    answer.kind === "commute"
                      ? "home.answerUsual"
                      : "home.answerReturn",
                  )}
                </p>
                <h1 className="svika-title peek-answer-trip">
                  {answer.fromName} {toWord} {answer.toName}
                </h1>
              </div>
              <div className="peek-stats" data-testid="peek-stats">
                <div>
                  <p className="peek-label">{t(lang, "ticket.route")}</p>
                  <p className="peek-route">{answer.routeName}</p>
                  <span className="peek-route-sub">
                    {t(lang, "home.peekFrom")} {answer.fromName}
                  </span>
                </div>
                <div>
                  <p className="peek-label">{t(lang, "home.peekArrives")}</p>
                  <p className="peek-mono">
                    {answer.eta.minutes} {t(lang, "common.minutes")}
                  </p>
                  <EtaBasis
                    className="peek-route-sub"
                    label={etaBasisLabel(lang, answer.eta)}
                    card={etaBasisCard(lang, answer.eta)}
                    moreHref="/app/intelligence"
                    moreLabel={t(lang, "eta.cardMore")}
                  />
                </div>
                <div>
                  <p className="peek-label">{t(lang, "ticket.fare")}</p>
                  <p className="peek-mono">{formatUsd(answer.fareCents)}</p>
                  <span className="peek-route-sub" data-testid="answer-wallet">
                    {t(
                      lang,
                      answer.covered
                        ? "home.answerWalletCovers"
                        : "home.answerWalletShort",
                    )}
                  </span>
                </div>
              </div>
              <form action={bookTrip} className="peek-answer-book">
                <input type="hidden" name="from" value={answer.fromStopId} />
                <input type="hidden" name="to" value={answer.toStopId} />
                <input
                  type="hidden"
                  name="payment"
                  value={answer.covered ? "wallet" : "cash"}
                />
                <button
                  className="cta touch-target"
                  type="submit"
                  data-testid="answer-rebook"
                >
                  {t(lang, "home.answerCta")}
                  <span className="cta-chip" aria-hidden>
                    <ArrowIcon />
                  </span>
                </button>
              </form>
            </div>
          ) : (
            <>
              {searchForm}
              {corridorFare && corridorEta && (
                <div className="peek-stats" data-testid="peek-stats">
                  <div>
                    <p className="peek-label">{t(lang, "ticket.route")}</p>
                    <p className="peek-route">{corridorFare.routes.name}</p>
                    <span className="peek-route-sub">
                      {t(lang, "home.peekFrom")} {corridorFirstStop}
                    </span>
                  </div>
                  <div>
                    <p className="peek-label">{t(lang, "home.peekArrives")}</p>
                    <p className="peek-mono">
                      {corridorEta.minutes} {t(lang, "common.minutes")}
                    </p>
                    <EtaBasis
                      className="peek-route-sub"
                      label={etaBasisLabel(lang, corridorEta)}
                      card={etaBasisCard(lang, corridorEta)}
                      moreHref="/app/intelligence"
                      moreLabel={t(lang, "eta.cardMore")}
                    />
                  </div>
                  <div>
                    <p className="peek-label">{t(lang, "ticket.fare")}</p>
                    <p className="peek-mono">{formatUsd(corridorFare.fare_cents)}</p>
                  </div>
                </div>
              )}
            </>
          )
        }
      >
        {answer && (
          <section
            className="home-plan-other"
            aria-label={t(lang, "home.answerOther")}
          >
            <h2 className="svika-meta tickets-heading" data-testid="answer-plan-other">
              {t(lang, "home.answerOther")}
            </h2>
            {searchForm}
          </section>
        )}

        {savedTrips.length > 0 && (
          <section className="home-picks" aria-label={t(lang, "home.yourTrips")}>
            <h2 className="svika-meta tickets-heading">{t(lang, "home.yourTrips")}</h2>
            <ul className="home-pick-list">
              {savedTrips.map((trip) => {
                const eta = etaByTrip.get(trip.id)!;
                // the pick stays one card: the trip link fills the left, the
                // basis label answers its own tap on the right
                return (
                  <li key={trip.id} className="home-pick svika-card">
                    <Link
                      className="home-pick-link touch-target"
                      href={`/app/plan?from=${trip.from_stop_id}&to=${trip.to_stop_id}`}
                    >
                      <span className="home-pick-body">
                        <span className="svika-body home-pick-name">
                          {trip.nickname}
                        </span>
                        <span className="svika-meta">
                          {trip.from_stop?.name} {toWord} {trip.to_stop?.name}
                        </span>
                      </span>
                    </Link>
                    <span className="home-pick-eta">
                      <span className="svika-mono-code">
                        ~{eta.minutes} {t(lang, "common.minutes")}
                      </span>
                      <EtaBasis
                        className="svika-meta home-pick-demo"
                        label={etaBasisLabel(lang, eta)}
                        card={etaBasisCard(lang, eta)}
                        moreHref="/app/intelligence"
                        moreLabel={t(lang, "eta.cardMore")}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="wallet-strip svika-card">
          <div>
            <p className="svika-meta tickets-heading">
              {t(lang, "rider.walletBalance")}
            </p>
            <p className="wallet-amount svika-mono-code">{formatUsd(balance)}</p>
          </div>
          <Link className="inline-link touch-target" href="/app/wallet">
            {t(lang, "wallet.open")}
          </Link>
        </section>

        <nav className="picker-list" aria-label="sections">
          <Link className="picker-item touch-target" href="/app/parcel">
            {t(lang, "parcel.open")}
          </Link>
          {role === "owner" && (
            <Link className="picker-item touch-target" href="/app/owner">
              {t(lang, "owner.open")}
            </Link>
          )}
        </nav>

        <section className="tickets-block">
          <h2 className="svika-meta tickets-heading">{t(lang, "rider.tickets")}</h2>
          {tickets.length === 0 ? (
            <p className="svika-body empty-note">{t(lang, "rider.noTickets")}</p>
          ) : (
            <ul className="ticket-list">
              {tickets.map((ticket) => {
                const status = statusByTicket.get(ticket.id) ?? "issued";
                const statusKey = `ticket.status.${status}` as DictKey;
                const code = boardCodesOf(ticket.board_codes)[0]?.code ?? "";
                return (
                  <li key={ticket.id}>
                    <Link
                      href={`/app/ticket/${ticket.id}`}
                      className={`ticket-item svika-card${status === "issued" ? "" : " ticket-item-done"}`}
                    >
                      <span className="ticket-item-code svika-mono-code">
                        {status === "issued" ? code : "····"}
                      </span>
                      <span className="ticket-item-body">
                        <span className="svika-body ticket-item-route">
                          {ticket.from_stop && ticket.to_stop
                            ? `${ticket.from_stop.name} ${toWord} ${ticket.to_stop.name}`
                            : (ticket.routes?.name ?? "")}
                        </span>
                        <span className="svika-meta">
                          <span className="svika-mono-code">
                            {formatUsd(ticket.fare_cents)}
                          </span>{" "}
                          ·{" "}
                          {t(
                            lang,
                            ticket.payment_method === "cash"
                              ? "ticket.payCash"
                              : "ticket.paidWallet",
                          )}{" "}
                          · {t(lang, statusKey)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <footer className="home-sheet-footer">
          <Link
            className="auth-link touch-target"
            href="/app/profile"
            data-testid="profile-link"
          >
            {t(lang, "profile.open")}
          </Link>
          <Link className="auth-link touch-target" href="/app/privacy">
            {t(lang, "privacy.yourDataLink")}
          </Link>
          <a
            className="auth-link touch-target"
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            data-testid="repo-link"
          >
            {t(lang, "repo.link")}
          </a>
          <SignOutButton label={t(lang, "app.signOut")} />
        </footer>
      </HomeSheet>

      <nav className="tab-nav tab-nav-fixed" aria-label="Primary">
        <span className="tab-item tab-item-active" aria-current="page">
          <HomeIcon active />
          {t(lang, "nav.home")}
        </span>
        <Link className="tab-item" href="/app?sheet=open">
          <RidesIcon />
          {t(lang, "nav.rides")}
        </Link>
        <Link className="tab-item" href="/app/wallet">
          <WalletIcon />
          {t(lang, "nav.wallet")}
        </Link>
        <Link className="tab-item" href="/app/profile" data-testid="you-tab">
          <YouIcon />
          {t(lang, "nav.you")}
        </Link>
      </nav>
    </main>
  );
}
