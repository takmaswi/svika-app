// Launch v2 building blocks (Svika Mbare Sun/launch-v2). Server safe: no
// state here. Styles live in packages/ui/launch-v2.css.
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowV2, BackV2, MeV2, PinV2, RanksTabV2 } from "./icons";

/** The drawn kombi in the hero band. Fills switch with the theme in CSS. */
export function HeroKombi({ label }: { label: string }) {
  return (
    <div className="v2-hero-kombi v2-drive">
      <svg className="v2-lines v2-kombi-lines" width="40" height="30" viewBox="0 0 40 30" aria-hidden>
        <path d="M4 6h26M12 15h24M2 24h22" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
      <svg className="v2-beam v2-kombi-beam" width="120" height="70" viewBox="0 0 120 70" aria-hidden>
        <path d="M0 34 L120 4 L120 64 L0 40 Z" opacity=".14" />
        <path d="M0 35 L80 18 L80 52 L0 39 Z" opacity=".18" />
      </svg>
      <svg className="v2-bob v2-kombi" width="172" height="92" viewBox="0 0 172 92" role="img" aria-label={label}>
        <ellipse className="v2k-shadow" cx="88" cy="86" rx="76" ry="4" />
        <path className="v2k-body" d="M8 72 V30 Q8 14 24 14 H118 Q128 14 136 21 L160 44 Q166 49 166 57 V72 Z" />
        <rect className="v2k-win" x="20" y="24" width="24" height="18" rx="5" />
        <rect className="v2k-win" x="50" y="24" width="24" height="18" rx="5" />
        <rect className="v2k-win" x="80" y="24" width="24" height="18" rx="5" />
        <path className="v2k-win" d="M112 24 H126 Q130 24 133 27 L148 42 H112 Z" />
        <rect x="8" y="52" width="158" height="5" fill="#1F4D2E" />
        <rect x="158" y="60" width="8" height="5" rx="2" fill="#FFFFFF" />
        <circle className="v2k-wheel" cx="40" cy="72" r="13" strokeWidth="4" />
        <circle cx="40" cy="72" r="4.5" fill="#FFFFFF" />
        <circle className="v2k-wheel" cx="134" cy="72" r="13" strokeWidth="4" />
        <circle cx="134" cy="72" r="4.5" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

/** The exported wordmark in its white pill, never rebuilt or recoloured. */
export function BrandPill({ href = "/app" }: { href?: string }) {
  return (
    <Link className="v2-brand" href={href} aria-label="Svika">
      <img src="/wordmark.svg" alt="Svika" height={22} />
    </Link>
  );
}

/** The one primary action per screen: 58px pill, label left, 40px chip right. */
export function CtaPill({
  children,
  href,
  type = "submit",
  testId,
  disabled,
  name,
  value,
}: {
  children: ReactNode;
  href?: string;
  type?: "submit" | "button";
  testId?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const inner = (
    <>
      <span>{children}</span>
      <span className="v2-cta-chip" aria-hidden>
        <ArrowV2 />
      </span>
    </>
  );
  if (href) {
    return (
      <Link className="v2-cta" href={href} data-testid={testId}>
        {inner}
      </Link>
    );
  }
  return (
    <button className="v2-cta" type={type} data-testid={testId} disabled={disabled} name={name} value={value}>
      {inner}
    </button>
  );
}

export function BackButton({ href, label, floating }: { href: string; label: string; floating?: boolean }) {
  return (
    <Link href={href} aria-label={label} className={floating ? "v2-float-back" : "v2-round"}>
      <BackV2 />
    </Link>
  );
}

export type NavTab = "plan" | "ranks" | "me";

/** Plan, Ranks, Me (plan Step 3.5): the dark floating bar, marigold active pill. */
export function BottomNav({
  active,
  labels,
  meHref,
  label,
}: {
  active: NavTab | null;
  labels: Record<NavTab, string>;
  meHref: string;
  label: string;
}) {
  const item = (tab: NavTab, href: string, icon: ReactNode) => (
    <Link
      className="v2-nav-item"
      href={href}
      aria-current={active === tab ? "page" : undefined}
      data-testid={`nav-${tab}`}
    >
      {icon}
      {labels[tab]}
    </Link>
  );
  return (
    <nav className="v2-nav" aria-label={label}>
      {item("plan", "/app", <PinV2 />)}
      {item("ranks", "/app/ranks", <RanksTabV2 />)}
      {item("me", meHref, <MeV2 />)}
    </nav>
  );
}

/**
 * The live kombi map slot (plan Steps 3.1 and 7.5). Today it says coming
 * soon; later its body swaps to a live preview with "Open map" without any
 * relayout, because the frame (110px, tile radius) never changes.
 */
export function MapSlot({ badge, title, sub }: { badge: string; title: string; sub?: string }) {
  return (
    <div className="v2-soon v2-span2" data-testid="map-slot" data-state="soon">
      <svg width="100%" height="100%" viewBox="0 0 328 110" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <path className="v2s-main" d="M-10 78 C 60 58, 120 94, 190 56 S 300 18, 340 32" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path className="v2s-minor" d="M70 -10 L 110 130" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path className="v2s-minor" d="M240 -10 L 210 130" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path className="v2s-minor" d="M-10 28 L 340 90" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M-10 78 C 60 58, 120 94, 190 56 S 300 18, 340 32" stroke="#FFFFFF" strokeOpacity=".7" strokeWidth="3" strokeDasharray="1 9" fill="none" strokeLinecap="round" />
      </svg>
      <span className="v2-soon-kombi v2-bob" aria-hidden />
      <span className="v2-soon-copy">
        <span className="v2-badge">{badge}</span>
        <span className="v2-soon-title">{title}</span>
        {sub && <span className="v2-soon-sub">{sub}</span>}
      </span>
    </div>
  );
}
