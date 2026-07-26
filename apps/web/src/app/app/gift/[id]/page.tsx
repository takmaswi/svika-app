import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { formatUsd } from "@svika/shared";
import { BackIcon } from "@/components/icons";
import { boardCodesOf, type BoardCodeEmbed } from "@/lib/tickets";
import { revokeGift } from "@/lib/actions";
import { GiftShareButton } from "@/components/ticket/GiftShareButton";

interface GiftTicket {
  id: string;
  fare_cents: number;
  direction: "outbound" | "inbound";
  routes: { name: string } | null;
  from_stop: { name: string } | null;
  to_stop: { name: string } | null;
  board_codes: BoardCodeEmbed | BoardCodeEmbed[] | null;
}

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

// The gifted ride (batch V6). Same boarding card the rider's own ticket
// wears, because it IS a ticket: the difference is who reads the code. This
// screen has one job, handing that code over, so the share sheet is the one
// primary action and taking it back is the quiet second line.
//
// The recipient never appears anywhere: Svika does not ask who they are, does
// not store a name or a number, and has no way to message them. The sender's
// own phone carries the code, in whatever app they already use.
export default async function GiftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const { id } = await params;
  const done = (await searchParams).done;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [ticketRes, statusRes, giftRes] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id, fare_cents, direction, routes(name), from_stop:stops!tickets_from_stop_id_fkey(name), to_stop:stops!tickets_to_stop_id_fkey(name), board_codes(code, valid_until)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("ticket_status").select("status").eq("ticket_id", id).maybeSingle(),
    supabase.from("ticket_gifts").select("ticket_id").eq("ticket_id", id).maybeSingle(),
  ]);

  const ticket = ticketRes.data as unknown as GiftTicket | null;
  // RLS already scopes tickets to their buyer; a ticket that is not a gift
  // belongs on the ticket screen, not here
  if (!ticket || !giftRes.data) notFound();

  const status = (statusRes.data?.status as string) ?? "issued";
  const boardCode = boardCodesOf(ticket.board_codes)[0];
  const validUntil = boardCode
    ? new Date(boardCode.valid_until).toLocaleTimeString("en-ZW", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const live = status === "issued";
  const boarded = status === "redeemed" || status === "arrived";
  const revoked = status === "cancelled";
  const endpoints =
    ticket.from_stop && ticket.to_stop
      ? `${ticket.from_stop.name} ${t(lang, "common.to")} ${ticket.to_stop.name}`
      : "";

  // the whole message, readable on its own in whatever app carries it
  const shareMessage = fill(t(lang, "gift.shareMessage"), {
    trip: endpoints,
    code: boardCode?.code ?? "",
    time: validUntil,
  });

  return (
    <main className="shell">
      <header className="screen-head">
        <Link href="/app/wallet" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "gift.screenTitle")}</h1>
      </header>

      <article
        className={`boarding-card svika-animate-fade-up${live ? "" : " boarding-card-done"}`}
        data-status={status}
        data-testid="gift-card"
      >
        <div className="boarding-head">
          <div>
            <p className="boarding-route">{ticket.routes?.name ?? ""}</p>
            {endpoints && <p className="boarding-endpoints">{endpoints}</p>}
          </div>
          <span className="ticket-chip">{formatUsd(ticket.fare_cents)}</span>
        </div>

        <div className="boarding-perf" aria-hidden />

        <div className="boarding-body">
          <p className="boarding-label">{t(lang, "gift.codeLabel")}</p>
          <p className="ticket-code" data-testid="gift-code">
            {boardCode?.code ?? "····"}
          </p>
          {live && <p className="ticket-hint">{t(lang, "gift.codeHint")}</p>}
          {live && validUntil && (
            <p className="boarding-valid">
              {t(lang, "ticket.validUntil")}{" "}
              <span className="svika-mono-code">{validUntil}</span>
            </p>
          )}
          {(boarded || revoked) && (
            <span className="boarding-stamp-anchor" aria-hidden>
              <span className="boarding-stamp svika-animate-stamp">
                {t(lang, (boarded ? "gift.stampBoarded" : "gift.stampBack") as DictKey)}
              </span>
            </span>
          )}
        </div>
      </article>

      {live && (
        <>
          <div className="gift-send">
            <GiftShareButton
              message={shareMessage}
              sendLabel={t(lang, "gift.sendCta")}
              copyLabel={t(lang, "gift.copyCta")}
              copiedLabel={t(lang, "gift.copiedCta")}
            />
          </div>
          <p className="svika-meta gift-privacy">{t(lang, "gift.privacy")}</p>
          <form action={revokeGift} className="gift-revoke">
            <input type="hidden" name="ticket" value={id} />
            <button className="auth-link touch-target" type="submit" data-testid="gift-revoke">
              {t(lang, "gift.revokeCta")}
            </button>
          </form>
        </>
      )}

      {boarded && (
        <p className="svika-body gift-note" data-testid="gift-boarded">
          {t(lang, "gift.boardedNote")}
        </p>
      )}
      {revoked && (
        <p className="wallet-ok svika-body" data-testid="gift-revoked">
          {t(lang, "gift.revokedNote")}
        </p>
      )}
      {done === "already_boarded" && (
        <p className="auth-error svika-body" data-testid="gift-too-late">
          {t(lang, "gift.tooLate")}
        </p>
      )}

      <Link className="auth-link touch-target" href="/app/wallet">
        {t(lang, "gift.backToWallet")}
      </Link>
    </main>
  );
}
