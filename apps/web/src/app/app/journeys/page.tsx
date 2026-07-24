import { redirect } from "next/navigation";
import { getLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { JourneysList } from "@/components/journey/JourneysList";

// My trips (batch M1): the list merges the rider's server rows (RLS) with
// journeys kept on this phone, so it renders client side.
export default async function JourneysPage() {
  const lang = await getLang();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <JourneysList lang={lang} />;
}
