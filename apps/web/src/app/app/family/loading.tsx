import { getLang, t } from "@/lib/i18n";
import { SkeletonScreen } from "@/components/Skeleton";

// M4 perceived speed: this screen's server render waits on the database, so a
// cheap phone on a slow connection would sit on a white page. The skeleton
// holds the shape the real content will take, announced to screen readers.
export default async function Loading() {
  const lang = await getLang();
  return <SkeletonScreen label={t(lang, "common.loading")} cards={2} lines={3} />;
}
