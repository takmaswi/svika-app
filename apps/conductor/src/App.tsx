// The hwindi surface: sign in → pick route and direction → pick the kombi →
// keypad → verdict. Fat finger first: one action per screen, huge targets,
// high contrast for sunlight, works one handed in a moving kombi. With no
// signal the same keypad clears fares against the local cache and queues the
// events; the pill in the header shows the connection and what is waiting
// to sync.
//
// The kombi step (V5, ruled by Mhofu 2026-07-26) is one tap that stamps every
// clear from this shift with a vehicle id. It is a shift declaration, nothing
// else: no crew record, no roster, no assignment. A hwindi who does not know
// or does not want to say taps past it and clears fares exactly as before.
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CONSENT_VERSION,
  formatUsd,
  hasActiveConsent,
  type ConsentRecord,
} from "@svika/shared";
import { supabase } from "./lib/supabase";
import { t, type Lang } from "./lib/dict";
import { appendDigit, eraseDigit, isComplete } from "./lib/keypad";
import { useOfflineBoarding, isNetworkError } from "./hooks/useOfflineBoarding";
import { getMeta, setMeta } from "./lib/offlineStore";

type Direction = "outbound" | "inbound";

/** The mirrored back arrow (DESIGN.md section 3) — the only back glyph. */
function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 10.1c0-.72-.58-1.3-1.3-1.3H12V6.1c0-1.28-1.5-1.94-2.42-1.05L3.3 11.1c-.6.58-.6 1.54 0 2.12l6.28 6.05C10.5 20.16 12 19.5 12 18.22V15.5h6.7a1.3 1.3 0 0 0 1.3-1.3z" />
    </svg>
  );
}

/** The delete key glyph from reference screen 7, verbatim. */
function DeleteIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 4h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H9l-6-8z" />
      <path d="m12 9 5 6M17 9l-5 6" />
    </svg>
  );
}

interface RouteInfo {
  id: string;
  code: string;
  name: string;
  firstStop: string;
  lastStop: string;
}

/** One kombi in the hwindi's own fleet, from the conductor_vehicles RPC. */
interface VehicleInfo {
  id: string;
  plate: string;
  capacity: number | null;
}

/** The shift a hwindi is working: route, direction and (V5) which kombi. */
interface Shift {
  route: RouteInfo;
  direction: Direction;
  /** null means the hwindi skipped the kombi step; fares still clear. */
  vehicle: VehicleInfo | null;
  /** true once the kombi step has been answered, skip included. */
  vehicleAsked?: boolean;
}

type Outcome =
  | "success"
  | "already_redeemed"
  | "invalid_code"
  | "rate_limited"
  | "not_ready"
  | "route_not_assigned";

interface RedeemedTicket {
  ticketId: string;
  fareCents: number;
  paymentMethod: "wallet" | "cash";
  /** what the code advanced the ticket to: redeemed | loaded | collected */
  stage: string;
  /** cleared against the local cache; the event is queued for sync */
  offline?: boolean;
}

/** Real USD notes a rider hands over on a kombi. */
const NOTE_OPTIONS_CENTS = [100, 200, 500, 1000, 2000];

interface RouteStopRow {
  route_id: string;
  seq: number;
  stops: { name: string } | { name: string }[] | null;
}

function stopName(embed: RouteStopRow["stops"]): string {
  if (!embed) return "";
  return Array.isArray(embed) ? (embed[0]?.name ?? "") : embed.name;
}

