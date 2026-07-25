# Mbare Sun — agreed deviations from the reference screens

The seven numbered screens in `Svika Mbare Sun/` are the visual truth for this
app. Nine deviations are agreed with Mhofu (1 and 2 on 2026-07-10, 3 on
2026-07-11, 4 and 5 on 2026-07-23, 6 to 9 on the K1 gate 2026-07-24) and are
deliberate. Everything else follows DESIGN.md verbatim.

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

## 6. Kombi card as a top layer dialog over the map (K1, ratified)

No reference screen shows a card opened by tapping a map marker; the peek
sheet in section 9 is fixed chrome, not a modal. K1 needs the tapped kombi's
card above the live map without leaving it, so the card rides the same
carrier as the ETA basis card (an earlier flagged spec addition): a native
dialog in the browser top layer, section 8 card grammar (white card, 1.5px
char border, large card radius, day dark shadow; night overlay card) over
the char tinted scrim `rgba(22,29,24,.45)`. One primary action per screen
holds: the card's only CTA is the board, in the exact section 5 anatomy.
By night the dialog takes the section 9 night sheet surface (solid char,
white alpha border) because the overlay tint would let the map bleed
through the copy. Ratified by Mhofu on the K1 gate (2026-07-24).

## 7. Board rows as section 8 cards (K1, ratified)

The reference screens have no list-of-vehicles view. The board renders one
section 8 card per kombi (white, 1.5px char border, 16px radius by day;
night overlay card), stacked with section spacing, entering with the svk
rise stagger from section 12. The facts block inside is identical to the
marker card so the two surfaces cannot drift. Ratified by Mhofu on the K1
gate (2026-07-24).

## 8. Trust chip colours, including signal for the drift state (K1, ratified)

The spec has no trust or status chip grammar, and section 2 rules signal
`#E84C30` for live dots and stops ONLY. Mhofu's K1 instruction rules that
red means unverified against facts, never a character score, so the chips
are: unverified (the default) a quiet soft ink outline chip; verified fares
forest with white label by day, marigold outline at night; seats drift
signal with white label by day, signal outline at night. This extends the
signal ONLY rule by one deliberate use. Ratified by Mhofu on the K1 gate
(2026-07-24): red is against facts, never character.

## 9. The kombis chip on the map home (K1, ratified)

The reference home has no door to a vehicle list. The board must be one tap
from the map home, so a glass chip labelled "Kombis" joins the existing
header chip row (theme, language, profile), same section 7 chip anatomy as
its neighbours, linking to /app/kombis. Ratified by Mhofu on the K1 gate
(2026-07-24).

## 10. Self position dot on the recording map (M1, ratified)

DESIGN.md has no marker for the rider's own live position; section 7 rules
the signal live dot for live pills, and section 2 rules signal for live
dots and stops only. The record my trip screen (batch M1) needs the rider
to see themselves move, so the trace map grows the section 7 live dot to a
16px map marker with the stop pin's 3px white stroke (section 11 grammar).
The rider's own live position is literally a live dot, so this reads as an
application of the signal rule, not a breach. Ratified by Mhofu on the M1
gate (2026-07-25).

## 11. The recording chip (M1, ratified)

The spec has no recording state grammar. The record screen wears a section
7 glass pill in the map header: signal live dot with ripple, the word
Recording, then elapsed time and distance in IBM Plex Mono 600 (section 2:
every time and count is mono). Same pill anatomy as the live pill on the
reference landing. Ratified by Mhofu on the M1 gate (2026-07-25).

## 12. Guide cue banner (M2, ratified)

The spec has no turn by turn or warning grammar. The guide viewer shows
one cue line above the way card: off path takes marigold with char text
(the section 2 pair; signal stays live dots and stops only, so the warning
never wears red), approaching and arrived take the park tone with char
text. Sentence case, aria-live, hidden while on the path. Ratified by
Mhofu on the M2 gate (2026-07-25).
