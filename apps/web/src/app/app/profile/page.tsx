import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  hasActiveConsent,
  PARTNER_CONSENT_VERSION,
  type ConsentRecord,
} from "@svika/shared";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { greetingKey } from "@/lib/greeting";
import { deriveRideStats, ridesSince } from "@/lib/ride-stats";
import {
  deleteSavedTrip,
  removeEmergencyDetails,
  renameSavedTrip,
  saveEmergencyDetails,
  setPartnerMode,
  setPref,
  updateIdentity,
} from "@/lib/profile-actions";
import { BackIcon } from "@/components/icons";
import { PrefToggle } from "@/components/profile/PrefToggle";
import { InitialAvatar } from "@/components/profile/InitialAvatar";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/SignOutButton";

interface SavedTripRow {
  id: string;
  nickname: string;
  from_stop: { name: string } | null;
  to_stop: { name: string } | null;
}

interface RideRow {
  purchased_at: string;
  from_stop: { name: string } | null;
  to_stop: { name: string } | null;
  routes: { name: string } | null;
}

const GREETING_KEY: Record<ReturnType<typeof greetingKey>, DictKey> = {
  morning: "profile.greetMorning",
  afternoon: "profile.greetAfternoon",
  evening: "profile.greetEvening",
};

// The rider's home for themselves (unreferenced screen). Top to bottom: a warm
// welcome header (greeting, name, initial avatar, honest ride stats), saved
// trips as friendly cards, then every control folded under one Settings group.
// The welcome patterns are extract-only spec gap proposals; everything else is
// composed from the numbered reference screens.
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved : "";
  const err = typeof params.err === "string" ? params.err : "";
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    profileRes,
    tripsRes,
    ridesRes,
    prefsRes,
    emergencyRes,
    sinceRes,
    partnerRes,
  ] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, demo_sim")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("saved_trips")
        .select(
          "id, nickname, from_stop:stops!saved_trips_from_stop_id_fkey(name), to_stop:stops!saved_trips_to_stop_id_fkey(name)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("tickets")
        .select(
          "purchased_at, routes(name), from_stop:stops!tickets_from_stop_id_fkey(name), to_stop:stops!tickets_to_stop_id_fkey(name)",
        )
        .eq("kind", "fare")
        .order("purchased_at", { ascending: true }),
      supabase.from("rider_prefs").select("*").maybeSingle(),
      supabase.from("emergency_details").select("*").maybeSingle(),
      // pooled demo personas are reused across judges; my_demo_since returns
      // when this judge claimed the persona so their profile shows only this
      // visit's rides, not a stranger's. Null for named personas and real
      // riders, whose full history stands.
      supabase.rpc("my_demo_since"),
      // partner mode has no column: the newest row in the partner-v1
      // consent stream is the whole answer (migration 0047)
      supabase
        .from("consent_records")
        .select("action, created_at")
        .eq("user_id", user.id)
        .eq("version", PARTNER_CONSENT_VERSION),
    ]);

  const isPartner = hasActiveConsent((partnerRes.data ?? []) as ConsentRecord[]);
  const profile = profileRes.data;
  const trips = (tripsRes.data ?? []) as unknown as SavedTripRow[];
  const demoSince = typeof sinceRes.data === "string" ? sinceRes.data : null;
  const allRides = (ridesRes.data ?? []) as unknown as RideRow[];
  const prefs = prefsRes.data;
  const emergency = emergencyRes.data;
  const toWord = t(lang, "common.to");

  const greeting = t(lang, GREETING_KEY[greetingKey(new Date())]);
  const displayName = profile?.full_name?.trim() || t(lang, "profile.welcomeNoName");
  const rideFacts = ridesSince(
    allRides.map((r) => ({
      purchasedAt: r.purchased_at,
      fromName: r.from_stop?.name ?? null,
      toName: r.to_stop?.name ?? null,
      routeName: r.routes?.name ?? null,
    })),
    demoSince,
  );
  const stats = deriveRideStats(rideFacts, new Date());
  const faveLabel = stats.favourite
    ? "from" in stats.favourite
      ? `${stats.favourite.from} ${toWord} ${stats.favourite.to}`
      : stats.favourite.route
    : "—";

  const errKey: DictKey | null =
    err === "consent"
      ? "profile.errConsent"
      : err === "empty"
        ? "profile.errEmpty"
        : err
          ? "profile.errGeneric"
          : null;

  return (
    <main className="shell">
      <header className="screen-head">
        <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "profile.title")}</h1>
      </header>

      <section
        className="profile-welcome svika-animate-fade-up"
        data-testid="profile-welcome"
      >
        <div className="welcome-head">
          <InitialAvatar name={profile?.full_name} size="lg" />
          <div className="welcome-id">
            <p className="welcome-greeting svika-meta">{greeting}</p>
            <p className="welcome-name svika-headline" data-testid="welcome-name">
              {displayName}
            </p>
          </div>
        </div>

        <div className="welcome-stats" data-testid="profile-rides">
          {stats.total === 0 ? (
            <p className="svika-body empty-note welcome-empty">
              {t(lang, "profile.statsEmpty")}
            </p>
          ) : (
            <>
              <div className="stat-tile">
                <p className="peek-label">{t(lang, "profile.statTotal")}</p>
                <p className="peek-mono">{stats.total}</p>
              </div>
              <div className="stat-tile">
                <p className="peek-label">{t(lang, "profile.statMonth")}</p>
                <p className="peek-mono">{stats.thisMonth}</p>
              </div>
              <div className="stat-tile stat-tile-fave">
                <p className="peek-label">{t(lang, "profile.statFave")}</p>
                <p className="stat-fave svika-sub">{faveLabel}</p>
              </div>
            </>
          )}
        </div>

        {profile?.demo_sim && stats.total > 0 && (
          <p className="welcome-demo svika-meta" data-testid="welcome-demo-note">
            {t(lang, "profile.statsDemo")}
          </p>
        )}
      </section>

      <section
        className="profile-trips svika-animate-fade-up svika-rise-2"
        data-testid="profile-trips"
      >
        <h2 className="svika-title profile-block-head">{t(lang, "profile.tripsH")}</h2>
        {trips.length === 0 ? (
          <p className="svika-body empty-note">{t(lang, "profile.tripsNone")}</p>
        ) : (
          <ul className="profile-trip-list">
            {trips.map((trip) => (
              <li key={trip.id} className="profile-trip svika-card">
                <p className="svika-body profile-trip-name">{trip.nickname}</p>
                <p className="svika-meta profile-trip-route">
                  {trip.from_stop?.name} {toWord} {trip.to_stop?.name}
                </p>
                <div className="profile-trip-actions">
                  <form action={renameSavedTrip} className="wallet-inline-form">
                    <input type="hidden" name="trip" value={trip.id} />
                    <input
                      name="nickname"
                      className="auth-input"
                      defaultValue={trip.nickname}
                      maxLength={40}
                      aria-label={t(lang, "profile.renameCta")}
                      required
                    />
                    <button
                      className="auth-submit touch-target wallet-inline-cta"
                      type="submit"
                    >
                      {t(lang, "profile.renameCta")}
                    </button>
                  </form>
                  <form action={deleteSavedTrip}>
                    <input type="hidden" name="trip" value={trip.id} />
                    <button className="auth-link touch-target" type="submit">
                      {t(lang, "profile.removeCta")}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="profile-settings svika-animate-fade-up svika-rise-3">
        <h2 className="svika-title profile-settings-head">
          {t(lang, "profile.settingsH")}
        </h2>

        <section className="svika-card wallet-panel" data-testid="profile-identity">
          <h3 className="svika-title">{t(lang, "profile.youH")}</h3>
          <form action={updateIdentity} className="profile-form">
            <label className="svika-meta profile-label" htmlFor="full_name">
              {t(lang, "profile.nameLabel")}
            </label>
            <input
              id="full_name"
              name="full_name"
              className="auth-input"
              defaultValue={profile?.full_name ?? ""}
              maxLength={80}
              required
            />
            <label className="svika-meta profile-label" htmlFor="phone">
              {t(lang, "profile.phoneLabel")}
            </label>
            <input
              id="phone"
              name="phone"
              className="auth-input"
              inputMode="tel"
              defaultValue={profile?.phone ?? ""}
              maxLength={30}
            />
            <button className="auth-submit touch-target" type="submit">
              {t(lang, "profile.saveCta")}
            </button>
          </form>
          {saved === "identity" && (
            <p className="wallet-ok svika-body" data-testid="identity-saved">
              {t(lang, "profile.savedNote")}
            </p>
          )}
          {(err === "name" || err === "phone" || err === "identity") && (
            <p className="auth-error svika-body">{t(lang, "profile.errGeneric")}</p>
          )}
        </section>

        <section className="svika-card wallet-panel" data-testid="profile-alerts">
          <div className="pref-row">
            <h3 className="svika-title">{t(lang, "profile.alertsH")}</h3>
            <PrefToggle
              action={setPref}
              pref="commute_alerts"
              on={prefs?.commute_alerts ?? false}
              onLabel={t(lang, "profile.on")}
              offLabel={t(lang, "profile.off")}
            />
          </div>
          <p className="svika-body">{t(lang, "profile.alertsB")}</p>
        </section>

        <section className="svika-card wallet-panel" data-testid="profile-voice">
          <h3 className="svika-title">{t(lang, "profile.voiceH")}</h3>
          <p className="svika-body">{t(lang, "profile.voiceB")}</p>
          <div className="pref-row">
            <span className="svika-body">{t(lang, "profile.voiceEn")}</span>
            <PrefToggle
              action={setPref}
              pref="voice_en"
              on={prefs?.voice_en ?? false}
              onLabel={t(lang, "profile.on")}
              offLabel={t(lang, "profile.off")}
            />
          </div>
          <div className="pref-row">
            <span className="svika-body">{t(lang, "profile.voiceSn")}</span>
            <PrefToggle
              action={setPref}
              pref="voice_sn"
              on={prefs?.voice_sn ?? false}
              onLabel={t(lang, "profile.on")}
              offLabel={t(lang, "profile.off")}
            />
          </div>
          <p className="svika-meta">{t(lang, "profile.voiceNote")}</p>
        </section>

        <section className="svika-card wallet-panel" data-testid="profile-appearance">
          <h3 className="svika-title">{t(lang, "profile.appearanceH")}</h3>
          <div className="pref-row">
            <span className="svika-body">{t(lang, "profile.languageH")}</span>
            <LanguageToggle lang={lang} />
          </div>
          <div className="pref-row">
            <span className="svika-body">{t(lang, "profile.themeH")}</span>
            <ThemeToggle
              initialTheme={theme}
              toDarkLabel={t(lang, "theme.toDark")}
              toLightLabel={t(lang, "theme.toLight")}
            />
          </div>
        </section>

        <section className="svika-card wallet-panel" data-testid="profile-emergency">
          <h3 className="svika-title">{t(lang, "profile.emergencyH")}</h3>
          <p className="svika-body">{t(lang, "profile.emergencyWhy")}</p>

          {emergency && (
            <>
              <dl className="yourdata-list" data-testid="emergency-details">
                {emergency.next_of_kin_name && (
                  <div className="yourdata-row">
                    <dt className="svika-meta">{t(lang, "profile.kinName")}</dt>
                    <dd className="svika-body">{emergency.next_of_kin_name}</dd>
                  </div>
                )}
                {emergency.next_of_kin_phone && (
                  <div className="yourdata-row">
                    <dt className="svika-meta">{t(lang, "profile.kinPhone")}</dt>
                    <dd className="svika-mono-code">{emergency.next_of_kin_phone}</dd>
                  </div>
                )}
                {emergency.medical_aid_name && (
                  <div className="yourdata-row">
                    <dt className="svika-meta">{t(lang, "profile.aidName")}</dt>
                    <dd className="svika-body">{emergency.medical_aid_name}</dd>
                  </div>
                )}
                {emergency.medical_aid_number && (
                  <div className="yourdata-row">
                    <dt className="svika-meta">{t(lang, "profile.aidNumber")}</dt>
                    <dd className="svika-mono-code">{emergency.medical_aid_number}</dd>
                  </div>
                )}
              </dl>
              <form action={removeEmergencyDetails}>
                <button
                  className="auth-link touch-target"
                  type="submit"
                  data-testid="emergency-remove"
                >
                  {t(lang, "profile.emergencyRemove")}
                </button>
              </form>
            </>
          )}

          <form action={saveEmergencyDetails} className="profile-form">
            <label className="svika-meta profile-label" htmlFor="kin_name">
              {t(lang, "profile.kinName")}
            </label>
            <input
              id="kin_name"
              name="kin_name"
              className="auth-input"
              defaultValue={emergency?.next_of_kin_name ?? ""}
              maxLength={80}
            />
            <label className="svika-meta profile-label" htmlFor="kin_phone">
              {t(lang, "profile.kinPhone")}
            </label>
            <input
              id="kin_phone"
              name="kin_phone"
              className="auth-input"
              inputMode="tel"
              defaultValue={emergency?.next_of_kin_phone ?? ""}
              maxLength={30}
            />
            <label className="svika-meta profile-label" htmlFor="aid_name">
              {t(lang, "profile.aidName")}
            </label>
            <input
              id="aid_name"
              name="aid_name"
              className="auth-input"
              defaultValue={emergency?.medical_aid_name ?? ""}
              maxLength={80}
            />
            <label className="svika-meta profile-label" htmlFor="aid_number">
              {t(lang, "profile.aidNumber")}
            </label>
            <input
              id="aid_number"
              name="aid_number"
              className="auth-input"
              defaultValue={emergency?.medical_aid_number ?? ""}
              maxLength={40}
            />
            {/* No checkbox exists in the numbered references: this native box
                tinted forest is a flagged spec gap, see the checklist notes. */}
            <label className="consent-check svika-body touch-target">
              <input
                type="checkbox"
                name="consent"
                required
                data-testid="emergency-consent"
              />
              <span>{t(lang, "profile.emergencyConsent")}</span>
            </label>
            <button
              className="auth-submit touch-target"
              type="submit"
              data-testid="emergency-save"
            >
              {t(lang, "profile.emergencySave")}
            </button>
          </form>
          {saved === "emergency" && (
            <p className="wallet-ok svika-body" data-testid="emergency-saved">
              {t(lang, "profile.emergencySaved")}
            </p>
          )}
          {saved === "removed" && (
            <p className="wallet-ok svika-body" data-testid="emergency-removed">
              {t(lang, "profile.emergencyRemoved")}
            </p>
          )}
          {errKey && <p className="auth-error svika-body">{t(lang, errKey)}</p>}
        </section>

        {/* Svika Partner (batch Partner): the opt in lives beside the other
            consents, off by default, with the full bargain one tap away */}
        <section className="svika-card wallet-panel" data-testid="profile-partner">
          <h3 className="svika-title">{t(lang, "partner.title")}</h3>
          <p className="svika-body partner-state" data-on={isPartner}>
            {t(lang, isPartner ? "partner.on" : "partner.off")}
          </p>
          <p className="svika-body">{t(lang, "partner.doorB")}</p>
          <form action={setPartnerMode}>
            <input type="hidden" name="from" value="profile" />
            <input type="hidden" name="value" value={isPartner ? "off" : "on"} />
            <button
              className={isPartner ? "auth-link touch-target" : "auth-submit touch-target"}
              type="submit"
              data-testid={isPartner ? "profile-partner-off" : "profile-partner-on"}
            >
              {t(lang, isPartner ? "partner.turnOff" : "partner.turnOn")}
            </button>
          </form>
          <Link
            className="auth-link touch-target"
            href="/app/partner"
            data-testid="profile-partner-link"
          >
            {t(lang, isPartner ? "partner.seeCta" : "partner.savedDoorCta")}
          </Link>
          {saved === "partner-on" && (
            <p className="wallet-ok svika-body" data-testid="profile-partner-saved">
              {t(lang, "partner.onNote")}
            </p>
          )}
          {saved === "partner-off" && (
            <p className="wallet-ok svika-body" data-testid="profile-partner-saved">
              {t(lang, "partner.offNote")}
            </p>
          )}
        </section>

        <section className="svika-card wallet-panel" data-testid="profile-family">
          <h3 className="svika-title">{t(lang, "family.title")}</h3>
          <p className="svika-body">{t(lang, "family.guardianB")}</p>
          <Link
            className="auth-link touch-target"
            href="/app/family"
            data-testid="profile-family-link"
          >
            {t(lang, "family.doorLabel")}
          </Link>
        </section>

        <section
          className="svika-card wallet-panel profile-signout"
          data-testid="profile-signout"
        >
          <SignOutButton label={t(lang, "app.signOut")} />
        </section>

        <footer className="home-sheet-footer profile-footer">
          <Link className="auth-link touch-target" href="/app/privacy">
            {t(lang, "privacy.yourDataLink")}
          </Link>
        </footer>
      </div>
    </main>
  );
}
