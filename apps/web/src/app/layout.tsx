import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "@svika/ui/styles.css";
import "./globals.css";
// launch-v2 system, scoped to :root[data-ui="v2"]: inert until ui_v2 is on,
// and last so it wins every tie with the pre launch styles
import "@svika/ui/launch-v2.css";
import { getLang } from "@/lib/i18n";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { flagOn } from "@/lib/flags-server";
import { UiV2Provider } from "@/lib/ui-v2";

export const metadata: Metadata = {
  title: "Svika",
  description: "Digital ticketing and trip intelligence for Harare's kombis.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await getLang();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  // launch Step 1: the launch-v2 visual system, behind its own flag
  const uiV2 = await flagOn("ui_v2");
  return (
    <html
      lang={lang}
      {...(theme ? { "data-theme": theme } : {})}
      {...(uiV2 ? { "data-ui": "v2" } : {})}
    >
      <body className="svika-body-base">
        <UiV2Provider on={uiV2}>{children}</UiV2Provider>
      </body>
    </html>
  );
}
