"use client";

// The idle bottom sheet over the live map. Two resting states: peeking
// (map is the hero, search is at hand) and open (trips, wallet, tickets).
// The grabber and the title row both toggle it. On short viewports the peek
// folds to a compact bar (search + route/arrival/fare) and the title drops
// out so the live map stays the hero (see .home-sheet-titletoggle and the
// max-height rule in globals.css). Motion is the brand's bottom-sheet spring
// and collapses to nothing under reduced motion.
import { useEffect, useState, type ReactNode } from "react";

interface HomeSheetProps {
  openLabel: string;
  closeLabel: string;
  /**
   * Optional sheet title. When set it renders as a second toggle beside the
   * grabber and folds out of the compact peek. Sheets that carry their title
   * inside structured peek content (plan, share) leave this unset.
   */
  title?: string;
  /** One line under the title; hidden with the title in the compact peek. */
  hint?: string;
  /** Open on arrival, e.g. right after a booking so the code is in view. */
  defaultOpen?: boolean;
  /** Extra class on the sheet, e.g. a per-screen peek height. */
  className?: string;
  /** Always visible: search and the peek stats live here. */
  peek: ReactNode;
  /** Revealed when the sheet opens. */
  children: ReactNode;
}

export function HomeSheet({
  openLabel,
  closeLabel,
  title,
  hint,
  defaultOpen = false,
  className,
  peek,
  children,
}: HomeSheetProps) {
  const [open, setOpen] = useState(defaultOpen);
  // Client side navigation keeps this component mounted (story steps move
  // between ?sheet=open and closed paths): a step that asks for the open
  // sheet must win over the previous step's resting state.
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  // Stamped once React is interactive. The e2e suite waits on it before
  // driving forms: a submit that races hydration falls back to a native
  // POST, and Next 15.1's no-JS action replay 500s (pre-existing upstream
  // bug, reproduced on every form in the app; logged for Mhofu).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const toggle = () => setOpen((v) => !v);
  const toggleLabel = open ? closeLabel : openLabel;

  return (
    <section
      className={`home-sheet svika-glass-strong${open ? " home-sheet-open" : ""}${className ? ` ${className}` : ""}`}
      data-testid="home-sheet"
      data-hydrated={hydrated}
    >
      <button
        type="button"
        className="home-sheet-grabber touch-target"
        aria-expanded={open}
        aria-label={toggleLabel}
        onClick={toggle}
      >
        <span className="svika-sheet-handle" aria-hidden />
      </button>
      <div className="home-sheet-body">
        {title ? (
          <button
            type="button"
            className="home-sheet-titletoggle touch-target"
            aria-expanded={open}
            // named by its visible title and hint (WCAG 2.5.3 label in name);
            // aria-expanded carries the open or closed state
            onClick={toggle}
          >
            <h1 className="svika-title home-sheet-title">{title}</h1>
            {hint ? <p className="svika-meta home-sheet-hint">{hint}</p> : null}
          </button>
        ) : null}
        {peek}
        <div className="home-sheet-more" inert={!open}>
          {children}
        </div>
      </div>
    </section>
  );
}
