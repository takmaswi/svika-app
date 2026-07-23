# K1 kombi card and board — gate evidence

Captured at 360x740 (reference device) against the local dev server with the
spine up, rider signed in as the seeded demo rider. Eight screenshots: the
marker card and the board, day and night, English and Shona.

- `card-day-en.png`, `card-day-sn.png`, `card-night-en.png`, `card-night-sn.png`
  — a tapped kombi's card over the live map: plate and trust chip (the
  unverified default, the truthful state of the fleet today), direction, the
  live wait for the rider's stop with its basis label, declared seats, the
  trust record with the never accuse footnote, the standing provenance line,
  one CTA to the board.
- `board-day-en.png`, `board-day-sn.png`, `board-night-en.png`,
  `board-night-sn.png` — /app/kombis, all four kombis as the same facts
  block, demo movement chip standing.

Capture script: a throwaway Playwright run mirroring e2e/kombi-board.spec.ts
(login via /e2e/login, tap the first marker, walk to the board).
