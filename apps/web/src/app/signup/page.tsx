import { notFound } from "next/navigation";
import { getLang, t } from "@/lib/i18n";
import { flagOn } from "@/lib/flags-server";
import { SignUpForm } from "@/components/accounts/SignUpForm";

// Launch Step 2: username and password sign up, behind the accounts flag.
export default async function SignUpPage() {
  if (!(await flagOn("accounts"))) notFound();
  const lang = await getLang();
  return (
    <SignUpForm
      lang={lang}
      shell={{
        title: t(lang, "acct.signupTitle"),
        body: t(lang, "acct.signupBody"),
        backHref: "/app",
        backLabel: t(lang, "common.back"),
      }}
    />
  );
}
