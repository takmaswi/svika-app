# Step 1 report: UI foundation upgrade (launch-v2 system)

Plan: docs/LAUNCH-CROWD-PLAN.md, Step 1. Flag: `ui_v2`. Status: built, wall below.

The plan splits the work: Step 1 brings the launch-v2 system to the screens that exist today; Step 3 onward rebuilds each screen to its approved layout. So this step changes surfaces, spacing, targets, fields, motion, plurals and empty states, not page layouts.

## How it is switched

`ui_v2` sets `data-ui="v2"` on `<html>` (root layout) and hands the same answer to client components through a small context (`lib/ui-v2.tsx`), so server and client render the same markup. Every rule in `packages/ui/launch-v2.css` is scoped to `:root[data-ui="v2"]`, and the sheet loads last so it wins every tie with the pre launch styles. With the flag off nothing changes; the e2e suite proves it (`launch-v2.spec.ts`, first test).

## What changed, item by item

| plan item | what shipped |
| --- | --- |
| 1. borderless surfaces, char tinted depth | the `--border-card/-soft/-pill/-key/-nav` tokens go to zero under v2; cards, panels, the sheet, top row chips and fields take the launch-v2 shadows and surfaces (values copied from the screens into `launch-v2.css`). The place name field was drawn only by its outline and vanished, so every text field now gets the v2 field surface. |
| 2. one grid | 20px screen edge, 16px card padding, 12px between cards, 24px between sections; 16px body text |
| 3. 48px targets, one primary action | top row buttons, back buttons, the search go chip and the map credits button are 48px (44px for the credits glyph button, the approved round button size); back buttons take the approved round button |
| 4. visible labels, inline validation | labels "From" and "To" on the launch search; `FormCheck` turns the native bubble off under v2, marks each missing field, moves focus to the first, and names the problem in Svika copy in one live line. The screens show no error state and signal red is live dots and stops only, so the error copies the Sign-Up notice (icon tile plus words) and an ink ring: DESIGN-GAPS G2 |
| 5. motion | press scale 0.99 with spring back and the 240ms sheet were in the token sheet; a 12ms vibration when a trip is saved (`lib/haptics.ts`), never under reduced motion; everything off under reduced motion. Skeletons already replace spinners (`components/Skeleton.tsx`). Step list stagger and optimistic counts arrive with the step card (Step 3) and "I boarded here" (Step 4), the first screens that have them |
| 6. empty states | the empty trips list now says what to do and links straight to recording (it sent riders to a plan screen with no record button, or a ticket the launch does not have) |
| 7. no ND chip, credits as info button | one round language button whose accessible name starts with its visible text ("EN Switch to Shona"); the map credits fold into an info button bottom left, seated above whichever sheet the screen has, opening on tap (DESIGN-GAPS G3) |
| 8. plurals | count phrases move into the translation file as an other form and a `.one` form, chosen by `Intl.PluralRules` for English and Shona (`lib/plural.ts`). Fixed: the planner's "1 kombis", the arrival basis card, the intelligence ladder, the fare board count and the kombi facts lines |

## Honesty fixes found on the way

- The launch home's sheet toggle was labelled "Show wallet and tickets" (Lighthouse caught it as a label mismatch; the crawler did not, because it has no banned word). The launch has neither, so it now reads "Show your trips and more", and the title toggle is named by its visible title.

## Logged, not fixed here (the step that owns it)

- The planner sheet shows the network fare ("$3.00") without "riders reported". It is the documented 2026 fare (one 150 cent corridor fare measured, the rest derived), not simulated, but the launch rule is riders reported with count and window. Step 3 rebuilds this sheet as the step card with the riders reported fare.
- The privacy page still names tickets and wallet credit. Step 2 owns the privacy page.
- The kombi pulse shows "0 of 16" when nothing has cleared. The kombi board is hidden under launch, and `KombiFacts` renders in server and client trees, so it cannot read the v2 flag without a restructure; changing it for everyone would also change what the V5 e2e reads. Left for the step that brings the board back.

## Design gaps (docs/launch/DESIGN-GAPS.md)

G1 top row over a map, G2 field errors, G3 map credits. Each copies the nearest approved pattern; none is new.

## Proof

- `e2e/launch-v2.spec.ts` (5): flag scoping, the language button (48px, name, toggles), map credits fold and open, inline validation end to end into the planner, "1 kombi".
- Unit: `test/plural.test.ts` (7), `test/haptics.test.ts` (3).
- Screenshots, 360px, both themes, both languages: `docs/design-evidence/launch/step-1/`. "before-*" for the public screens are the live Step 0 deploy with the preview cookie; "after-*" are this build with the preview cookie; signed in screens have both from the local server (every launch flag on, `ui_v2` off for before).
- Lighthouse accessibility: below.