export default function App() {
  const [lang, setLang] = useState<Lang>("sn");
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [direction, setDirection] = useState<Direction>("outbound");
  const [vehicles, setVehicles] = useState<VehicleInfo[]>([]);
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [vehicleAsked, setVehicleAsked] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [redeemed, setRedeemed] = useState<RedeemedTicket | null>(null);
  const [changeMode, setChangeMode] = useState(false);
  const [changeCents, setChangeCents] = useState<number | null>(null);
  const [changeQueued, setChangeQueued] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [faresCovered, setFaresCovered] = useState(1);

  const offline = useOfflineBoarding(route?.id ?? null, direction, vehicle?.id ?? null);
  const [consented, setConsented] = useState<boolean | null>(null);

  // the consent gate: nothing past sign in renders until the latest consent
  // record says accepted. The verdict is cached in the offline store so a
  // hwindi who already agreed is never locked out in a dead zone.
  useEffect(() => {
    if (!session) {
      setConsented(null);
      return;
    }
    void (async () => {
      // scoped to the app consent stream: other consent streams (e.g. the
      // rider profile's emergency details) must never move this gate
      const { data, error } = await supabase
        .from("consent_records")
        .select("action, created_at")
        .eq("version", CONSENT_VERSION);
      if (error) {
        setConsented((await getMeta<boolean>("consented")) ?? false);
        return;
      }
      const ok = hasActiveConsent((data ?? []) as ConsentRecord[]);
      await setMeta("consented", ok);
      setConsented(ok);
    })();
  }, [session]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Routes come from the network when there is one and from the offline
  // store when there is not: a kombi restart in a dead zone still reaches
  // the keypad. The last shift's route + direction restores the same way.
  useEffect(() => {
    if (!session) return;
    void (async () => {
      const [routesRes, stopsRes] = await Promise.all([
        supabase
          .from("routes")
          .select("id, code, name")
          .eq("active", true)
          .neq("code", "TEST-01")
          .order("code"),
        supabase
          .from("route_stops")
          .select("route_id, seq, stops(name)")
          .eq("direction", "outbound")
          .order("seq"),
      ]);
      let list: RouteInfo[];
      if (routesRes.error || stopsRes.error) {
        list = (await getMeta<RouteInfo[]>("routes")) ?? [];
      } else {
        const stopRows = (stopsRes.data ?? []) as unknown as RouteStopRow[];
        list = (routesRes.data ?? [])
          .map((r) => {
            const mine = stopRows.filter((s) => s.route_id === r.id);
            return {
              id: r.id as string,
              code: r.code as string,
              name: r.name as string,
              firstStop: stopName(mine[0]?.stops ?? null),
              lastStop: stopName(mine[mine.length - 1]?.stops ?? null),
            };
          })
          .filter((r) => r.firstStop && r.lastStop);
        await setMeta("routes", list);
      }
      setRoutes(list);

      // the hwindi's own fleet for the kombi step, cached the same way the
      // routes are: a restart in a dead zone still reaches the picker
      const vehiclesRes = await supabase.rpc("conductor_vehicles");
      let fleet: VehicleInfo[];
      if (vehiclesRes.error) {
        fleet = (await getMeta<VehicleInfo[]>("vehicles")) ?? [];
      } else {
        fleet = ((vehiclesRes.data ?? []) as VehicleInfo[]).map((v) => ({
          id: v.id,
          plate: v.plate,
          capacity: v.capacity,
        }));
        await setMeta("vehicles", fleet);
      }
      setVehicles(fleet);

      // restore the shift: an app killed mid-route reopens on its keypad,
      // still on the same kombi it was clearing fares for
      const shift = await getMeta<Shift>("shift");
      if (shift && list.some((r) => r.id === shift.route.id)) {
        setRoute(shift.route);
        setDirection(shift.direction);
        const stillInFleet =
          shift.vehicle && fleet.some((v) => v.id === shift.vehicle!.id);
        setVehicle(stillInFleet ? shift.vehicle : null);
        setVehicleAsked(shift.vehicleAsked === true);
      }
    })();
  }, [session]);

  const saveShift = (next: Shift) => {
    setRoute(next.route);
    setDirection(next.direction);
    setVehicle(next.vehicle);
    setVehicleAsked(next.vehicleAsked === true);
    void setMeta("shift", next);
  };

  const pickRoute = (r: RouteInfo, dir: Direction) => {
    saveShift({ route: r, direction: dir, vehicle: null, vehicleAsked: false });
  };

  const pickVehicle = (v: VehicleInfo | null) => {
    if (!route) return;
    saveShift({ route, direction, vehicle: v, vehicleAsked: true });
  };

  const langToggle = (
    <div className="lang-toggle" role="group" aria-label="language">
      {(["sn", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          className={lang === l ? "lang-on" : ""}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );

  // connection + queue pill; tapping it forces a sync (demo safe)
  const statusPill = (
    <button
      type="button"
      className={`hwindi-pill ${offline.online ? "hwindi-pill-online" : "hwindi-pill-offline"}`}
      data-testid="status-pill"
      onClick={() => void offline.syncNow()}
    >
      {t(lang, offline.online ? "status.online" : "status.offline")}
      {offline.queued > 0 && ` · ${offline.queued} ${t(lang, "status.toSync")}`}
    </button>
  );

  if (!ready) return <main className="hwindi-shell" />;

  if (!session) {
    return <SignIn lang={lang} langToggle={langToggle} />;
  }

  if (consented === null) return <main className="hwindi-shell" />;
  if (!consented) {
    return (
      <Consent
        lang={lang}
        langToggle={langToggle}
        userId={session.user.id}
        onAccepted={() => {
          setConsented(true);
          void setMeta("consented", true);
        }}
      />
    );
  }

  const resetForNext = () => {
    setCode("");
    setOutcome(null);
    setRedeemed(null);
    setChangeMode(false);
    setChangeCents(null);
    setChangeQueued(false);
    setChangeError(null);
    setFaresCovered(1);
  };

  if (outcome) {
    const isCash = redeemed?.paymentMethod === "cash";

    // change credited: confirmation the rider can see over the hwindi's shoulder
    if (changeCents !== null) {
      return (
        <main
          className="hwindi-shell hwindi-verdict hwindi-verdict-success"
          data-testid="change-done"
        >
          <p className="hwindi-verdict-word">{t(lang, "change.done")}</p>
          <p className="hwindi-verdict-code svika-mono-code">
            {formatUsd(changeCents)}
          </p>
          {changeQueued && (
            <p className="hwindi-verdict-sub" data-testid="change-queued-note">
              {t(lang, "change.queued")}
            </p>
          )}
          <button
            className="hwindi-cta touch-target"
            type="button"
            onClick={resetForNext}
          >
            {t(lang, "result.next")}
          </button>
        </main>
      );
    }

    // note picker: which note, covering how many fares (splitting one note
    // across companions is normal practice; the remainder is the change)
    if (changeMode && redeemed) {
      const covered = redeemed.fareCents * faresCovered;
      // an offline-cleared ticket queues its change too (the server only
      // learns "cleared by you" when the redeem event syncs first)
      const queueTheChange = async (noteCents: number) => {
        const change = await offline.queueChange(
          redeemed.ticketId,
          noteCents,
          faresCovered,
          redeemed.fareCents,
        );
        if (change === null) {
          setChangeError(t(lang, "change.none"));
          return;
        }
        setChangeQueued(true);
        setChangeCents(change);
      };
      const creditChange = async (noteCents: number) => {
        if (busy) return;
        setBusy(true);
        setChangeError(null);
        if (redeemed.offline || !navigator.onLine) {
          await queueTheChange(noteCents);
          setBusy(false);
          return;
        }
        const { data, error } = await supabase.rpc("record_change_credit", {
          p_ticket: redeemed.ticketId,
          p_note_cents: noteCents,
          p_covered_fares: faresCovered,
        });
        if (error && isNetworkError(error)) {
          await queueTheChange(noteCents);
          setBusy(false);
          return;
        }
        setBusy(false);
        if (error) {
          setChangeError(
            error.message.includes("no change")
              ? t(lang, "change.none")
              : t(lang, "change.error"),
          );
          return;
        }
        const row = (data as { change_cents: number }[] | null)?.[0];
        setChangeCents(row?.change_cents ?? 0);
      };
      return (
        <main className="hwindi-shell" data-testid="change-picker">
          <header className="hwindi-header">
            <button
              className="hwindi-back"
              type="button"
              aria-label={t(lang, "result.next")}
              onClick={resetForNext}
            >
              <BackIcon />
            </button>
            <h1 className="svika-headline">{t(lang, "change.title")}</h1>
          </header>

          <div className="hwindi-covered">
            <span className="svika-meta">{t(lang, "change.faresCovered")}</span>
            <div className="hwindi-covered-row">
              <button
                type="button"
                className="hwindi-key touch-target"
                aria-label="-"
                disabled={faresCovered <= 1}
                onClick={() => setFaresCovered((n) => Math.max(1, n - 1))}
              >
                −
              </button>
              <output className="hwindi-covered-count" data-testid="fares-covered">
                {faresCovered}
              </output>
              <button
                type="button"
                className="hwindi-key touch-target"
                aria-label="+"
                disabled={faresCovered >= 8}
                onClick={() => setFaresCovered((n) => Math.min(8, n + 1))}
              >
                +
              </button>
            </div>
            <p className="svika-meta hwindi-route-tag">
              {faresCovered} × {formatUsd(redeemed.fareCents)} = {formatUsd(covered)}
            </p>
          </div>

          <div className="hwindi-notes">
            {NOTE_OPTIONS_CENTS.map((note) => (
              <button
                key={note}
                type="button"
                className="hwindi-note-btn touch-target"
                disabled={busy || note <= covered}
                onClick={() => void creditChange(note)}
              >
                {formatUsd(note)}
              </button>
            ))}
          </div>
          {changeError && <p className="hwindi-error svika-body">{changeError}</p>}
        </main>
      );
    }

    return (
      <main
        className={`hwindi-shell hwindi-verdict hwindi-verdict-${outcome}`}
        data-testid="verdict"
      >
        <p className="hwindi-verdict-word">
          {outcome === "success" && redeemed && redeemed.stage !== "redeemed"
            ? t(lang, `result.${redeemed.stage}` as "result.loaded")
            : t(lang, `result.${outcome}`)}
        </p>
        {outcome === "success" && redeemed && (
          <>
            <p className="hwindi-verdict-code svika-mono-code">
              {formatUsd(redeemed.fareCents)}
            </p>
            <p className="hwindi-verdict-sub">
              {isCash
                ? redeemed.stage === "collected"
                  ? ""
                  : t(lang, "result.collectCash")
                : t(lang, "result.walletPaid")}
            </p>
            {redeemed.offline && (
              <p className="hwindi-verdict-sub" data-testid="offline-note">
                {t(lang, "result.offlineSaved")}
              </p>
            )}
          </>
        )}
        {outcome === "success" && isCash && redeemed?.stage !== "collected" && (
          <button
            className="hwindi-secondary touch-target"
            type="button"
            data-testid="change-offer"
            onClick={() => setChangeMode(true)}
          >
            {t(lang, "change.offer")}
          </button>
        )}
        <button
          className="hwindi-cta touch-target"
          type="button"
          onClick={resetForNext}
        >
          {outcome === "success" ? t(lang, "result.next") : t(lang, "result.retry")}
        </button>
      </main>
    );
  }

  if (!route) {
    return (
      <main className="hwindi-shell">
        <header className="hwindi-header">
          <div className="hwindi-topline">
            <span className="svika-meta">{t(lang, "app.brand")}</span>
            <div className="hwindi-topline-right">
              {statusPill}
              {langToggle}
            </div>
          </div>
          <h1 className="svika-headline">{t(lang, "route.title")}</h1>
        </header>
        <div className="hwindi-routes">
          {routes.map((r) =>
            (["outbound", "inbound"] as const).map((dir) => (
              <button
                key={`${r.id}-${dir}`}
                type="button"
                className="hwindi-route touch-target"
                onClick={() => pickRoute(r, dir)}
              >
                <span className="svika-meta">{r.code}</span>
                <span className="hwindi-route-name">
                  {t(lang, "route.towards")}{" "}
                  {dir === "outbound" ? r.lastStop : r.firstStop}
                </span>
              </button>
            )),
          )}
        </div>
        <button
          className="hwindi-quiet"
          type="button"
          onClick={() => void supabase.auth.signOut()}
        >
          {t(lang, "keypad.signOut")}
        </button>
      </main>
    );
  }

  // the kombi step: one tap, own fleet only, skippable. A hwindi whose fleet
  // has no vehicles on record never sees it at all.
  if (!vehicleAsked && vehicles.length > 0) {
    return (
      <main className="hwindi-shell" data-testid="vehicle-picker">
        <header className="hwindi-header">
          <div className="hwindi-topline">
            <button
              className="hwindi-back"
              type="button"
              aria-label={t(lang, "keypad.changeRoute")}
              onClick={() => {
                setRoute(null);
                setVehicle(null);
                setVehicleAsked(false);
                void setMeta("shift", null);
              }}
            >
              <BackIcon />
            </button>
            <div className="hwindi-topline-right">
              {statusPill}
              {langToggle}
            </div>
          </div>
          <h1 className="svika-headline">{t(lang, "vehicle.title")}</h1>
          <p className="svika-meta hwindi-route-tag">{t(lang, "vehicle.why")}</p>
        </header>
        <div className="hwindi-routes">
          {vehicles.map((v) => (
            <button
              key={v.id}
              type="button"
              className="hwindi-route touch-target"
              data-testid="vehicle-option"
              onClick={() => pickVehicle(v)}
            >
              <span className="svika-mono-code hwindi-route-name">{v.plate}</span>
              <span className="svika-meta">
                {v.capacity !== null
                  ? t(lang, "vehicle.seats").replace("{seats}", String(v.capacity))
                  : t(lang, "vehicle.seatsUnknown")}
              </span>
            </button>
          ))}
        </div>
        <button
          className="hwindi-quiet"
          type="button"
          data-testid="vehicle-skip"
          onClick={() => pickVehicle(null)}
        >
          {t(lang, "vehicle.skip")}
        </button>
      </main>
    );
  }

  // no network (or the call dies mid-air): the local cache answers and the
  // event queues for sync. Same verdict screens either way.
  const submitOffline = async () => {
    const local = await offline.localRedeem(code);
    if (
      local.outcome === "success" &&
      local.ticketId &&
      local.fareCents !== undefined
    ) {
      setRedeemed({
        ticketId: local.ticketId,
        fareCents: local.fareCents,
        paymentMethod: local.paymentMethod ?? "cash",
        stage: local.stage ?? "redeemed",
        offline: true,
      });
    }
    setOutcome(local.outcome);
  };

  const submit = async () => {
    if (!isComplete(code) || busy) return;
    setBusy(true);
    if (!navigator.onLine) {
      await submitOffline();
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.rpc("redeem_board_code", {
      p_route: route.id,
      p_direction: direction,
      p_code: code,
      // V5: the shift's kombi rides on every clear. Null when skipped, which
      // the server has always accepted.
      p_vehicle: vehicle?.id ?? null,
    });
    if (error && isNetworkError(error)) {
      await submitOffline();
      setBusy(false);
      return;
    }
    setBusy(false);
    if (error) {
      setOutcome("invalid_code");
      return;
    }
    const row = (
      data as
        | {
            outcome: Outcome;
            ticket_id: string | null;
            fare_cents: number | null;
            payment_method: "wallet" | "cash" | null;
            stage?: string | null;
          }[]
        | null
    )?.[0];
    if (row?.outcome === "success" && row.ticket_id && row.fare_cents !== null) {
      setRedeemed({
        ticketId: row.ticket_id,
        fareCents: row.fare_cents,
        paymentMethod: row.payment_method ?? "wallet",
        stage: row.stage ?? "redeemed",
      });
    }
    setOutcome(row?.outcome ?? "invalid_code");
  };

  return (
    <main className="hwindi-shell">
      <header className="hwindi-header">
        <div className="hwindi-topline">
          <button
            className="hwindi-back"
            type="button"
            aria-label={t(lang, "keypad.changeRoute")}
            onClick={() => {
              setRoute(null);
              setCode("");
              void setMeta("shift", null);
            }}
          >
            <BackIcon />
          </button>
          <div className="hwindi-topline-right">
            {statusPill}
            {langToggle}
          </div>
        </div>
        <div className="hwindi-topline">
          <span className="hwindi-route-pill">
            {route.code}
            <span className="svika-mono-code">
              {t(lang, "route.towards")}{" "}
              {direction === "outbound" ? route.lastStop : route.firstStop}
            </span>
          </span>
          {vehicle && (
            // the shift's kombi, tappable to change it mid shift (a hwindi
            // does swap vehicles in a day)
            <button
              type="button"
              className="hwindi-route-pill hwindi-vehicle-pill touch-target"
              data-testid="shift-vehicle"
              onClick={() => setVehicleAsked(false)}
            >
              <span className="svika-mono-code">{vehicle.plate}</span>
            </button>
          )}
        </div>
        <p className="hwindi-keypad-title">{t(lang, "keypad.title")}</p>
      </header>

      <output className="hwindi-code" data-testid="code-display" aria-live="polite">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`hwindi-slot${code[i] ? " hwindi-slot-filled" : ""}`}
          >
            {code[i] ?? "·"}
          </span>
        ))}
      </output>

      <div className="hwindi-keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            className="hwindi-key touch-target"
            onClick={() => setCode((c) => appendDigit(c, d))}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className="hwindi-key hwindi-key-quiet touch-target"
          aria-label={t(lang, "keypad.erase")}
          onClick={() => setCode((c) => eraseDigit(c))}
        >
          <DeleteIcon />
        </button>
        <button
          type="button"
          className="hwindi-key touch-target"
          onClick={() => setCode((c) => appendDigit(c, "0"))}
        >
          0
        </button>
        <span aria-hidden className="hwindi-key-spacer" />
      </div>

      <button
        className="hwindi-cta touch-target"
        type="button"
        disabled={!isComplete(code) || busy}
        onClick={() => void submit()}
      >
        {busy ? t(lang, "keypad.busy") : t(lang, "keypad.clear")}
      </button>
    </main>
  );
}

// First use consent, hwindi sized: one screen, one action, big button.
// Accepting appends a consent_records row (the same table the rider app
// gates on); declining is signing out.
function Consent({
  lang,
  langToggle,
  userId,
  onAccepted,
}: {
  lang: Lang;
  langToggle: React.ReactNode;
  userId: string;
  onAccepted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    const { error: err } = await supabase.from("consent_records").insert({
      user_id: userId,
      action: "accepted",
      version: CONSENT_VERSION,
    });
    setBusy(false);
    if (err) {
      setError(true);
      return;
    }
    onAccepted();
  };

  return (
    <main className="hwindi-shell">
      <header className="hwindi-header">
        <div className="hwindi-topline">
          <span className="svika-meta">{t(lang, "app.brand")}</span>
          {langToggle}
        </div>
        <h1 className="svika-headline">{t(lang, "consent.title")}</h1>
      </header>
      <div className="hwindi-consent">
        <p className="svika-body">{t(lang, "consent.intro")}</p>
        <ul className="hwindi-consent-points">
          {(["consent.point1", "consent.point2", "consent.point3"] as const).map(
            (key) => (
              <li key={key} className="svika-body">
                {t(lang, key)}
              </li>
            ),
          )}
        </ul>
        {error && (
          <p className="hwindi-error svika-body">{t(lang, "consent.error")}</p>
        )}
        <button
          className="hwindi-cta touch-target"
          type="button"
          data-testid="hwindi-consent-accept"
          disabled={busy}
          onClick={() => void accept()}
        >
          {busy ? t(lang, "consent.busy") : t(lang, "consent.accept")}
        </button>
        <button
          className="hwindi-quiet"
          type="button"
          onClick={() => void supabase.auth.signOut()}
        >
          {t(lang, "keypad.signOut")}
        </button>
      </div>
    </main>
  );
}

function SignIn({
  lang,
  langToggle,
}: {
  lang: Lang;
  langToggle: React.ReactNode;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const canSubmit = useMemo(
    () => email.includes("@") && password.length >= 6,
    [email, password],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(false);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (err) setError(true);
  };

  return (
    <main className="hwindi-shell">
      <header className="hwindi-header">
        <div className="hwindi-topline">
          <span className="svika-meta">SVIKA · HWINDI</span>
          {langToggle}
        </div>
        <h1 className="svika-headline">{t(lang, "signin.title")}</h1>
        <p className="svika-meta hwindi-note-left">{t(lang, "signin.note")}</p>
      </header>
      <form className="hwindi-form" onSubmit={(e) => void submit(e)}>
        <label className="svika-meta" htmlFor="email">
          {t(lang, "signin.email")}
        </label>
        <input
          id="email"
          type="email"
          className="hwindi-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
        <label className="svika-meta" htmlFor="password">
          {t(lang, "signin.password")}
        </label>
        <input
          id="password"
          type="password"
          className="hwindi-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p className="hwindi-error svika-body">{t(lang, "signin.error")}</p>}
        <button
          className="hwindi-cta touch-target"
          type="submit"
          disabled={!canSubmit || busy}
        >
          {busy ? t(lang, "signin.busy") : t(lang, "signin.cta")}
        </button>
      </form>
    </main>
  );
}
