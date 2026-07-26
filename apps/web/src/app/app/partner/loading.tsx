import { getLang, t } from "@/lib/i18n";
import { SkeletonScreen } from "@/components/Skeleton";

// M4 perceived speed: this screen counts the rider's own rows before it can
// render, so the skeleton holds the shape rather than showing a white page.
export default async function Loading() {
  const lang = await getLang();
  return <SkeletonScreen label={t(lang, "common.loading")} cards={3} lines={3} />;
}
