# Mbare Sun — agreed deviations from the reference screens

The seven numbered screens in `Svika Mbare Sun/` are the visual truth for this
app. Four deviations are agreed with Mhofu (1 and 2 on 2026-07-10, 3 on
2026-07-11, 4 on 2026-07-23) and are deliberate. Everything else follows
DESIGN.md verbatim.

## 1. No fake status bar

Every reference screen opens with a status bar (11:00 day / 22:00 night,
signal and battery glyphs). That bar represents device chrome in the mockups,
not app UI. The web app runs inside a real phone's chrome, so it never renders
a simulated status bar. Layouts start where the reference's app content starts.

## 2. Bilingual English and Shona

DESIGN.md hard rule 4 says English only. That rule describes the reference
copy, not the product: the app stays bilingual English/Shona from the
translation file (`apps/web/src/lib/dict.ts`), as product law in CLAUDE.md
requires. Every screen must look right in both languages, in both themes.
Sentence case, no em dashes, no hyphenated compounds still apply to both
languages.

## 3. The live map marker is the client's kombi asset, unboxed

DESIGN.md section 10 and section 11 wrap the kombi map marker in a 30px
marigold rounded square with the client's asset as the glyph inside. On the
live map that box hides what makes the asset work: the kombi drawn from
above, rotating with the road it drives. So on live map screens the client's
kombi asset (`apps/web/public/map/kombi-marker.svg`, unchanged since it
first shipped) IS the marker: standalone at its pre reskin 44px, rotating
with the road heading. The bob, the night glow and the night headlight beam
from the spec are kept on the standalone kombi. The marigold box language
stays everywhere that is not a live map marker (the landing kombi highlight,
chips, cards).

## 4. Place and suburb map labels use IBM Plex Sans Regular

DESIGN.md section 11 rules street labels only: IBM Plex Mono 9px. The self
hosted native map (M0) also draws place, suburb and park name labels, which
the spec does not cover. Ruled with Mhofu on the M0 gate: those labels take
IBM Plex Sans Regular (the brand body font) in the street label and park
label colours from section 2. Street labels stay IBM Plex Mono SemiBold 9px
per spec. Both stacks are self hosted (`tools/map-tiles/build-glyphs.mjs`).

## 5. Destination place pin in the walk tone (D1, ratified)

DESIGN.md section 2 rules signal `#E84C30` for live dots and stops ONLY,
and no reference screen shows a destination that is not a stop. D1 lets a
plan end at any named place, so its map needs a pin the spec does not
have. Ratified by Mhofu on the D1 gate (2026-07-23): the destination
place pin is the same 7px circle geometry as the section 11 stop pin but
filled with the walk tone (`#575F53` day, `rgba(255,255,255,.55)` night),
the same tone as the dashed walking tail it terminates, with the usual
white stroke. Stops on the plan keep their signal pins untouched; a plan
that ends at a stop is unchanged.
