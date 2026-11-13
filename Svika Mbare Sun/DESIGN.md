# Svika DESIGN.md — build spec for new screens
Mbare sun system. Everything an AI or designer needs to build a new Svika
screen that is indistinguishable from screens 1–7. Extract-only: every value
below is lifted verbatim from the shipped files. If your screen needs
something not specified here, copy it from the numbered screen that has it —
never invent a variant.

Files in this bundle:
- `1 Landing + Map Day.dc.html`, `2 Landing + Map Night.dc.html`
- `3 Trip Plan.dc.html`, `4 Ticket.dc.html`, `5 Wallet.dc.html`,
  `6 Owner Dashboard.dc.html`, `7 Conductor Keypad.dc.html`
- `assets/logo.svg`, `assets/wordmark.svg` — used as-is, never rebuilt or recolored
- `support.js` — runtime; keep next to the .dc.html files
- `TOKENS + CHANGE NOTE.md` — token history vs the retired foundations

---

## 1. Canvas and frame
- Screen: 360×760, `box-sizing:border-box`, padding `16px 22px 18px`
  (keypad: `16px 20px 18px`), `font-family:'IBM Plex Sans',sans-serif`.
- Day canvas `#FFFFFF` — never cream/bone. Night canvas `#161D18`.
- Every screen starts with the status bar (section 4).

## 2. Tokens
Day: paper `#FFFFFF` · marigold `#F5B301` · char `#161D18` · forest `#1F4D2E`
· signal `#E84C30` (live dots + stops ONLY) · park `#D9E8CC` · map base
`#F4F5F1` · road casing `#E1E3DA` · building `#EAECE5` · soft ink `#575F53`
· street label `#6E766A` · forest hover `#143D22`.

Night: map base `#121710` · building `#1B211A` · road casing `#222B22` ·
road `#333E33` · minor road `#2A342B` · park `#1B3423` · surface dark
`#10150F` (nav, pills) · overlay card `rgba(255,255,255,.06)` · borders
`rgba(255,255,255,.10)` cards / `.12`–`.15` pills / `.16` keys · secondary
text `rgba(255,255,255,.55)`–`.62` · labels `rgba(255,255,255,.5)` · street
label `#7E877E` · park label `#6F8F74` · marigold hover `#E3A600`.

Shadows (char/umber tinted, never grey):
- Day card `0 10px 28px rgba(22,29,24,.12)` · day dark card `0 14px 32px rgba(22,29,24,.25)`
- Day CTA `0 10px 26px rgba(31,77,46,.30)`
- Night card `0 14px 34px rgba(0,0,0,.45)` · night CTA `0 10px 26px rgba(0,0,0,.4)`
- Night kombi glow `filter:drop-shadow(0 0 10px rgba(245,179,1,.45))`

Type:
- Display: `'DM Sans',sans-serif` 700, letter-spacing `-0.02em`/`-0.025em`.
  H1 38px landing, 22–24px screen titles.
- Body/UI: `'IBM Plex Sans',sans-serif`. Body 14.5px/1.55, secondary 11–12.5px.
- Mono (`'IBM Plex Mono',monospace` 600): EVERY code, fare, plate, time,
  count, street label. Boarding code 58px on ticket, 19px on cards.
- Labels: 9–10.5px, weight 600–700, `letter-spacing:.5–.8px`, uppercase.
- Baloo 2 700 only inside the wordmark lockup.
- Google Fonts import (same line in every file):
  `@import url("https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700&family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap");`

## 3. THE arrow (one glyph, no others)
Forward arrow, used in every CTA chip and the plan-trip button:
```
<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 10.1c0-.72.58-1.3 1.3-1.3H12V6.1c0-1.28 1.5-1.94 2.42-1.05l6.28 6.05c.6.58.6 1.54 0 2.12l-6.28 6.05C13.5 20.16 12 19.5 12 18.22V15.5H5.3A1.3 1.3 0 0 1 4 14.2z"></path></svg>
```
Back arrow = the mirrored path used in the 44px back button:
```
<path d="M20 10.1c0-.72-.58-1.3-1.3-1.3H12V6.1c0-1.28-1.5-1.94-2.42-1.05L3.3 11.1c-.6.58-.6 1.54 0 2.12l6.28 6.05C10.5 20.16 12 19.5 12 18.22V15.5h6.7a1.3 1.3 0 0 0 1.3-1.3z"></path>
```
Never use chevrons, ‹ › characters, or any other arrow shape.

