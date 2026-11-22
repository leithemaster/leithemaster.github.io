# DESIGN.md: The Reading

The design source of truth for Liem Nguyen's site. The public version of this document,
with live specimens, is `design.html`. Tokens live in `src/style.css` (`:root`); this file
explains them. When the two disagree, the CSS wins and this file gets fixed.

## Concept

A tarot reading where the visitor turns the cards and finds me. Three things I love, one idea:

1. **The figure.** A photo I made: a crowd in matching blue jackets, all looking up, and one
   person in black: me. Not louder, just made differently: a designer who also builds.
2. **The ink.** I started as an artist. A hand-written GPU fluid sim follows the cursor and
   settles like smoke, in colours sampled from the jackets.
3. **The cards.** I love card games and card art. The site is a spread: past, present, future,
   turned one at a time. The person being read (the Querent) is me.

## The spread

| Position | Card | Why this card | Content |
|---|---|---|---|
| Querent | Me | The person being read | Hero, and the resume page ("The Querent") |
| I · Past | I · The Magician | I make magic when I work on sites | Full Sail 2018, Fund Diet (React Native), Geocent (design lead) |
| II · Present | 0 · The Fool | I enjoy everything and want to start everything, which people call foolish | Sev1Tech full stack (NexGen at USCIS), independent work now, this site |
| III · Future | XVII · The Star | I star myself for a confidence boost | Available now, contact |

Emblems:

- **The Magician**: a sunburst ring; the wand pointing up and down ("as above, so below"),
  sparkle at each end; a true lemniscate overhead; a table holding the four suits (cup,
  pentacle, sword, wand): every tool at hand.
- **The Fool**: a ring for his 0, broken by a gap on the right. Inside: the sun, the mountains,
  a white rose, a bindle at the cliff edge. The dotted leap leaves through the gap and ends in
  a sparkle outside the ring.
- **The Star**: one great star and seven small ones in a dotted orbit.
Numerals use lining figures so the Fool's 0 never reads as a letter o.

Card data: `src/cards.ts`. Drawing: `src/tarot.ts`.

## Colour

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--c-bg` Night | `#090a12` | Every page's ground | |
| `--c-text` Bone | `#f1ece2` | Body text | 16.8:1 on night |
| `--c-muted` Ash | `#a9a6b8` | Labels, quiet text | 8.3:1 on night |
| `--c-accent` Ultramarine | `#2f43d6` | Ink, fills. **Never text on night** | 2.7:1 |
| `--c-card` Card blue | `#0b1240` | Card stock, the mark | |
| `--c-card-glow` | `#1d2c95` | Lit centre of a card | |
| `--c-gold` Gilt | `#c9a24a` | Line work on cards | 7.4:1 on card blue |
| `--c-gold-hi` | `#ecd28f` | Gilt highlights, card titles | 12.1:1 on card blue |
| `--c-paper` Paper | `#ebe4d6` | Resume stock | |
| `--c-paper-ink` | `#1b1d33` | Text on paper | 13.1:1 |
| `--c-paper-soft` | `#55576e` | Quiet text on paper | 5.6:1 |
| `--c-paper-accent` | `#2433a8` | Links on paper | 7.9:1 |
| `--c-paper-gilt` Old gilt | `#8a6a24` | Rules and ornament on paper, not text | 4.0:1 |

No violet or lavender anywhere. Gold belongs to the cards, the mark and rules; it is not a
button or link colour on night. One exception: the Work page's "Read the full case study" button is
solid gilt (gilt-highlight fill, card-blue text), so it belongs with the case drawings above it.

## Type

- **DM Sans**: everything readable. Body 17px / 1.5. Display 750 weight, −0.045em, up to 11rem.
- **Cormorant Garamond** 600: card numerals and titles, the resume's arcana line. Spaced
  capitals. Never running text.
- **DM Mono**: labels, dates, stacks, nav. Uppercase when labelling, tabular numbers when counting.

## Space and shape

8px scale: `--s-1` 8, `--s-2` 16, `--s-3` 24, `--s-4` 32, `--s-6` 48, `--s-8` 64, `--s-12` 96.
Pills and buttons are fully round. Cards and panels: 10 to 16px radius. Tap targets 44px minimum.

## The mark

`public/mark.svg` (also the favicon): a tarot card in miniature. Card blue, a gilt double
rule, the Star's four-point sparkle, LN in Cormorant. Always upright, on night or card blue,
16px tall minimum.

## The deck

Ratio 7:12, drawn as SVG in a 280 × 480 box. Every card: a double gilt rule with corner star
medallions. Face: Roman numeral over a short rule, one line-drawn emblem, title in spaced
Cormorant capitals, position in DM Mono. Back: a compass star in a sunburst, dotted orbits,
crescent moons, and a fixed (seeded) starfield. Cards are `<button>`s with an `aria-label`
and `aria-pressed`; the SVG is `aria-hidden`.

## Ink

Engine `src/fluid/`, mount `src/ink.ts`. Tuned slow: cursor follow 5/s, push 0.45×, curl 14,
ink fade 0.55/s, idle drift 0.45×. Palette: ultramarine, deep blue, gilt (boosted 3.2× to read
through a `screen` blend over the photo). Rules:

- One ink surface per screen.
- Over a photo it blends with `screen` and is masked clear around the figure (`trackFigure`).
- Reduced motion: no idle drift. Off screen: hidden.

## Photography

The hero photo is the only photograph style: the crowd from above, one person not in
uniform. Darken it under type; never recolour it, never cover the figure's face.

## Motion

- Hero enters once. Cards turn with a 900ms 3D flip on `cubic-bezier(0.23, 1, 0.32, 1)`.
- Buttons press to 0.97. Cards lift 6px on hover (hover devices only).
- No scroll-triggered fades, no parallax on text.
- `prefers-reduced-motion`: cards turn instantly, no transitions, no ink drift.

## Voice

First person, plain, short sentences. Name real companies, years, tools and outcomes. The
tarot is the frame, never the joke: no fortune-teller puns. No "passionate", "innovative" or
"rockstar".

## The work

`work.html` holds the case studies, grouped under the card each belongs to: the Magician (Geocent:
Marines portal, Navy portal) and the Fool (Sev1Tech: NexGen at USCIS; Independent: a mobile-first game,
coded with help from Claude Code; the game and its platform are not named). AI work is shown inside the case it was used on, not as a case of its own. Each case has a brief, my part
and the result up front, then the full case folded in a `<details>`: problem, design, build (or
handoff), outcome, stack.

The drawings are drawn like the deck: gilt line work on card-blue stock inside the double gilt
rule, plates with corner star medallions, titles in spaced Cormorant capitals, labels in DM Mono.
Gilt highlight marks the one thing to look at (the chosen option, the shipped focus ring); bone is
kept for redlines so they read as notes, not interface; ultramarine is for fills only. Each figure
reuses a motif from the cards: the Fool's dotted leap for a request's path, a hand of cards for
design options, the Star's orbit and compass for the sprint loop. Stage buttons (Problem, Design,
Build, Outcome) dim every other part of the drawing; without JS they hide and the drawing shows
whole. The SVGs are generated by `tools/figures.mjs` (`npm run figures`), which writes them into
`work.html` between `<!--fig:name-->` markers. On phones the sheet pans sideways instead of shrinking.

## Resume

`resume.html` keeps the original one-page sheet: light-weight name, mono section labels,
hairline dividers, em-dash bullets, mono dates. On screen it is a card face in paper stock with
the gilt double rule and corner stars, under the line "The Querent". In print every
ornament drops and it is plain black on white, laid out on a grid so ATS parsers read it in order.
