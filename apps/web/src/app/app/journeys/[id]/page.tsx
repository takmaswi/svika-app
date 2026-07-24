import { redirect } from "next/navigation";
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
  return (
    <JourneyDetail
      lang={lang}
      id={id}
      saved={typeof saved === "string" ? saved : undefined}
    />
  );
}