## 4. Status bar (every screen, first element)
```
<div style="display:flex;align-items:center;justify-content:space-between;height:16px;margin:0 0 12px;color:#161D18">  <!-- night: color:#FFFFFF, time 22:00 -->
  <span style="font-family:'IBM Plex Mono',monospace;font-size:11.5px;font-weight:600">11:00</span>
  <span style="display:inline-flex;align-items:center;gap:6px">
    <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><rect x="0" y="7" width="2.6" height="4" rx="1"></rect><rect x="4" y="4.6" width="2.6" height="6.4" rx="1"></rect><rect x="8" y="2.2" width="2.6" height="8.8" rx="1"></rect><rect x="12" y="0" width="2.6" height="11" rx="1" opacity="0.35"></rect></svg>
    <svg width="22" height="11" viewBox="0 0 22 11"><rect x="0.75" y="0.75" width="18" height="9.5" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"></rect><rect x="2.75" y="2.75" width="10" height="5.5" rx="1.5" fill="currentColor"></rect><rect x="20.5" y="3.5" width="1.5" height="4" rx="0.75" fill="currentColor"></rect></svg>
  </span>
</div>
```
On map screens it is `position:absolute;top:10px;left:20px;right:20px;z-index:25`.

## 5. Primary CTA pill (one anatomy, two themes)
Row pill, label left, 40px round arrow chip right. `min-height:58px`,
`border-radius:999px`, `padding:9px 10px 9px 22px`, no border,
`style-active="transform:scale(0.99)"`.
- Day: `background:#1F4D2E`, hover `#143D22`, shadow
  `0 10px 26px rgba(31,77,46,.30)`; label 16px **600** `#FFFFFF`;
  chip `background:#F5B301;color:#161D18`.
- Night: `background:#F5B301`, hover `#E3A600`, shadow
  `0 10px 26px rgba(0,0,0,.4)`; label 16px **700** `#161D18`;
  chip `background:#161D18;color:#F5B301`.
The 600/700 weight difference is intentional (marigold needs the heavier cut).
Full-width plain CTA (keypad confirm): same pill, centered label 18px 700,
`min-height:64px`, no chip.

## 6. Buttons and controls
- Back button: 44×44 circle. Day `background:#FFFFFF;border:1.5px solid #161D18;color:#161D18`.
  Night `background:#10150F;border:1px solid rgba(255,255,255,.15);color:#FFFFFF`.
- Text button (e.g. "Cancel this ticket"): no border/bg, 13px 600,
  `#575F53` day / `rgba(255,255,255,.55)` night, `min-height:48px`.
- Inline link: 12px 600, `#1F4D2E` day / `#F5B301` night.
- Keypad key: `min-height:72px;border-radius:18px`, mono 28px 600.
  Day `border:1.5px solid #161D18;background:#FFFFFF`, active bg `#F4F5F1`.
  Night `border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06)`,
  active bg `rgba(255,255,255,.12)`. Grid `repeat(3,1fr)`, gap 10px.
- EVERY button gets `style-active="transform:scale(0.99)"`.
- Hit targets: 44px+ rider, 56–72px conductor.

## 7. Pills and chips
- Wordmark pill: white pill `padding:7px 14px;border-radius:999px`; day adds
  `border:1.5px solid #161D18`, night adds shadow `0 4px 16px rgba(0,0,0,.4)`.
  Wordmark inside is the inline logo SVG + "vika" in Baloo 2 700 `#1F4D2E`.
- Live pill: signal dot (7px, `svk-pulse`) + ripple (`svk-ripple`) + 11px 600
  text. Day `#FFFFFF` + 1.5px char border; night `#10150F` +
  `1px rgba(255,255,255,.12)`.
- Plate chip: mono 11.5–12.5px 600, `border-radius:8px`, `padding:6px 9px`
  to `7px 11px`. Marigold bg + char text (or char bg + marigold text on
  white ticket).
- Map place chip (SVG): `rect rx=10 h=20` fill `#161D18` day /
  `#10150F` + `stroke rgba(255,255,255,.18)` night; mono 9px white text.

## 8. Cards
- Day bordered card: `border:1.5px solid #161D18;border-radius:14–16px;background:#FFFFFF`.
  De-emphasized variant: `border:1.5px solid rgba(22,29,24,.25)`.
- Night card: `background:rgba(255,255,255,.06–.07);border:1px solid rgba(255,255,255,.10–.14)`.
  Selected/featured night card: `border:1.5px solid rgba(245,179,1,.7)` or
  `1px rgba(245,179,1,.4)`.
- Dark feature card on day (wallet balance, takings, ticket): `background:#161D18;border-radius:20px;padding:20px` + day dark-card shadow.
- Ticket perforation: `height:0;border-top:1.5px dashed rgba(255,255,255,.3)`
  (day ticket) / `rgba(22,29,24,.35)` (night ticket), `margin:4px 6px`; two
  18px notch circles at `left:-15px`/`right:-15px`, `top:-9px`, bg = page color.
