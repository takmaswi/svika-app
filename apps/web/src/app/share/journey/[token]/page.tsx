import { getLang, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import { GuideViewer } from "@/components/journey/GuideViewer";

interface GuideDoc {
  name: string | null;
  mode: "kombi" | "walk" | "mixed";
  distance_m: number | null;
  share_expires_at: string;
  points: [number, number, number][];
}

// The guide link viewer (batch M2): no account, no login, one RPC. A live
// token answers with the trace and nothing about who recorded it; revoked,
// expired and unknown tokens share one quiet dead state (the 0026 grammar).
export default async function JourneyGuidePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const lang = await getLang();
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("journey_share_view", { p_token: token });
  const doc = (data ?? null) as GuideDoc | null;

  if (!doc || !Array.isArray(doc.points) || doc.points.length < 2) {
    return (
      <main className="shell">
        <header className="shell-top">
          <img className="wordmark" src="/wordmark.svg" alt="Svika" height={24} />
          <LanguageToggle lang={lang} />
        </header>
        <section
          className="svika-card wallet-panel svika-animate-fade-up"
          data-testid="guide-dead"
        >
          <h1 className="svika-headline">{t(lang, "share.deadH")}</h1>
          <p className="svika-body">{t(lang, "share.deadB")}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="shell-top">
        <img className="wordmark" src="/wordmark.svg" alt="Svika" height={24} />
        <LanguageToggle lang={lang} />
      </header>
      <h1 className="svika-headline guide-title">{t(lang, "guide.title")}</h1>
      <GuideViewer
        lang={lang}
        name={doc.name}
        mode={doc.mode}
        distanceM={doc.distance_m ?? 0}
        points={doc.points}
      />
    </main>
  );
}
