import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLang, t } from "@/lib/i18n";
import { CONSENT_VERSION, hasActiveConsent, type ConsentRecord } from "@svika/shared";

// The consent gate. Every surface under /app sits behind it: a user whose
// latest consent record is not an accept (or who has none) is sent to the
// consent screen before anything else renders. Withdrawal on the privacy
// page closes this gate again. Demo personas additionally carry a permanent
// on-screen chip so no demo surface can pass as a real account, and a rider
// whose trips a guardian sees carries the guardian chip on EVERY screen:
// dignity law, no silent tracking, the chip is the way to the off switch.
export default async function ConsentGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Guest mode (batch V2): a logged out visitor may look around. The
  // consent gate guards ACCOUNTS (it sits at account creation, unchanged);
  // a guest holds no data to consent over, reads only the world readable
  // network through the anon role, and every identity moment (pay, save,
  // record, name) walls on its own page with the reason spelled out.
  if (!user) return children;

  const [consentRes, profileRes, guardianRes] = await Promise.all([
    // scoped to the app consent stream: the profile's emergency details
    // stream lives in the same table and must never move this gate
    supabase
      .from("consent_records")
      .select("action, created_at")
      .eq("version", CONSENT_VERSION),
    supabase.from("profiles").select("demo_sim").eq("id", user.id).maybeSingle(),
    supabase
      .from("guardian_links")
      .select("id")
      .eq("child_id", user.id)
      .eq("status", "active")
      .limit(1),
  ]);
  if (!hasActiveConsent((consentRes.data ?? []) as ConsentRecord[])) {
    redirect("/consent");
  }

  const isDemo = Boolean(profileRes.data?.demo_sim);
  const isWatched = (guardianRes.data ?? []).length > 0;
  if (!isDemo && !isWatched) return children;

  const lang = await getLang();
  return (
    <>
      {isDemo && (
        <span className="demo-account-chip" data-testid="demo-account-chip">
          {t(lang, "demo.chip")}
        </span>
      )}
      {isWatched && (
        <Link
          className="guardian-chip"
          href="/app/family"
          data-testid="guardian-chip"
        >
          {t(lang, "family.chip")}
        </Link>
      )}
      {children}
    </>
  );
}
