# V1 gate report. Answer first home

Date: 2026-07-23. Batch V1 of docs/PRODUCTION-PUSH-PLAN.md, executed on the product branch.

## What shipped

The home peek stops being a search box for a known commuter and becomes an answer. The chooser is pure rules over the commute pattern engine that already exists (Spine 2, `apps/web/src/lib/commute/patterns.ts`); no new intelligence was added.

1. **The chooser** (`apps/web/src/lib/commute/home-peek.ts`): inside the usual window the peek answers with the usual trip (activePattern, unchanged). Once the window has passed today, it answers with the ride back, the pair reversed; the latest passed window wins, busiest on a tie, so after both legs of a commute the answer is the next ride in. A demo persona whose stage clock matches nothing falls back to the busiest mined trip, the same waiver the commute alert already uses. Everyone else keeps the search peek.
2. **The peek** (`apps/web/src/app/app/page.tsx`): moment label, the trip pair, the section 9 trio intact (route, arrival with its provenance label, fare), wallet honesty on the fare cell ("Your wallet covers this" or "Wallet short, this books as cash"), and one section 5 CTA that books through the normal ledger path (`bookTrip`, wallet when covered, cash reservation otherwise) and lands on the held board code. Search stays one gesture away: the opened sheet carries "Plan a different trip" with the same form.
3. **Strings**: all six new strings exist in English and Shona in `dict.ts`; the Shona drafts are machine drafted placeholders and are appended to `docs/shona-translation-worksheet.csv` for the external translator pass.
4. **Disclosure**: a Tier 1 row in `docs/DISCLOSURE-REGISTER.md` and the on screen mirror (`apps/web/src/lib/disclosure.ts`).

## Gate proof

- **Unit tests** (`apps/web/test/home-peek.test.ts`): 12 tests over the chooser. No history, active window, passed window, before the window, wrong weekday, two passed windows, tie on window end, active beats passed, and the four demo cases. All pass.
- **E2e** (`apps/web/e2e/v1-answer-home.spec.ts`), 4 of 4 passing:
  - *Cold open to board code in one tap*: Takunda logs in, lands on `/app`, the peek answers with his usual trip carrying the trio and a basis label, one tap on the CTA books and lands on `/app?booked=1` with a live 4 digit board code on screen.
  - *Ride back*: Takunda's fixture history rebuilt with the window three hours gone (same RPC and jitter shape as the seed, restored after), the peek answers "Your ride back" with the pair reversed.
  - *Search fallback*: the demo rider keeps the search peek exactly as before.
  - *Search still reachable*: the opened sheet carries the plan a different trip form.
- **Screenshots** (`docs/design-evidence/answer-home/`): all three peek states (usual, return, search) in both themes and both languages at the 360px reference viewport, 12 files, captured by `apps/web/scripts/answer-home-evidence.mjs`.
- **Validation**: `pnpm typecheck`, `pnpm lint`, `pnpm test` green. Home touching e2e regressions rerun green (book, commute, saved trip, theme, intelligence; intelligence needed the playwright managed stack because it refuses the mock ETA label by design).

## Decisions taken, flagged for Mhofu

1. **The answer peek is gated by the existing commute alerts preference.** One switch means "act on my mined patterns". This keeps the promise that a rider who opted out sees no pattern driven surface, and it keeps every existing flow (and the pooled judge personas, whose prefs reset to off) on the plain search peek. Takunda has the pref on. If the answer home should instead be on for everyone with history, that is a one line change; say the word.
2. **The commute alert stays.** The floating "your usual kombi is close" alert is unchanged and can appear above the answer peek. They answer different questions (supply now versus your next action), but on stage they show related copy twice; if that reads as noise, hiding the alert when the peek already answers is a small change awaiting a ruling.
3. **The return rule is deliberate**: reverse of the latest passed window today. At night after both commute legs, the answer is tomorrow's ride in. Documented in the chooser header.
4. **The staged return moment in tests** rebuilds Takunda's fixture history through the existing `reset_demo_commute_history` RPC (demo profiles only, his own session) and restores it afterwards; no new persona, no schema change. Before roughly 04:30 Harare time there is nowhere to put a passed window in the day, so that one spec skips with an annotation.

## Plain language summary

When Takunda opens Svika at his usual commute time, the app no longer asks him where he is going. It tells him: your usual kombi from 2nd boom gate to Rezende Rank, it arrives in 11 minutes, the fare is $1.50, your wallet covers it. One tap and his board code is held. In the evening the same card offers the ride home. Anyone the app does not recognise sees the search box exactly as before, and every number still says what it stands on.
