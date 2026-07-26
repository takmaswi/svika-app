import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { sendCredit, claimCredit, cancelTransfer } from "@/lib/actions";
import { formatUsd } from "@svika/shared";
import {
  HomeIcon,
  KombiIcon,
  PlusIcon,
  RidesIcon,
  WalletIcon,
} from "@/components/icons";

interface PostingRow {
  amount_cents: number;
  created_at: string;
  ledger_transactions: { kind: string; memo: string | null } | null;
}

interface GiftRow {
  ticket_id: string;
  tickets: {
    fare_cents: number;
    routes: { name: string } | null;
    board_codes:
      | { code: string; valid_until: string }
      | { code: string; valid_until: string }[]
      | null;
  } | null;
}

interface TransferRow {
  id: string;
  amount_cents: number;
  claim_code: string;
  expires_at: string;
  transfer_events: { event_type: string; created_at: string }[];
}

// The wallet (reference screen 5): the balance as the dark feature card with
// the change kept chip, ledger history as icon rows, transfer flows intact.
// Sending parks credit in escrow under a claim code; the code lives here,
// never in a URL.
export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const claimOutcome = typeof params.claim === "string" ? params.claim : "";
  const err = typeof params.err === "string" ? params.err : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [balanceRes, accountsRes, transfersRes, giftsRes] = await Promise.all([
    supabase
      .from("account_balances")
      .select("balance_cents")
      .eq("kind", "rider_wallet")
      .maybeSingle(),
    supabase.from("ledger_accounts").select("id"),
    supabase
      .from("credit_transfers")
      .select(
        "id, amount_cents, claim_code, expires_at, transfer_events(event_type, created_at)",
      )
      .order("created_at", { ascending: false })
      .limit(10),
    // V6: rides bought for someone else. RLS scopes this to the sender's own
    // gifts, and the embedded ticket comes back only because the sender is
    // still the ticket's buyer.
    supabase
      .from("ticket_gifts")
      .select(
        "ticket_id, tickets(fare_cents, routes(name), board_codes(code, valid_until))",
      )
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const accountIds = (accountsRes.data ?? []).map((a) => a.id as string);
  const { data: postings } = await supabase
    .from("ledger_postings")
    .select("amount_cents, created_at, ledger_transactions(kind, memo)")
    .in("account_id", accountIds)
    .order("created_at", { ascending: false })
    .limit(12);

  const balance = balanceRes.data?.balance_cents ?? 0;
  const history = (postings ?? []) as unknown as PostingRow[];
  // the change story: every cent a hwindi could not hand back, kept as credit
  const changeTotal = history
    .filter(
      (h) => h.ledger_transactions?.kind === "change_credit" && h.amount_cents > 0,
    )
    .reduce((sum, h) => sum + h.amount_cents, 0);
  const transfers = ((transfersRes.data ?? []) as unknown as TransferRow[]).filter(
    (tr) => {
      const latest = [...tr.transfer_events].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      )[0];
      return latest?.event_type === "sent";
    },
  );

  // a gift is still on this list while nobody has boarded it: the sender can
  // still hand it over or take it back. Status comes from the event stream,
  // never from a column.
  const giftRows = (giftsRes.data ?? []) as unknown as GiftRow[];
  const giftStatusRes = giftRows.length
    ? await supabase
        .from("ticket_status")
        .select("ticket_id, status")
        .in(
          "ticket_id",
          giftRows.map((g) => g.ticket_id),
        )
    : { data: [] };
  const giftStatus = new Map(
    (giftStatusRes.data ?? []).map((s) => [s.ticket_id as string, s.status as string]),
  );
  const sentRides = giftRows
    .filter((g) => (giftStatus.get(g.ticket_id) ?? "issued") === "issued")
    .map((g) => {
      const codes = g.tickets?.board_codes;
      const code = Array.isArray(codes) ? codes[0]?.code : codes?.code;
      return {
        id: g.ticket_id,
        fareCents: g.tickets?.fare_cents ?? 0,
        routeName: g.tickets?.routes?.name ?? "",
        code: code ?? "····",
      };
    });

  const claimMsgKey: DictKey | null =
    claimOutcome === "success"
      ? "wallet.claimed"
      : claimOutcome === "invalid_code"
        ? "wallet.claimInvalid"
        : claimOutcome === "already_claimed"
          ? "wallet.claimAlready"
          : claimOutcome === "rate_limited"
            ? "wallet.claimRateLimited"
            : null;

  return (
    <main className="shell">
      <h1 className="svika-headline">{t(lang, "wallet.title")}</h1>

      <section
        className="feature-card svika-animate-fade-up"
        data-testid="change-story"
      >
        <p className="feature-label">{t(lang, "wallet.balanceLabel")}</p>
        <p className="feature-amount" data-testid="wallet-balance">
          {formatUsd(balance)}
        </p>
        <div className="feature-chips">
          {changeTotal > 0 ? (
            <>
              <span className="change-chip">
                {t(lang, "wallet.changeChip")}
                <span className="svika-mono-code">{formatUsd(changeTotal)}</span>
              </span>
              <span className="feature-chip-note">{t(lang, "wallet.changeTotal")}</span>
            </>
          ) : (
            <span className="feature-chip-note">{t(lang, "wallet.changeNone")}</span>
          )}
        </div>
      </section>
      <p className="wallet-note svika-animate-fade-up svika-rise-2">
        {t(lang, "wallet.changeBody")}
      </p>

      <section className="svika-card wallet-panel svika-animate-fade-up svika-rise-3">
        <h2 className="svika-title">{t(lang, "wallet.sendTitle")}</h2>
        <p className="svika-meta empty-note">{t(lang, "wallet.sendHint")}</p>
        <form action={sendCredit} className="wallet-inline-form">
          <input
            name="amount"
            inputMode="decimal"
            placeholder="1.00"
            aria-label={t(lang, "wallet.sendAmount")}
            className="auth-input"
            required
          />
          <button className="auth-submit touch-target wallet-inline-cta" type="submit">
            {t(lang, "wallet.sendCta")}
          </button>
        </form>
        {err === "send" && (
          <p className="auth-error svika-body">{t(lang, "wallet.sendErr")}</p>
        )}

        {transfers.length > 0 && (
          <ul className="transfer-list">
            {transfers.map((tr) => (
              <li key={tr.id} className="transfer-item">
                <div>
                  <p className="svika-meta">
                    {t(lang, "wallet.sent")} ·{" "}
                    <span className="svika-mono-code">
                      {formatUsd(tr.amount_cents)}
                    </span>{" "}
                    · {t(lang, "wallet.pending")}
                  </p>
                  <p className="transfer-code svika-mono-code" data-testid="claim-code">
                    {tr.claim_code}
                  </p>
                </div>
                <form action={cancelTransfer}>
                  <input type="hidden" name="transfer" value={tr.id} />
                  <button className="auth-link" type="submit">
                    {t(lang, "wallet.cancel")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* V6: rides sent live beside credit sent, because they answer the same
          street moment. A gift the recipient has already used drops off this
          list on its own: there is nothing left to hand over or take back. */}
      {sentRides.length > 0 && (
        <section
          className="svika-card wallet-panel svika-animate-fade-up svika-rise-3"
          data-testid="sent-rides"
        >
          <h2 className="svika-title">{t(lang, "gift.sentTitle")}</h2>
          <ul className="transfer-list">
            {sentRides.map((ride) => (
              <li key={ride.id} className="transfer-item">
                <div>
                  <p className="svika-meta">
                    {ride.routeName} ·{" "}
                    <span className="svika-mono-code">{formatUsd(ride.fareCents)}</span>{" "}
                    · {t(lang, "gift.sentPending")}
                  </p>
                  <p className="transfer-code svika-mono-code" data-testid="sent-ride-code">
                    {ride.code}
                  </p>
                </div>
                <Link className="auth-link" href={`/app/gift/${ride.id}`}>
                  {t(lang, "gift.sentOpen")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="svika-card wallet-panel svika-animate-fade-up svika-rise-4">
        <h2 className="svika-title">{t(lang, "wallet.claimTitle")}</h2>
        <form action={claimCredit} className="wallet-inline-form">
          <input
            name="code"
            autoComplete="off"
            placeholder="AB2CD3"
            aria-label={t(lang, "wallet.claimLabel")}
            className="auth-input wallet-claim-input"
            required
          />
          <button className="auth-submit touch-target wallet-inline-cta" type="submit">
            {t(lang, "wallet.claimCta")}
          </button>
        </form>
        {claimMsgKey && (
          <p
            className={`svika-body ${claimOutcome === "success" ? "wallet-ok" : "auth-error"}`}
            data-testid="claim-result"
          >
            {t(lang, claimMsgKey)}
          </p>
        )}
      </section>

      <section className="svika-animate-fade-up svika-rise-5">
        <div className="section-head">
          <h2>{t(lang, "wallet.history")}</h2>
        </div>
        <ul className="history-list">
          {history.map((h, i) => {
            const kind = h.ledger_transactions?.kind ?? "adjustment";
            const key = `wallet.txn.${kind}` as DictKey;
            const isCredit = h.amount_cents > 0;
            return (
              <li key={i} className="history-item">
                <span
                  className={`txn-chip${isCredit ? " txn-chip-credit" : ""}`}
                  aria-hidden
                >
                  {isCredit ? <PlusIcon size={16} /> : <KombiIcon size={16} />}
                </span>
                <span className="history-kind">{t(lang, key)}</span>
                <span
                  className={`history-amount${isCredit ? " history-amount-credit" : ""}`}
                >
                  {formatUsd(h.amount_cents)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <nav className="tab-nav tab-nav-flow" aria-label="Primary">
        <Link className="tab-item" href="/app">
          <HomeIcon />
          {t(lang, "nav.home")}
        </Link>
        <Link className="tab-item" href="/app?sheet=open">
          <RidesIcon />
          {t(lang, "nav.rides")}
        </Link>
        <span className="tab-item tab-item-active" aria-current="page">
          <WalletIcon />
          {t(lang, "nav.wallet")}
        </span>
      </nav>
    </main>
  );
}