- Mini ticket stub (landing code card): 11px marigold stub +
  `border-right:1.5px dashed #161D18`.
- Route option card: 40px badge (`border-radius:12px`, DM Sans 700 15px;
  marigold selected, park/night-park unselected) + name 14px 600 + rank line
  11px + mono time 15px + mono fare 12px + 22px check circle
  (forest day / marigold night) on the selected card only.

## 9. Peek sheet and nav
- Peek sheet: absolute bottom, `border-top-left/right-radius:24px`; day
  `background:#FFFFFF;border-top:1.5px solid #161D18`, shadow
  `0 -14px 36px rgba(22,29,24,.12)`; night `background:#161D18;border-top:1px solid rgba(255,255,255,.12)`, shadow `0 -14px 36px rgba(0,0,0,.5)`.
  Handle: `38×4px` pill, `rgba(22,29,24,.16)` day / `rgba(255,255,255,.25)` night,
  in a 26px row. Map home sheet always shows route + arrival + fare, no scroll.
- Bottom nav: `height:62px;border-radius:22px`; day white + 1.5px char
  border; night `#10150F` + `1px rgba(255,255,255,.08)`. Active item: filled
  icon + 700 label, `#161D18` day / `#F5B301` night; inactive: stroke icon
  (stroke-width 2.2) + 500 label, `#575F53` / `rgba(255,255,255,.55)`.
  Flow screens (trip plan, ticket, keypad) use the back button, no nav.

## 10. Kombi highlight (headline)
The marigold Hiace-shaped block behind the word in "Beyond the / Kombi".
Copy the whole `<span>` from screen 1 or 2 — body path
`M6 62 L6 20 Q6 5 22 5 L130 5 Q145 5 154 14 L186 40 Q200 48 200 56 L200 62 Z`
fill `#F5B301`, windshield path fill `#161D18` opacity .8, two 18px wheels
(`background:#161D18;border:3px solid #FFFFFF`) at `bottom:-8px`,
`left:26px` / `right:38px`. Text inside: DM Sans 700 34px `#161D18`.

## 11. Map spec
Layer order: base rect → park shapes → buildings → road casing → road fill →
minor roads → street labels → route → stop pins → place chip → kombi markers.
- Roads: casing stroke 17 (mini-map 15), fill 11 (10), minor 5 (4), all
  `stroke-linecap:round`. Colors from section 2 per theme.
- Street labels: `IBM Plex Mono` 9px, `letter-spacing:0.6`. Only real names:
  Samora Machel Ave, Jason Moyo Ave, Julius Nyerere Way, Chinhoyi St,
  Harare Gardens, Copacabana, Rezende Rank, Mbare, Avondale, UZ, Sam Levy's.
- Route: `stroke-width:5;stroke-dasharray:1 11` (mini: 4.5 / `1 10`),
  `#161D18` @ .85 day, `#FFFFFF` @ .75 night. Revealed by svk-draw mask
  (mask path: same d, `pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"`, width 16–18).
- Stop pins: `r=7` (mini 6.5) fill `#E84C30`, `stroke:#FFFFFF` width 3.
- Kombi marker: 30px rounded square (rx 10) marigold; day stroke
  `#161D18` 2.5, night stroke `#FFFFFF` 3 + glow. THE GLYPH INSIDE IS A
  PLACEHOLDER — the client's kombi map asset replaces it. Keep marker box,
  bob and glow.
- Night headlight beam (behind marker, rotated toward travel):
  `M13 -5 L68 -28 L68 28 L13 5 Z` @ .12 + `M13 -4 L48 -16 L48 16 L13 4 Z`
  @ .15, fill `#F5B301`, group animated `svk-beam`.

## 12. Motion
| Keyframe | Definition | Use |
|---|---|---|
| svk-rise | `from{opacity:0;transform:translateY(14px)}` | entrances, .6s ease-out, stagger delays .05–.95s, fill `both` |
| svk-drive | `from{opacity:0;transform:translateX(-30px)}` | Kombi highlight only, .7s cubic-bezier(.2,.8,.3,1) .25s |
| svk-draw | `to{stroke-dashoffset:0}` | route mask, 1.3–1.5s ease-out, .4–.7s delay |
| svk-fadein/out | opacity 0↔1 | pins/chips after draw (1.5–2.1s); 5 min → 4 min swap at 2.4–2.9s |
| svk-beam | opacity .6↔1, 2.8s infinite | night headlights |
| svk-bob | translateY 0↔-2.5px, 2.4s infinite | kombi markers, min chips |
| svk-pulse / svk-ripple | dot scale/fade 1.6s / 1.8s | live signal dots |
Sequence on map screens: content rises → route draws → destination pin →
place chip → kombis fade in → countdown ticks.

