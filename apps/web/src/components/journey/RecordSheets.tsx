"use client";

// The two things a partner does while a recording runs: say which kombi
// they just boarded, and mark a spot that matters. Both are bottom sheets
// that rise over the live map, so the rider never loses sight of where
// they are, and neither dismisses on a stray tap: a half typed name on a
// bumpy kombi is real data, not a modal to swat away (the field logger
// lost names exactly this way).
//
// One primary action each (§5 CTA anatomy), and each primary stays
// disabled until the sheet has the one answer it cannot guess: a direction
// for a board, a kind for a mark. The field logger's board sheet had a
// dead validation branch and its mark sheet preselected a kind, so a
// mistap produced a confidently wrong row.

import { useState } from "react";
import type { AppLanguage } from "@svika/shared";
import { t, type DictKey } from "@/lib/dict";
import { parseFareCents, type BoardDetails, type LegDirection } from "@/lib/journey/legs";
import type { LocalMark } from "@/lib/journey/store";

interface SheetProps {
  lang: AppLanguage;
  onCancel: () => void;
}

export function BoardSheet({
  lang,
  onCancel,
  onBoard,
}: SheetProps & { onBoard: (details: BoardDetails) => void }) {
  const [routeName, setRouteName] = useState("");
  const [direction, setDirection] = useState<LegDirection | null>(null);
  const [fare, setFare] = useState("");

  return (
    <section
      className="record-sheet svika-card svika-animate-fade-up"
      data-testid="board-sheet"
    >
      <h2 className="svika-title">{t(lang, "journey.boardH")}</h2>

      <label className="svika-meta places-name-label" htmlFor="board-route">
        {t(lang, "journey.routeLabel")}
      </label>
      <input
        id="board-route"
        className="places-name-input"
        value={routeName}
        onChange={(e) => setRouteName(e.target.value)}
        placeholder={t(lang, "journey.routePh")}
        maxLength={80}
        autoComplete="off"
        data-testid="board-route"
      />

      <span className="svika-meta places-kind-label">
        {t(lang, "journey.dirLabel")}
      </span>
      <div className="places-kind-row" role="radiogroup" aria-label={t(lang, "journey.dirLabel")}>
        {(["outbound", "inbound"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={direction === d}
            className="place-kind-chip touch-target"
            data-selected={direction === d}
            onClick={() => setDirection(d)}
            data-testid={`board-dir-${d}`}
          >
            {t(lang, d === "outbound" ? "journey.dirOut" : "journey.dirIn")}
          </button>
        ))}
      </div>
      <p className="svika-meta record-sheet-hint">{t(lang, "journey.dirHint")}</p>

      <label className="svika-meta places-name-label" htmlFor="board-fare">
        {t(lang, "journey.fareLabel")}
      </label>
      <input
        id="board-fare"
        className="places-name-input svika-mono-code"
        value={fare}
        onChange={(e) => setFare(e.target.value)}
        placeholder={t(lang, "journey.farePh")}
        inputMode="decimal"
        maxLength={8}
        autoComplete="off"
        data-testid="board-fare"
      />
      <p className="svika-meta record-sheet-hint">{t(lang, "journey.fareNote")}</p>

      {direction === null && (
        <p className="svika-meta record-sheet-hint" data-testid="board-dir-needed">
          {t(lang, "journey.dirNeeded")}
        </p>
      )}
      <button
        className="auth-submit touch-target"
        type="button"
        disabled={direction === null}
        onClick={() =>
          direction &&
          onBoard({ routeName, direction, fareCents: parseFareCents(fare) })
        }
        data-testid="board-confirm"
      >
        {t(lang, "journey.boardCta")}
      </button>
      <button
        className="auth-link touch-target"
        type="button"
        onClick={onCancel}
        data-testid="board-cancel"
      >
        {t(lang, "journey.cancel")}
      </button>
    </section>
  );
}

const MARK_KINDS: readonly LocalMark["kind"][] = [
  "dropoff",
  "rank",
  "terminal",
  "landmark",
];

/** A fix older than this is too stale to stand for where the rider is. */
export const MARK_FIX_MAX_AGE_MS = 90_000;

export function MarkSheet({
  lang,
  onCancel,
  onMark,
  fixAgeMs,
}: SheetProps & {
  onMark: (kind: LocalMark["kind"], name: string) => void;
  /** How old the fix this mark would use is, or null when there is none. */
  fixAgeMs: number | null;
}) {
  const [kind, setKind] = useState<LocalMark["kind"] | null>(null);
  const [name, setName] = useState("");
  const stale = fixAgeMs === null || fixAgeMs > MARK_FIX_MAX_AGE_MS;

  return (
    <section
      className="record-sheet svika-card svika-animate-fade-up"
      data-testid="mark-sheet"
    >
      <h2 className="svika-title">{t(lang, "journey.markH")}</h2>

      <span className="svika-meta places-kind-label">
        {t(lang, "journey.markKindLabel")}
      </span>
      <div
        className="places-kind-row"
        role="radiogroup"
        aria-label={t(lang, "journey.markKindLabel")}
      >
        {MARK_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className="place-kind-chip touch-target"
            data-selected={kind === k}
            onClick={() => setKind(k)}
            data-testid={`mark-kind-${k}`}
          >
            {t(lang, `journey.markKind.${k}` as DictKey)}
          </button>
        ))}
      </div>

      <label className="svika-meta places-name-label" htmlFor="mark-name">
        {t(lang, "journey.markNameLabel")}
      </label>
      <input
        id="mark-name"
        className="places-name-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t(lang, "journey.markNamePh")}
        maxLength={60}
        autoComplete="off"
        data-testid="mark-name"
      />
      <p className="svika-meta record-sheet-hint">
        {t(lang, "journey.markNameNote")}
      </p>

      {/* the mark lands on the last fix, so say how old that fix is rather
          than letting the rider believe it is where they stand now */}
      <p className="svika-meta record-sheet-hint" data-testid="mark-fix-age">
        {fixAgeMs === null
          ? t(lang, "journey.markWaiting")
          : stale
            ? t(lang, "journey.markFixOld")
            : `${t(lang, "journey.markFixAge")} ${Math.round(fixAgeMs / 1000)}s`}
      </p>

      <button
        className="auth-submit touch-target"
        type="button"
        disabled={kind === null || stale}
        onClick={() => kind && onMark(kind, name)}
        data-testid="mark-drop"
      >
        {t(lang, "journey.markDrop")}
      </button>
      <button
        className="auth-link touch-target"
        type="button"
        onClick={onCancel}
        data-testid="mark-cancel"
      >
        {t(lang, "journey.cancel")}
      </button>
    </section>
  );
}
