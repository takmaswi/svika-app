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

// The kombi board (batch K1): every vehicle on the corridor as the same
// facts card the map marker opens — the glanceable answer to "which kombi,
// and can I trust it". Positions are the simulated fleet (standing
// provenance chip); plates and seats are the seeded registry; trust states
// are rules over the fare ledger, unverified by default. Real positions
// arrive later from conductor shift GPS behind the same VehicleFeed
// adapter; nothing here changes when they do.
export default async function KombisPage() {
  const lang = await getLang();
  const supabase = await createClient();

  // V2 ruling 5 (2026-07-26): trust visibility is public value, so the board
  // works logged out. The RPC serves aggregates only (0037), and the one
  // identity shaped cell, "your stop", degrades on its own: a guest has no
  // saved trips under RLS, so the context falls back to the corridor's first
  // rank exactly as a new rider's does.
  const [corridorRes, savedRes, boardRes] = await Promise.all([
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
  ]);

  const corridorRows = (corridorRes.data ?? []) as unknown as CorridorStopRowLike[];
  const context = riderStopContext(corridorRows, savedRes.data);
  const profiles = joinFleetProfiles(
    SIM_VEHICLES.map((v) => v.id),
    (boardRes.data ?? []) as KombiBoardRow[],
  );

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
