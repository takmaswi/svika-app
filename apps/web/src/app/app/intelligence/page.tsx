import Link from "next/link";
import { redirect } from "next/navigation";
import { getLang, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { BackIcon } from "@/components/icons";
import metrics from "../../../../../../services/spine/metrics/metrics.json";

// How Svika knows your arrival: the honest ladder behind every rendered
// estimate. The table is the committed evaluation itself (imported from
// services/spine/metrics/metrics.json, the same file the serving code
// reads), never retyped numbers. Real data, no Simulation stamp.
export default async function IntelligencePage() {
  const lang = await getLang();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const generatedDay = metrics.generatedAt.slice(0, 10);
  const verdictLine = t(
    lang,
    metrics.verdict === "promoted" ? "intel.verdictPromoted" : "intel.verdictHeld",
  ).replace("{min}", String(metrics.minJourneysForPromotion));

  return (
    <main className="shell" data-testid="intelligence-eta">
      <header className="screen-head">
        <Link href="/app" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <h1 className="svika-headline">{t(lang, "intel.title")}</h1>
      </header>

      <p className="svika-body intel-intro svika-animate-fade-up">
        {t(lang, "intel.intro")}
      </p>

      <section className="svika-card wallet-panel svika-animate-fade-up svika-rise-2">
        <h2 className="svika-title">{t(lang, "intel.rung1H")}</h2>
        <p className="svika-body">
          {t(lang, "intel.rung1B").replace("{count}", String(metrics.journeys))}
        </p>
      </section>

      <section className="svika-card wallet-panel svika-animate-fade-up svika-rise-3">
        <h2 className="svika-title">{t(lang, "intel.rung2H")}</h2>
        <p className="svika-body">{t(lang, "intel.rung2B")}</p>
      </section>

      <section className="svika-card wallet-panel svika-animate-fade-up svika-rise-4">
        <h2 className="svika-title">{t(lang, "intel.rung3H")}</h2>
        <p className="svika-body">
          {t(lang, "intel.rung3B").replace(
            "{min}",
            String(metrics.minJourneysForPromotion),
          )}
        </p>
      </section>

      <section
        className="svika-card wallet-panel svika-animate-fade-up svika-rise-5"
        data-testid="intelligence-metrics"
      >
        <div className="watchdog-head">
          <h2 className="svika-title">{t(lang, "intel.tableH")}</h2>
          <span className="svika-meta watchdog-label">{generatedDay}</span>
        </div>
        <dl className="yourdata-list">
          <div className="yourdata-row">
            <dt className="svika-meta">{t(lang, "intel.rowJourneys")}</dt>
            <dd className="svika-mono-code">{metrics.journeys}</dd>
          </div>
          <div className="yourdata-row">
            <dt className="svika-meta">{t(lang, "intel.rowSegments")}</dt>
            <dd className="svika-mono-code">{metrics.segments}</dd>
          </div>
          <div className="yourdata-row">
            <dt className="svika-meta">{t(lang, "intel.rowBaseline")}</dt>
            <dd className="svika-mono-code">{metrics.baseline.maeSeconds} s</dd>
          </div>
          <div className="yourdata-row">
            <dt className="svika-meta">{t(lang, "intel.rowModel")}</dt>
            <dd className="svika-mono-code">{metrics.model.maeSeconds} s</dd>
          </div>
          <div className="yourdata-row">
            <dt className="svika-meta">{t(lang, "intel.rowServed")}</dt>
            <dd className="svika-mono-code">{metrics.served}</dd>
          </div>
        </dl>
        <p className="svika-body intel-verdict" data-testid="intelligence-verdict">
          {verdictLine}
        </p>
        <p className="svika-meta empty-note">{t(lang, "intel.note")}</p>
      </section>
    </main>
  );
}
