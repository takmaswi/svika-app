"use client";

// Plan Step 3.4: after a first win (a plan used), one gentle card that leads
// to sign up. Never blocking, dismissable, and once dismissed it stays gone
// on this phone. No urgency, no forced sign up (ruling 15).
import { useEffect, useState } from "react";
import Link from "next/link";

export const WIN_DISMISSED_KEY = "svika_win_dismissed";

export function FirstWinCard({
  title,
  body,
  cta,
  dismiss,
  href,
}: {
  title: string;
  body: string;
  cta: string;
  dismiss: string;
  href: string;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(localStorage.getItem(WIN_DISMISSED_KEY) !== "1");
  }, []);
  if (!show) return null;
  return (
    <aside className="v2-card v2-win v2-rise" data-testid="first-win">
      <span className="v2-h2">{title}</span>
      <span className="v2-meta">{body}</span>
      <span className="v2-win-actions">
        <Link className="v2-textlink" href={href} data-testid="first-win-cta">
          {cta}
        </Link>
        <button
          type="button"
          className="v2-textlink v2-win-dismiss"
          data-testid="first-win-dismiss"
          onClick={() => {
            localStorage.setItem(WIN_DISMISSED_KEY, "1");
            setShow(false);
          }}
        >
          {dismiss}
        </button>
      </span>
    </aside>
  );
}
