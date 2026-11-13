// The short marigold hero of the approved Sign-Up screen (launch-v2):
// back button, headline and one line under it, then the form below.
import type { ReactNode } from "react";
import { BackButton } from "@/components/v2/parts";

export type ShellText = {
  title: string;
  body: string;
  backHref: string;
  backLabel: string;
};

export function AccountShell({
  title,
  body,
  backHref,
  backLabel,
  children,
}: ShellText & { children: ReactNode }) {
  return (
    <main className="v2-screen v2-account">
      <div className="v2-hero v2-hero-short">
        <BackButton href={backHref} label={backLabel} />
        <div className="v2-rise v2-account-head">
          <h1 className="v2-hero-h1 v2-hero-h1-sm">{title}</h1>
          <span className="v2-hero-body">{body}</span>
        </div>
      </div>
      {children}
    </main>
  );
}
