import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import {
  acceptGuardianInvite,
  createGuardianInvite,
  revokeGuardianLink,
} from "@/lib/family-actions";
import { deriveTripState, type GuardianTripState } from "@/lib/family/trip-state";
import { BackIcon } from "@/components/icons";

interface FamilyLinkRow {
  link_id: string;
  role: "guardian" | "child";
  other_name: string;
  status: "invited" | "active";
  invite_code: string | null;
  invite_expires_at: string;
  confirmed_at: string | null;
}

interface ChildTripRow {
  link_id: string;
  child_name: string;
  route_name: string;
  direction: "outbound" | "inbound";
  from_stop_name: string | null;
  to_stop_name: string | null;
  trip_status: string;
  status_at: string;
  purchased_at: string;
  expected_minutes: number | null;
}

const STATE_KEY: Record<GuardianTripState, DictKey> = {
  booked: "family.state.booked",
  riding: "family.state.riding",
  late: "family.state.late",
  arrived: "family.state.arrived",
  ended: "family.state.ended",
};

// Family (batch V3). Two hats on one screen: who sees YOUR trips (with the
// only way in: a code you chose to enter, and the only way out: one tap),
// and the people YOU watch over. Trip states are plain rules over status
// and timing (lib/family/trip-state.ts); the copy flags situations, never
// people. Mutual confirm is structural: a link starts invited and only the
// other side's own phone can make it active.
export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const err = typeof params.err === "string" ? params.err : "";
  const linked = params.linked === "1";
  const ended = params.ended === "1";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [linksRes, tripsRes] = await Promise.all([
    supabase.rpc("my_family_links"),
    supabase.rpc("guardian_child_trips"),
  ]);
  const links = (linksRes.data ?? []) as FamilyLinkRow[];
  const trips = (tripsRes.data ?? []) as ChildTripRow[];

  const myGuardians = links.filter((l) => l.role === "child" && l.status === "active");
  const pendingInvite = links.find(
    (l) => l.role === "guardian" && l.status === "invited",
  );
  const myChildren = links.filter(
    (l) => l.role === "guardian" && l.status === "active",
  );

  // one card per child: their newest trip carries the state
  const now = Date.now();
  const latestByLink = new Map<string, ChildTripRow>();
  for (const trip of trips) {
    if (!latestByLink.has(trip.link_id)) latestByLink.set(trip.link_id, trip);
  }

  const toWord = t(lang, "common.to");
  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-ZW", { hour: "2-digit", minute: "2-digit" });

  return (
    <main className="shell">
      <header className="screen-head">
        <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "family.title")}</h1>
      </header>

      {/* who sees your trips: the child's side, first because dignity is the law */}
      <section
        className="svika-card wallet-panel svika-animate-fade-up"
        data-testid="family-as-child"
      >
        <h2 className="svika-title">{t(lang, "family.asChildH")}</h2>
        {linked && (
          <p className="guide-cue" data-testid="family-linked-note">
            {t(lang, "family.acceptOk").replace(
              "{name}",
              myGuardians[0]?.other_name || t(lang, "family.title"),
            )}
          </p>
        )}
        {ended && (
          <p className="wallet-ok svika-body" data-testid="family-ended-note">
            {t(lang, "family.asChildNone")}
          </p>
        )}
        {myGuardians.length === 0 ? (
          !linked &&
          !ended && (
            <p className="svika-body empty-note" data-testid="family-no-guardian">
              {t(lang, "family.asChildNone")}
            </p>
          )
        ) : (
          <ul className="profile-trip-list">
            {myGuardians.map((g) => (
              <li key={g.link_id} className="profile-trip svika-card" data-testid="family-guardian-row">
                <p className="svika-body profile-trip-name">{g.other_name}</p>
                {g.confirmed_at && (
                  <p className="svika-meta profile-trip-route">
                    {t(lang, "family.linkedSince")}{" "}
                    <span className="svika-mono-code">
                      {new Date(g.confirmed_at).toLocaleDateString("en-ZW")}
                    </span>
                  </p>
                )}
                <form action={revokeGuardianLink}>
                  <input type="hidden" name="link" value={g.link_id} />
                  <button
                    className="auth-link touch-target"
                    type="submit"
                    data-testid="family-end-link"
                  >
                    {t(lang, "family.endCta")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <h3 className="svika-meta privacy-heading">{t(lang, "family.acceptH")}</h3>
        <p className="svika-body">{t(lang, "family.acceptB")}</p>
        <form action={acceptGuardianInvite} className="wallet-inline-form">
          <input
            name="code"
            className="auth-input svika-mono-code"
            maxLength={12}
            minLength={12}
            autoComplete="off"
            spellCheck={false}
            aria-label={t(lang, "family.codeLabel")}
            placeholder={t(lang, "family.codeLabel")}
            data-testid="family-code-input"
            required
          />
          <button
            className="auth-submit touch-target wallet-inline-cta"
            type="submit"
            data-testid="family-code-confirm"
          >
            {t(lang, "family.acceptCta")}
          </button>
        </form>
        {err === "invalid" && (
          <p className="auth-error svika-body" data-testid="family-err-invalid">
            {t(lang, "family.errInvalid")}
          </p>
        )}
        {err === "limited" && (
          <p className="auth-error svika-body" data-testid="family-err-limited">
            {t(lang, "family.errLimited")}
          </p>
        )}
      </section>

      {/* the guardian's side: mint, hand over, watch */}
      <section
        className="svika-card wallet-panel svika-animate-fade-up svika-rise-2"
        data-testid="family-as-guardian"
      >
        <h2 className="svika-title">{t(lang, "family.guardianH")}</h2>
        <p className="svika-body">{t(lang, "family.guardianB")}</p>
        {pendingInvite ? (
          <>
            <p className="svika-meta">{t(lang, "family.inviteLabel")}</p>
            <p className="ticket-code family-invite-code" data-testid="family-invite-code">
              {pendingInvite.invite_code}
            </p>
            <p className="svika-meta">{t(lang, "family.inviteExpiry")}</p>
            <form action={revokeGuardianLink}>
              <input type="hidden" name="link" value={pendingInvite.link_id} />
              <button className="auth-link touch-target" type="submit">
                {t(lang, "family.cancelInvite")}
              </button>
            </form>
          </>
        ) : (
          <form action={createGuardianInvite}>
            <button
              className="auth-submit touch-target"
              type="submit"
              data-testid="family-invite-create"
            >
              {t(lang, "family.inviteCta")}
            </button>
          </form>
        )}
        {err === "invite" && (
          <p className="auth-error svika-body">{t(lang, "family.errInvalid")}</p>
        )}

        {myChildren.length > 0 && (
          <>
            <h3 className="svika-meta privacy-heading">{t(lang, "family.tripsH")}</h3>
            <ul className="profile-trip-list" data-testid="family-child-trips">
              {myChildren.map((child) => {
                const trip = latestByLink.get(child.link_id);
                const state = trip
                  ? deriveTripState(
                      trip.trip_status,
                      Date.parse(trip.status_at),
                      trip.expected_minutes,
                      now,
                    )
                  : null;
                return (
                  <li
                    key={child.link_id}
                    className="profile-trip svika-card"
                    data-testid="family-child-row"
                  >
                    <p className="svika-body profile-trip-name">{child.other_name}</p>
                    {trip && state ? (
                      <>
                        <p className="svika-meta profile-trip-route">
                          {trip.route_name}
                          {trip.from_stop_name && trip.to_stop_name
                            ? ` · ${trip.from_stop_name} ${toWord} ${trip.to_stop_name}`
                            : ""}{" "}
                          · <span className="svika-mono-code">{timeOf(trip.status_at)}</span>
                        </p>
                        <p
                          className={`guide-cue${state === "late" ? " guide-cue-warn" : ""}${
                            state === "booked" || state === "riding" || state === "ended"
                              ? " family-state-plain"
                              : ""
                          }`}
                          data-testid="family-trip-state"
                          data-state={state}
                        >
                          {t(lang, STATE_KEY[state])}
                        </p>
                        <form action={revokeGuardianLink}>
                          <input type="hidden" name="link" value={child.link_id} />
                          <button className="auth-link touch-target" type="submit">
                            {t(lang, "family.endCta")}
                          </button>
                        </form>
                      </>
                    ) : (
                      <>
                        <p className="svika-body empty-note">
                          {t(lang, "family.tripsNone")}
                        </p>
                        <form action={revokeGuardianLink}>
                          <input type="hidden" name="link" value={child.link_id} />
                          <button className="auth-link touch-target" type="submit">
                            {t(lang, "family.endCta")}
                          </button>
                        </form>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
