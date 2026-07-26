import { getLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { PlacesScreen } from "@/components/places/PlacesScreen";

// Name the city (batch M3). Guests read the community layer like any other
// public network data (V2 law); the identity wall stands exactly at naming,
// because a name must belong to someone before it can belong to everyone.
export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const at = typeof params.at === "string" ? params.at : undefined;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <PlacesScreen lang={lang} isGuest={!user} at={at} />;
}
