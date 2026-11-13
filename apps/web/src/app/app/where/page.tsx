import { redirect } from "next/navigation";
import { getLang, t } from "@/lib/i18n";
import { flagOn } from "@/lib/flags-server";
import { PlannerScreen } from "@/components/door/PlannerScreen";

// Launch Step 3: the approved Planner screen. From defaults to My location
// (asked for in context, only when the rider picks where to go); To suggests
// from two letters. Behind the front_door flag.
export default async function WherePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await flagOn("front_door"))) redirect("/app");
  const lang = await getLang();
  const params = await searchParams;
  const initialTo = typeof params.q === "string" ? params.q.slice(0, 60) : "";
  const ai = await flagOn("ai_router");
  return (
    <PlannerScreen
      initialTo={initialTo}
      missed={params.miss === "1"}
      strings={{
        title: t(lang, "planner.title"),
        back: t(lang, "common.back"),
        from: t(lang, "planner.from"),
        to: t(lang, "planner.to"),
        myLocation: t(lang, "planner.myLocation"),
        swap: t(lang, "planner.swap"),
        places: t(lang, "planner.places"),
        recent: t(lang, "planner.recent"),
        noMatch: t(lang, "planner.noMatch"),
        locating: t(lang, "planner.locating"),
        locationOff: t(lang, "planner.locationOff"),
        locationWhy: t(lang, "planner.locationWhy"),
        aiHint: ai ? t(lang, "planner.aiHint") : "",
        aiExample: ai ? t(lang, "planner.aiExample") : "",
        kinds: {
          stop: t(lang, "planner.kindStop"),
          suburb: t(lang, "geo.kind.suburb"),
          place: t(lang, "geo.kind.place"),
          poi: t(lang, "geo.kind.poi"),
          road: t(lang, "geo.kind.road"),
        },
      }}
    />
  );
}
