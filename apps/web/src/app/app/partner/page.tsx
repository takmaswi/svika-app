import Link from "next/link";
import { redirect } from "next/navigation";
import {
  hasActiveConsent,
  PARTNER_CONSENT_VERSION,
  type ConsentRecord,
} from "@svika/shared";
import { getLang, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { setPartnerMode } from "@/lib/profile-actions";
import { BackIcon } from "@/components/icons";

// Svika Partner: the whole bargain on one screen, in plain words, with one
// switch and the rider's own numbers under it.
//
// Three sections and nothing else: what you would send, why it matters,
// what stays yours. Then the switch, off by default because it is a
// consent and consents are off until somebody says otherwise. Then the
// honest count of what this rider has actually added, read straight off
// their own rows through RLS: trips recorded, stops named, distance
// mapped. No badges, no streaks, no leaderboard, nobody compared to
// anybody. A partner is not a player.

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export default async function PartnerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved : "";
  const err = typeof params.err === "string" ? params.err : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?why=partner&next=%2Fapp%2Fpartner");

  const [consentRes, tripsRes, marksRes] = await Promise.all([
    supabase
      .from("consent_records")
      .select("action, created_at")
      .eq("user_id", user.id)
      .eq("version", PARTNER_CONSENT_VERSION),
    // only trips that actually carry a partner stamp count as contributions;
    // a trip recorded before opting in is the rider's own and nothing else
    supabase
      .from("rider_journeys")
      .select("id, distance_m")
      .eq("status", "complete")
      .not("partner_consent_version", "is", null),
    supabase
      .from("rider_journey_marks")
      .select("id", { count: "exact", head: true })
      .not("name", "is", null),
  ]);

  const isPartner = hasActiveConsent((consentRes.data ?? []) as ConsentRecord[]);
  const trips = tripsRes.data ?? [];
  const distanceM = trips.reduce(
    (sum, row) => sum + ((row.distance_m as number | null) ?? 0),
    0,
  );
  const stopsNamed = marksRes.count ?? 0;
  const hasContributed = trips.length > 0 || stopsNamed > 0;

  return (
    <main className="shell" data-testid="partner-screen" data-partner={isPartner}>
      <header className="screen-head">
        <Link href="/app/profile" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "partner.title")}</h1>
      </header>

      <section className="svika-card wallet-panel svika-animate-fade-up">
        <p className="svika-body">{t(lang, "partner.doorB")}</p>

        <h2 className="svika-title">{t(lang, "partner.whatH")}</h2>
        <ul className="partner-list svika-body">
          <li>{t(lang, "partner.what1")}</li>
          <li>{t(lang, "partner.what2")}</li>
          <li>{t(lang, "partner.what3")}</li>
        </ul>

        <h2 className="svika-title">{t(lang, "partner.whyH")}</h2>
        <p className="svika-body">{t(lang, "partner.whyB")}</p>

        <h2 className="svika-title">{t(lang, "partner.keepH")}</h2>
        <p className="svika-body">{t(lang, "partner.keepB")}</p>
      </section>

      <section
        className="svika-card wallet-panel svika-animate-fade-up svika-rise-2"
        data-testid="partner-switch"
      >
        <p className="svika-body partner-state" data-on={isPartner} data-testid="partner-state">
          {t(lang, isPartner ? "partner.on" : "partner.off")}
        </p>
        <p className="svika-body">
          {t(lang, isPartner ? "partner.onNote" : "partner.offNote")}
        </p>
        <form action={setPartnerMode}>
          <input type="hidden" name="from" value="partner" />
          <input type="hidden" name="value" value={isPartner ? "off" : "on"} />
          <button
            className={isPartner ? "auth-link touch-target" : "auth-submit touch-target"}
            type="submit"
            data-testid={isPartner ? "partner-off" : "partner-on"}
          >
            {t(lang, isPartner ? "partner.turnOff" : "partner.turnOn")}
          </button>
        </form>
        {saved === "partner-on" && (
          <p className="wallet-ok svika-body" data-testid="partner-saved-on">
            {t(lang, "partner.onNote")}
          </p>
        )}
        {saved === "partner-off" && (
          <p className="wallet-ok svika-body" data-testid="partner-saved-off">
            {t(lang, "partner.offNote")}
          </p>
        )}
        {err === "partner" && (
          <p className="auth-error svika-body">{t(lang, "profile.errGeneric")}</p>
        )}
      </section>

      <section
        className="svika-card wallet-panel svika-animate-fade-up svika-rise-3"
        data-testid="partner-contributions"
      >
        <h2 className="svika-title">{t(lang, "partner.contribH")}</h2>
        {hasContributed ? (
          <>
            <dl className="partner-counts">
              <div className="partner-count">
                <dt className="peek-label">{t(lang, "partner.contribTrips")}</dt>
                <dd className="peek-mono" data-testid="partner-trips">
                  {trips.length}
                </dd>
              </div>
              <div className="partner-count">
                <dt className="peek-label">{t(lang, "partner.contribStops")}</dt>
                <dd className="peek-mono" data-testid="partner-stops">
                  {stopsNamed}
                </dd>
              </div>
              <div className="partner-count">
                <dt className="peek-label">{t(lang, "partner.contribDistance")}</dt>
                <dd className="peek-mono" data-testid="partner-distance">
                  {formatDistance(distanceM)}
                </dd>
              </div>
            </dl>
            <p className="svika-meta">{t(lang, "partner.contribNote")}</p>
          </>
        ) : (
          <p className="svika-body empty-note" data-testid="partner-contrib-empty">
            {t(lang, "partner.contribEmpty")}
          </p>
        )}
      </section>

      <footer className="home-sheet-footer profile-footer">
        <Link className="auth-link touch-target" href="/app/privacy">
          {t(lang, "privacy.yourDataLink")}
        </Link>
      </footer>
    </main>
  );
}
