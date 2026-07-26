import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { deleteMyData } from "@/lib/actions";
import { DeleteMyDataButton } from "@/components/DeleteMyDataButton";
import { BackIcon } from "@/components/icons";

// "What Svika knows about you": the rider's own profile fields and history
// counts, read under RLS, plus the delete action. Deletion anonymises
// because ticket and money history is append only; the copy says so plainly
// instead of pretending erasure.
export default async function YourDataPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    profileRes,
    ticketsRes,
    postingsRes,
    tripsRes,
    consentsRes,
    journeysRes,
    partnerRes,
  ] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, preferred_language")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("tickets").select("id", { count: "exact", head: true }),
      supabase.from("ledger_postings").select("id", { count: "exact", head: true }),
      supabase.from("saved_trips").select("id", { count: "exact", head: true }),
      supabase.from("consent_records").select("id", { count: "exact", head: true }),
      // recorded trips and, separately, the ones given to the network as a
      // partner: a rider should be able to see the difference at a glance
      supabase
        .from("rider_journeys")
        .select("id", { count: "exact", head: true })
        .eq("status", "complete"),
      supabase
        .from("rider_journeys")
        .select("id", { count: "exact", head: true })
        .eq("status", "complete")
        .not("partner_consent_version", "is", null),
    ]);

  const profile = profileRes.data;
  const none = t(lang, "yourdata.none");
  const counts = [
    ["yourdata.tickets", ticketsRes.count ?? 0],
    ["yourdata.movements", postingsRes.count ?? 0],
    ["yourdata.savedTrips", tripsRes.count ?? 0],
    ["yourdata.journeys", journeysRes.count ?? 0],
    ["yourdata.partnerTrips", partnerRes.count ?? 0],
    ["yourdata.consents", consentsRes.count ?? 0],
  ] as const;

  return (
    <main className="shell">
      <header className="screen-head">
        <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "yourdata.title")}</h1>
      </header>

      <section className="svika-card wallet-panel svika-animate-fade-up" data-testid="your-data">

        <h2 className="svika-meta privacy-heading">{t(lang, "yourdata.profileH")}</h2>
        <dl className="yourdata-list">
          <dt className="svika-meta">{t(lang, "yourdata.name")}</dt>
          <dd className="svika-body">{profile?.full_name || none}</dd>
          <dt className="svika-meta">{t(lang, "app.phoneLabel")}</dt>
          <dd className="svika-body">{profile?.phone || none}</dd>
          <dt className="svika-meta">{t(lang, "yourdata.language")}</dt>
          <dd className="svika-body">
            {t(lang, profile?.preferred_language === "sn" ? "lang.shona" : "lang.english")}
          </dd>
        </dl>

        <h2 className="svika-meta privacy-heading">{t(lang, "yourdata.countsH")}</h2>
        <dl className="yourdata-list">
          {counts.map(([key, count]) => (
            <div key={key} className="yourdata-row">
              <dt className="svika-meta">{t(lang, key)}</dt>
              <dd className="svika-mono-code">{count}</dd>
            </div>
          ))}
        </dl>

        <Link className="auth-link" href="/privacy">
          {t(lang, "consent.noticeLink")}
        </Link>
      </section>

      <section className="svika-card wallet-panel">
        <h2 className="svika-headline">{t(lang, "yourdata.deleteH")}</h2>
        <p className="svika-body">{t(lang, "yourdata.deleteB")}</p>
        {params.err === "1" && (
          <p className="auth-error svika-body">{t(lang, "yourdata.err")}</p>
        )}
        <DeleteMyDataButton
          action={deleteMyData}
          ctaLabel={t(lang, "yourdata.deleteCta")}
          confirmLabel={t(lang, "yourdata.deleteConfirm")}
          cancelLabel={t(lang, "yourdata.deleteCancel")}
        />
      </section>
    </main>
  );
}
