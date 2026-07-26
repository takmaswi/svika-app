// M4 perceived speed: the shell a data screen wears while its server render
// is still fetching.
//
// DESIGN.md has no loading state (spec gap 15, flagged in
// docs/DESIGN-DEVIATIONS.md), so this is built by the extract only rule from
// what the spec DOES have: the section 8 card, the section 12 rise entrance,
// and a quiet park toned bar in place of each line of copy. No spinner, no
// new colour, no new shape. Under reduced motion the shimmer stops and the
// bars simply sit there, which is still an honest "this is coming".
//
// The rule for using it: a skeleton stands in for content whose SHAPE is
// known, so the screen does not jump when the real thing lands. Screens whose
// shape depends on what comes back get one card, not three.

export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <span className="skeleton-line" style={{ width }} aria-hidden />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="svika-card skeleton-card" aria-hidden>
      <SkeletonLine width="52%" />
      {Array.from({ length: Math.max(0, lines - 1) }, (_, i) => (
        <SkeletonLine key={i} width={i % 2 === 0 ? "88%" : "70%"} />
      ))}
    </div>
  );
}

/**
 * A whole screen's worth: the heading bar plus a few cards. `label` is read
 * by screen readers, because a visual skeleton says nothing to a rider who
 * cannot see it.
 */
export function SkeletonScreen({
  label,
  cards = 3,
  lines = 3,
}: {
  label: string;
  cards?: number;
  lines?: number;
}) {
  return (
    <main className="shell skeleton-screen" data-testid="screen-skeleton">
      <p className="skeleton-status" role="status">
        {label}
      </p>
      <SkeletonLine width="46%" />
      {Array.from({ length: cards }, (_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </main>
  );
}
