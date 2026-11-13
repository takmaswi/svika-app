import { notFound } from "next/navigation";
import { getLang, t } from "@/lib/i18n";
import { flagOn } from "@/lib/flags-server";
import { AccountShell } from "@/components/accounts/AccountShell";
import { RecoverForm } from "@/components/accounts/RecoverForm";

// Launch Step 2.3: username plus recovery code resets the password.
export default async function RecoverPage() {
  if (!(await flagOn("accounts"))) notFound();
  const lang = await getLang();
  return (
    <AccountShell
      title={t(lang, "acct.recoverTitle")}
      body={t(lang, "acct.recoverBody")}
      backHref="/login"
      backLabel={t(lang, "common.back")}
    >
      <RecoverForm lang={lang} />
    </AccountShell>
  );
}
