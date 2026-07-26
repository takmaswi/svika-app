// The live fare board (batch V4): what riders on this route actually paid
// today. History, not editorial. It reports and never judges: no "good deal",
// no comparison with another route, no guess at the next hour.
//
// A server component: the numbers come from one group by (migration 0045) and
// one pure summariser (@svika/shared fare-board), so there is nothing here for
// a client bundle to carry.
import { formatUsd, type FareBoard as Board } from "@svika/shared";

export interface FareBoardStrings {
  /** "What riders paid today" */
  title: string;
  /** "Most paid {fare}" */
  typical: string;
  /** "from {low} to {high}" */
  range: string;
  /** "{count} fares so far today" */
  counted: string;
  /** "busiest around {hour}" */
  busiest: string;
  /** the standing not-AI line */
  basis: string;
}

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "am" : "pm";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${suffix}`;
}

export function FareBoard({
  board,
  strings,
}: {
  board: Board;
  strings: FareBoardStrings;
}) {
  const peak = board.hours.reduce((max, h) => Math.max(max, h.tickets), 1);
  return (
    <section className="fare-board" data-testid="fare-board">
      <p className="peek-label">{strings.title}</p>
      <p className="svika-body fare-board-line" data-testid="fare-board-line">
        <span className="svika-mono-code">
          {strings.typical.replace("{fare}", formatUsd(board.typicalCents))}
        </span>
        {board.varied && (
          <span className="fare-board-range">
            {" "}
            {strings.range
              .replace("{low}", formatUsd(board.lowCents))
              .replace("{high}", formatUsd(board.highCents))}
          </span>
        )}
      </p>

      {/* the day as it happened: one bar per hour that carried a fare. Peak
          jumps are visible because they are in the history, not because
          anything here calls them a peak. */}
      <ol className="fare-board-hours" aria-hidden>
        {board.hours.map((h) => (
          <li key={h.hour} className="fare-board-hour">
            <span
              className="fare-board-bar"
              style={{ height: `${Math.max(12, Math.round((h.tickets / peak) * 100))}%` }}
            />
            <span className="fare-board-hour-label">{hourLabel(h.hour)}</span>
          </li>
        ))}
      </ol>

      <p className="svika-meta fare-board-counted" data-testid="fare-board-counted">
        {strings.counted.replace("{count}", String(board.tickets))}
        {board.busiestHour !== null &&
          ` · ${strings.busiest.replace("{hour}", hourLabel(board.busiestHour))}`}
      </p>
      <p className="svika-meta fare-board-basis">{strings.basis}</p>
    </section>
  );
}
