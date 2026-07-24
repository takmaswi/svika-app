import Link from "next/link";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { formatUsd } from "@svika/shared";
import { BackIcon } from "@/components/icons";
import { boardCodesOf, type BoardCodeEmbed } from "@/lib/tickets";
import { createRideShare, revokeRideShare } from "@/lib/share-actions";

interface TicketDetail {
  id: string;
  fare_cents: number;
  payment_method: "wallet" | "cash";
  direction: "outbound" | "inbound";
  routes: { name: string } | null;
  from_stop: { name: string } | null;
  to_stop: { name: string } | null;
  board_codes: BoardCodeEmbed | BoardCodeEmbed[] | null;
}

// The ticket (reference screen 4): a char card on white by day, a white card
// on char by night. One big mono code the hwindi can read from across the
// kombi, a perforated fold, and the stamp moment when the fare clears. RLS
// means a rider can only ever open their own ticket here.
export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const { id } = await params;
  const shareState = (await searchParams).share;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [ticketRes, statusRes, shareRes] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id, fare_cents, payment_method, direction, routes(name), from_stop:stops!tickets_from_stop_id_fkey(name), to_stop:stops!tickets_to_stop_id_fkey(name), board_codes(code, valid_until)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("ticket_status").select("status").eq("ticket_id", id).maybeSingle(),
    supabase
      .from("ride_shares")
      .select("id, token, expires_at")
      .eq("ticket_id", id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const ticket = ticketRes.data as unknown as TicketDetail | null;
  if (!ticket) notFound();

  const status = (statusRes.data?.status as string) ?? "issued";
  const statusKey = `ticket.status.${status}` as DictKey;
  const boardCode = boardCodesOf(ticket.board_codes)[0];
  const validUntil = boardCode
    ? new Date(boardCode.valid_until).toLocaleTimeString("en-ZW", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const endpointsLine =
    ticket.from_stop && ticket.to_stop
      ? `${ticket.from_stop.name} ${t(lang, "common.to")} ${ticket.to_stop.name}`
      : "";
  const isLive = status === "issued";
  const isStamped = status === "redeemed";

  // share my ride: only a running trip can be shared, and the link is shown
  // right here (never in a URL we control the logging of)
  const share = shareRes.data;
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const shareUrl = share ? `${proto}://${host}/share/${share.token}` : "";

  return (
    <main className="shell">
      <header className="screen-head">
        <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "ticket.screenTitle")}</h1>
      </header>

      <article
        className={`boarding-card svika-animate-fade-up${isLive ? "" : " boarding-card-done"}`}
        data-status={status}
      >
        <div className="boarding-head">
          <div>
            <p className="boarding-route">{ticket.routes?.name ?? ""}</p>
            {endpointsLine && <p className="boarding-endpoints">{endpointsLine}</p>}
          </div>
          <span className="ticket-chip">{formatUsd(ticket.fare_cents)}</span>
        </div>
        {!isLive && !isStamped && (
          <div className="boarding-head">
            <span className="boarding-status">{t(lang, statusKey)}</span>
          </div>
        )}

        <div className="boarding-perf" aria-hidden />

        <div className="boarding-body">
          <p className="boarding-label">{t(lang, "ticket.title")}</p>
          <p className="ticket-code" data-testid="board-code">
            {boardCode?.code ?? "····"}
          </p>
          {isLive && (
            <p className="ticket-hint">{t(lang, "ticket.showHwindi")}</p>
          )}
          <div className="boarding-pay-row">
            <span className="boarding-fare">{formatUsd(ticket.fare_cents)}</span>
            <span
              className={`pay-chip${
                ticket.payment_method === "cash" ? " pay-chip-cash" : ""
              }`}
            >
              {t(
                lang,
                ticket.payment_method === "cash"
                  ? "ticket.payCash"
                  : "ticket.paidWallet",
              )}
            </span>
          </div>
          {isLive && validUntil && (
            <p className="boarding-valid">
              {t(lang, "ticket.validUntil")}{" "}
              <span className="svika-mono-code">{validUntil}</span>
            </p>
          )}
          {isStamped && (
            // outer span owns the centring transform; the stamp animation
            // owns transform on the inner one, they must not share
            <span className="boarding-stamp-anchor" aria-hidden>
              <span className="boarding-stamp svika-animate-stamp">
                {t(lang, statusKey)}
              </span>
            </span>
          )}
        </div>
      </article>

      {(isLive || isStamped) && (
        <section
          className="svika-card wallet-panel svika-animate-fade-up svika-rise-3"
          data-testid="share-section"
        >
          <h2 className="svika-title">{t(lang, "share.sectionH")}</h2>
          <p className="svika-body">{t(lang, "share.sectionB")}</p>
          {share ? (
            <>
              <p className="svika-meta">{t(lang, "share.linkLabel")}</p>
              <p className="share-url svika-mono-code" data-testid="share-url">
                {shareUrl}
              </p>
              <form action={revokeRideShare}>
                <input type="hidden" name="ticket" value={id} />
                <input type="hidden" name="share" value={share.id} />
                <button
                  className="auth-link touch-target"
                  type="submit"
                  data-testid="share-revoke"
                >
                  {t(lang, "share.revokeCta")}
                </button>
              </form>
              <p className="svika-meta">{t(lang, "share.expiryNote")}</p>
            </>
          ) : (
            <form action={createRideShare}>
              <input type="hidden" name="ticket" value={id} />
              <button
                className="auth-submit touch-target"
                type="submit"
                data-testid="share-create"
              >
                {t(lang, "share.createCta")}
              </button>
            </form>
          )}
          {shareState === "revoked" && (
            <p className="wallet-ok svika-body" data-testid="share-revoked">
              {t(lang, "share.revokedNote")}
            </p>
          )}
          {shareState === "err" && (
            <p className="auth-error svika-body">{t(lang, "share.err")}</p>
          )}
        </section>
      )}

      {isLive && (
        <Link
          className="auth-link touch-target"
          href="/app/record?mode=kombi"
          data-testid="record-link"
        >
          {t(lang, "journey.record")}
        </Link>
      )}
    </main>
  );
}
