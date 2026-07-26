import Link from "next/link";
import { getLang, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { BackIcon } from "@/components/icons";
import { KombiBoard } from "@/components/kombi/KombiBoard";
import { CORRIDOR_ROUTE_CODE } from "@/lib/map/corridor-data";
import { riderStopContext, type CorridorStopRowLike } from "@/lib/kombi/context";
import { joinFleetProfiles, type KombiBoardRow } from "@/lib/kombi/fleet";
import { kombiStrings } from "@/lib/kombi/strings";
import { SIM_VEHICLES } from "@/lib/map/sim-config";
import { raiseBeacon, withdrawBeacon } from "@/lib/beacon-actions";

// The kombi board (batch K1): every vehicle on the corridor as the same
// facts card the map marker opens — the glanceable answer to "which kombi,
// and can I trust it". Positions are the simulated fleet (standing
// provenance chip); plates and seats are the seeded registry; trust states
// are rules over the fare ledger, unverified by default. Real positions
// arrive later from conductor shift GPS behind the same VehicleFeed
// adapter; nothing here changes when they do.
//
// V8 adds the demand beacon to this screen, because this is the screen a
// rider opens while standing at a rank looking for a kombi. It is a signal
// only: it tells conductors on the route how many people are waiting, it
// expires in twenty minutes, and nobody can respond to it. The copy says so.
export default async function KombisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const beaconState = (await searchParams).beacon;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // V2 ruling 5 (2026-07-26): trust visibility is public value, so the board
  // works logged out. The RPC serves aggregates only (0037), and the one
  // identity shaped cell, "your stop", degrades on its own: a guest has no
  // saved trips under RLS, so the context falls back to the corridor's first
  // rank exactly as a new rider's does.
  const [corridorRes, savedRes, boardRes, routeRes, beaconRes] = await Promise.all([
    supabase
      .from("route_stops")
      .select("stop_id, seq, stops(name), routes!inner(code)")
      .eq("routes.code", CORRIDOR_ROUTE_CODE)
      .eq("direction", "outbound")
      .order("seq"),
    supabase
      .from("saved_trips")
      .select("from_stop_id, to_stop_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("kombi_board"),
    supabase.from("routes").select("id").eq("code", CORRIDOR_ROUTE_CODE).maybeSingle(),
    // the rider's own live beacon. Read through the RPC rather than the table
    // so "still live" is answered by the database's clock: a web server a few
    // seconds behind Supabase must never show a withdrawn beacon as live.
    user ? supabase.rpc("my_beacon") : Promise.resolve({ data: null }),
  ]);

  const corridorRows = (corridorRes.data ?? []) as unknown as CorridorStopRowLike[];
  const context = riderStopContext(corridorRows, savedRes.data);
  const profiles = joinFleetProfiles(
    SIM_VEHICLES.map((v) => v.id),
    (boardRes.data ?? []) as KombiBoardRow[],
  );
  const routeId = routeRes.data?.id as string | undefined;
  const liveBeacon =
    ((beaconRes.data ?? []) as { stop_id: string; minutes_left: number }[])[0] ?? null;
  const beaconMinutes = Math.max(0, liveBeacon?.minutes_left ?? 0);

  return (
    <main className="shell">
      <header className="screen-head">
        <Link href="/app" className="back-btn" aria-label={t(lang, "kombi.boardBack")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "kombi.boardTitle")}</h1>
      </header>

      <p className="kombi-board-chip svika-animate-fade-up">
        <span className="svika-live-dot" aria-hidden>
          <span className="svika-ripple-ring" />
          <span className="svika-pulse-dot" />
        </span>
        <span className="svika-meta">{t(lang, "map.demoChip")}</span>
      </p>

      {/* V8: the beacon. One tap, twenty minutes, a count and nothing else. */}
      {user && context && routeId && (
        <section
          className="svika-card beacon-card svika-animate-fade-up"
          data-testid="beacon-card"
          data-state={liveBeacon ? "live" : "idle"}
        >
          {liveBeacon ? (
            <>
              <p className="svika-body beacon-live" data-testid="beacon-live">
                {t(lang, "beacon.live")
                  .replace("{stop}", context.stopName)
                  .replace("{minutes}", String(beaconMinutes))}
              </p>
              <form action={withdrawBeacon}>
                <button
                  className="auth-link touch-target"
                  type="submit"
                  data-testid="beacon-withdraw"
                >
                  {t(lang, "beacon.withdraw")}
                </button>
              </form>
            </>
          ) : (
            <form action={raiseBeacon} className="beacon-form">
              <input type="hidden" name="route" value={routeId} />
              <input type="hidden" name="direction" value={context.direction} />
              <input type="hidden" name="stop" value={context.stopId} />
              <button
                className="auth-submit touch-target beacon-cta"
                type="submit"
                data-testid="beacon-raise"
              >
                {t(lang, "beacon.raise")
                  .replace("{stop}", context.stopName)
                  .replace("{terminus}", context.terminus[context.direction])}
              </button>
            </form>
          )}
          <p className="svika-meta beacon-law" data-testid="beacon-law">
            {t(lang, "beacon.law")}
          </p>
          {beaconState === "rate_limited" && (
            <p className="auth-error svika-body">{t(lang, "beacon.tooMany")}</p>
          )}
          {beaconState === "error" && (
            <p className="auth-error svika-body">{t(lang, "beacon.error")}</p>
          )}
        </section>
      )}

      {context ? (
        <KombiBoard
          profiles={profiles}
          stopId={context.stopId}
          stopName={context.stopName}
          direction={context.direction}
          terminus={context.terminus}
          strings={kombiStrings(lang)}
        />
      ) : (
        <p className="svika-body empty-note">{t(lang, "map.unavailable")}</p>
      )}
    </main>
  );
}
