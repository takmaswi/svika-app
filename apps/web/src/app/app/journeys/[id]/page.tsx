import { redirect } from "next/navigation";
import {
  hasActiveConsent,
  PARTNER_CONSENT_VERSION,
  type ConsentRecord,
} from "@svika/shared";
import { getLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { JourneyDetail } from "@/components/journey/JourneyDetail";

// A saved trip (batch M1): trace on the map plus the named summary. Client
// rendered because a trip kept on this phone lives in IndexedDB.
export default async function JourneyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const { id } = await params;
  const saved = (await searchParams).saved;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // the partner door only opens for somebody who is not one yet, so the
  // screen needs to know which they are
  const { data: partnerConsents } = await supabase
    .from("consent_records")
    .select("action, created_at")
    .eq("user_id", user.id)
    .eq("version", PARTNER_CONSENT_VERSION);
  const isPartner = hasActiveConsent((partnerConsents ?? []) as ConsentRecord[]);

  return (
    <JourneyDetail
      lang={lang}
      id={id}
      saved={typeof saved === "string" ? saved : undefined}
      isPartner={isPartner}
    />
  );
}
