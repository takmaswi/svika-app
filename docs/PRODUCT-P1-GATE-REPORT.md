# Product P1 gate report: the demo strip

Status: PASSED (closed 2026-07-23 on the `product` branch). Every proof
below carries its evidence.

Scope ruled by docs/PRODUCT-FIRST-PLAN.md batch P1 and executed exactly per
docs/DEMO-STRIP-INVENTORY.md. The database was not touched: demo tables,
RPCs, personas and seeds all remain, because the live Supabase project also
serves the frozen Vercel demo on main.

## What P1 delivered

1. The demo theatre is gone from this branch: story mode engine and chrome,
   the three vision scenes, the USSD machine, the pooled persona door at
   /api/demo, and the sandbox shelf. Six pages unwrapped from the
   presentation stage with no behaviour change.
2. The landing is now the real front door: the live map (with its standing
   provenance chip) grown into the hero, the Kombi headline, one primary
   CTA into /login, and the register/privacy/repo footer. The fabricated
   stat cards left with the theatre.
3. E2e entry reworked: the four demo bound suites (demo, stories, vision,
   exits) are deleted; intelligence and mobile-qa now authenticate through
   the seeded E2E_AUTH accounts like every core suite.
4. The honesty machinery stayed: /register renders the trimmed register,
   every provenance label survives (map demo movement chip, demo estimate
   basis labels, simulated watchdog history label, demo account chip on
   pooled personas).

## Gate proofs

### No demo route or component remains

- `apps/web/src` contains zero story/, vision/ or ussd/ paths and zero code
  references to StoryStage, lib/stories, demo-actions, lib/vision or
  lib/ussd across src, e2e and test (`find` and `grep -rln` both count 0,
  run 2026-07-23 post strip).
- /vision/* and /api/demo no longer exist in the after build route table.

### Validation wall

| Check | Before (baseline, P0) | After (P1) |
| --- | --- | --- |
| typecheck | clean | clean |
| lint | clean | clean |
| unit | 296/296 | 283/283 (13 USSD machine tests left with their machine) |
| e2e | 58/59 (share mint known baseline red) | 40/41, same single known baseline red (share.spec.ts:21 share-create, identical failure line); reworked intelligence and mobile-qa both green |
| RLS | 102/102 | unchanged (no DB change on this branch) |

### Bundle before vs after (route table, First Load JS)

`next build` route tables on this branch, immediately before and after the
strip commit f9ded63. Every demo route is gone and every surviving route
got lighter or held; no route grew.

| Route | Before | After | Change |
| --- | --- | --- | --- |
| / | 128 kB | 122 kB | -6 kB |
| /app | 169 kB | 162 kB | -7 kB |
| /app/intelligence | 128 kB | 110 kB | -18 kB |
| /app/owner | 128 kB | 110 kB | -18 kB |
| /app/owner/statement | 110 kB | 110 kB | 0 |
| /app/parcel | 110 kB | 110 kB | 0 |
| /app/plan | 129 kB | 111 kB | -18 kB |
| /app/privacy | 110 kB | 110 kB | 0 |
| /app/profile | 166 kB | 160 kB | -6 kB |
| /app/ticket/[id] | 110 kB | 110 kB | 0 |
| /app/wallet | 128 kB | 110 kB | -18 kB |
| /consent | 165 kB | 159 kB | -6 kB |
| /login | 166 kB | 160 kB | -6 kB |
| /privacy | 127 kB | 121 kB | -6 kB |
| /register | 127 kB | 121 kB | -6 kB |
| /share/[token] | 130 kB | 123 kB | -7 kB |
| /api/demo | 106 kB | route removed | gone |
| /vision/capacity | 129 kB | route removed | gone |
| /vision/gogo | 129 kB | route removed | gone |
| /vision/tinashe | 129 kB | route removed | gone |
| Shared first load chunk | 106 kB | 106 kB | 0 |

### Front door renders at 360px, both themes, both languages

Captured at 360x740 (2x) against the dev server, full page:
docs/design-evidence/front-door/{light,dark}-{en,sn}.png. Day is paper
white with the forest CTA and marigold arrow chip; night is char with the
marigold CTA, night map palette and headlight beams; Shona strings render
throughout; the Demo movement provenance chip stands on the map in both.
Capture script: apps/web/scripts/front-door-screens.mjs.

## Decisions taken inside the ruled scope

Ruled by Mhofu on 2026-07-23: all three APPROVED as taken. (1) Stat cards
removed, no fabricated values to logged out visitors. (2) Register rows
trimmed, this branch's register reflects this branch's surfaces and main
keeps its own. (3) Demo account chip and takunda fixture retained, still
true while the shared database holds those personas. Goal 1 is signed off
and closed.

1. The landing stat cards ($1.50 change kept, ticket 74 21) were removed
   with the theatre: they showed fabricated values to logged out visitors,
   which "no marketing theatre" rules out. Their disclosure register row
   went with them.
2. The disclosure register (module and canonical doc, same commit) lost the
   rows for surfaces that no longer exist on this branch. The frozen main
   deployment keeps its own register. Flagged because the register is the
   honesty ledger.
3. The takunda commute fixture row and the demo account chip stay: the
   personas still exist in the shared database and e2e signs in with seeded
   demo accounts, so the chip and the profile stats windowing remain true
   on this branch.