## 13. Hard rules
1. White canvas by day, char by night. Never cream, bone, beige, or gradients.
2. Marigold never as text on white. Char text on marigold is the pair.
3. Signal `#E84C30` = live dots and stops only. Never decoration.
4. English only, sentence case. No em dashes, no hyphenated compounds, no emoji.
5. No icon libraries, no stock photos. Bespoke chunky rounded SVG only;
   reuse existing glyphs before drawing new ones.
6. Real Harare specifics only. Fare is $1.50. Plates like AEH 6647.
7. logo.svg / wordmark.svg as-is; wordmark sits in a white pill on dark.
8. Both themes designed for every screen, one primary action per screen.
9. Codes/fares/plates/times/counts always IBM Plex Mono 600.
10. Every button: press scale(0.99); shadows always tinted, never grey.

## 14. Pre-ship checklist (all must be yes)
1. Status bar present, correct theme color and time (11:00 / 22:00)?
2. Uses THE arrow paths from §3 and no other arrow?
3. CTA matches §5 anatomy exactly (58px pill + 40px chip)?
4. Day AND night versions built, from §2 tokens only?
5. All numbers/codes/times in Plex Mono 600?
6. Hit targets 44px+ (72px keys for conductor)?
7. Press state on every button?
8. Copy: English, sentence case, no em dash, real Harare names, $1.50 fare?
9. Shadows char/umber tinted? No gradients anywhere?
10. Kombi map marker kept as placeholder box (bob + glow) for client asset?

## 15. Known inconsistencies (fix candidates, do not copy)
- Wallet nav icon is a filled credit-card glyph on screen 5 but an outline
  rect on screens 1–2 nav bars. Pick one (recommend the outline).
- Landing "English" chip: day border 1.5px char, night 1px
  rgba(255,255,255,.18) — intentional theme grammar, not a defect.
- Screen 3 trip-plan sheet uses `padding:0 18px 18px` while home sheet is
  `0 18px` with fixed height — intentional (auto-height vs fixed peek).

## 16. Launch v2 (approved 13 Nov 2026, supersedes this spec where they differ)

The 16 screens in `launch-v2/*.dc.html` are the visual truth for the public
launch (docs/LAUNCH-CROWD-PLAN.md). Their values are copied into
`packages/ui/launch-v2.css`, scoped to `:root[data-ui="v2"]` so the pre
launch app is untouched until the `ui_v2` flag is on. What changes against
sections 1 to 15:

- **Surfaces are borderless.** The 1.5px char card, pill, field and key
  outlines (§8) are retired. Depth is char tinted: cards
  `0 10px 28px rgba(22,29,24,.10)`, the raised search card
  `0 16px 36px rgba(22,29,24,.18)`, floating buttons
  `0 6px 16px rgba(22,29,24,.14)`, the CTA `0 10px 26px rgba(31,77,46,.30)`.
  Night cards are `rgba(255,255,255,.06)` with no shadow.
- **Soft surface `#F4F5F1`** for chips, fields, stat cells and notices
  (night `rgba(255,255,255,.07)`), track `#E1E3DA`.
- **Hero band.** Marigold `#F5B301` by day, `#10150F` by night, radius
  `0 0 34px 34px` (short heroes 30px, the planner 28px), with the drawn kombi
  driving in (`drive` .9s, then `bob` 2.4s; speed lines by day, headlight beam
  by night). The 64px search card overlaps it by 34px.
- **Radii:** tile 22, sheet 28, search 20, field and stat 16, go chip 14,
  icon chip 12, nav 24, nav item 18.
- **Bottom nav:** dark floating bar (`#161D18` day, `#10150F` night) 64px
  high, 14px from the edges, three tabs Plan, Ranks, Me, the active tab a
  marigold 52px pill with char label 700.
- **Fields:** visible 13px/600 label, 54px input on the soft surface with a
  2px transparent border that turns forest (marigold at night) on focus or
  when valid, inline helper text in Svika copy, never the browser bubble.
- **Step card:** numbered 36px rail chips (walk soft, board marigold, get off
  char with marigold numeral), a 2px rail line, Plex Mono times.
- **Ticket stub dashes** (2px dashed rail colour) mark money moments.
- **Targets:** 44px in the reference files, 48px minimum in product.
- **Motion:** `rise` .55s `cubic-bezier(.2,.8,.3,1)` staggered .05 to .42s,
  press `scale(0.99)` with a spring back, sheets 240ms, screens about 320ms,
  skeleton shimmer instead of spinners, all off under reduced motion.
- **Live kombi map** is "coming soon" in a fixed 110px slot that later swaps
  to a live preview without relayout.

Gaps found while building are logged in `docs/launch/DESIGN-GAPS.md`.
