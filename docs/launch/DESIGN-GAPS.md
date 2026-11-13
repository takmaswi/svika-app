# Launch v2 design gaps

The 16 approved screens in `Svika Mbare Sun/launch-v2/` are the visual truth
(docs/LAUNCH-CROWD-PLAN.md). When a screen needs a pattern none of them
covers, the nearest launch-v2 pattern is copied and logged here. Nothing in
this file is a new invention; each row names its source.

| id | step | where | what the screens do not cover | copied from |
| --- | --- | --- | --- | --- |
| G1 | 1 | top row over a map (home, plan, share) | the screens put the top bar on the marigold hero band, never over a map | Home-Final `<header>`: the white brand pill, 44px round buttons and the char "Sign in" pill, lifted onto the raised surface (`--v2-raised` with `--v2-float-shadow`) so they read over map tiles; the round buttons grow to the 48px product target |
| G2 | 1 | a missing or wrong field | no error state anywhere in the 16 screens, and signal `#E84C30` is live dots and stops only | Sign-Up's shield notice (`.v2-notice`: icon tile plus words) for the message, and a 2px ink ring on the field in place of the forest focus ring; the status is the icon plus the words, never colour alone |
| G3 | 1 | map credits | the screens draw no map credits (Rank-Page has a text credit line under its sheet) | the 44px round button grammar with the info glyph, bottom left, opening the full credit line on tap (plan Step 1.7) |
| G4 | 3 | planner: finding you, and location off | Planner draws the From row as "My location" but no state for asking, waiting or a refusal | Sign-Up's shield notice (`.v2-notice`: icon tile plus words) with the pin glyph; the refusal is words plus the icon and moves focus into From, never colour alone |
| G5 | 3 | trip result with no rider reported fare | Trip-Result always shows a fare figure; with no reports there is none to show | the same stat tile, value "Not yet" in soft ink (`.v2-stat-none`) and one note line under the stats saying why, in the Trip-Result note style |
