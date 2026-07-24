import { redirect } from "next/navigation";
import { hasActiveConsent, JOURNEY_CONSENT_VERSION, type ConsentRecord } from "@svika/shared";
import { getLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { RecordScreen } from "@/components/journey/RecordScreen";
import type { LocalJourneyMode } from "@/lib/journey/store";

// Record my trip (batch M1). The screen itself is a client component: GPS,
// IndexedDB and the live trace all live on the phone. This shell resolves
// the language and whether the rider already holds an accepted journey
// consent (the journey-v1 stream), so the save moment knows whether to ask.
export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const modeParam = typeof params.mode === "string" ? params.mode : "walk";
  const initialMode: LocalJourneyMode = modeParam === "kombi" ? "kombi" : "walk";
  const replay = params.gps === "replay";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: consents } = await supabase
    .from("consent_records")
    .select("action, created_at")
    .eq("user_id", user.id)
    .eq("version", JOURNEY_CONSENT_VERSION);
  const hasConsent = hasActiveConsent((consents ?? []) as ConsentRecord[]);

  return (
    <RecordScreen
      lang={lang}
      initialMode={initialMode}
      hasConsent={hasConsent}
      replay={replay}
    />
  );
}
