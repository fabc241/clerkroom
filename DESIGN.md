---
name: Clerkroom
description: Offline OSCE practice for medical students, as a calm, illustrated clinical-skills studio.
colors:
  canvas: "#f4f6f9"
  surface: "#ffffff"
  surface-2: "#f6f8fb"
  line: "#e2e7ee"
  line-strong: "#cbd3de"
  text: "#1b2232"
  text-2: "#4a5467"
  text-3: "#636c7e"
  accent: "#1c2331"
  on-accent: "#ffffff"
  focus: "#3a6fd8"
  tint-sky: "#dcebf6"
  tint-mint: "#d6eee0"
  tint-butter: "#faefcb"
  tint-rose: "#f7dddb"
  tint-peach: "#fbe5d2"
  tint-lilac: "#e6e2f6"
  tint-slate: "#dde5ee"
  pill-mint-bg: "#cdebd8"
  pill-mint-text: "#1d6a41"
  pill-butter-bg: "#fae4a6"
  pill-butter-text: "#6e4a00"
  pill-rose-bg: "#f6cbc7"
  pill-rose-text: "#96271e"
  good: "#23875a"
  warn: "#9a6700"
  bad: "#c23b33"
  ill-line: "#2b3346"
  room-sky: "#c4d6e2"
  canvas-dark: "#1f252c"
  surface-dark: "#272e37"
  surface-2-dark: "#2e363f"
  line-dark: "#37404b"
  line-strong-dark: "#47525f"
  text-dark: "#eef1f5"
  text-2-dark: "#c3c9d3"
  text-3-dark: "#9aa3b0"
  accent-dark: "#eef1f5"
  on-accent-dark: "#1f252c"
  focus-dark: "#7aa7ff"
  tint-sky-dark: "#2c4a60"
  tint-mint-dark: "#2d5344"
  tint-butter-dark: "#57502f"
  tint-rose-dark: "#5b3639"
  tint-peach-dark: "#5d4432"
  tint-lilac-dark: "#443d63"
  tint-slate-dark: "#35434f"
  pill-mint-bg-dark: "#1f4a33"
  pill-mint-text-dark: "#9fe3bd"
  pill-butter-bg-dark: "#4d3c10"
  pill-butter-text-dark: "#f5d27a"
  pill-rose-bg-dark: "#55231f"
  pill-rose-text-dark: "#ffb4ac"
  good-dark: "#5ccf94"
  warn-dark: "#e3b341"
  bad-dark: "#ff8a80"
  ill-line-dark: "#e4e8ee"
  room-sky-dark: "#b0c1cb"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "'tnum'"
  headline:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  card-title:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.375
  body:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.55
  reading:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.55
  button:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
  pill:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
  full: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 15px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "color-mix(in oklab, #1c2331 86%, #3a6fd8)"
    textColor: "{colors.on-accent}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 15px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.bad}"
    rounded: "{rounded.md}"
    height: "36px"
  button-sm:
    rounded: "{rounded.sm}"
    padding: "0 11px"
    height: "30px"
  button-icon:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    size: "36px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "9px 13px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.full}"
    padding: "0 13px"
    height: "30px"
  chip-on:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
  pill-mint:
    backgroundColor: "{colors.pill-mint-bg}"
    textColor: "{colors.pill-mint-text}"
    typography: "{typography.pill}"
    rounded: "{rounded.full}"
    padding: "2px 9px"
  pill-butter:
    backgroundColor: "{colors.pill-butter-bg}"
    textColor: "{colors.pill-butter-text}"
    typography: "{typography.pill}"
    rounded: "{rounded.full}"
    padding: "2px 9px"
  pill-rose:
    backgroundColor: "{colors.pill-rose-bg}"
    textColor: "{colors.pill-rose-text}"
    typography: "{typography.pill}"
    rounded: "{rounded.full}"
    padding: "2px 9px"
  pill-neutral:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-2}"
    typography: "{typography.pill}"
    rounded: "{rounded.full}"
    padding: "2px 9px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "24px"
  station-card:
    backgroundColor: "{colors.tint-sky}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "12px 16px 14px"
  question-card:
    backgroundColor: "{colors.tint-mint}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "16px"
  finding-card:
    backgroundColor: "{colors.tint-butter}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "20px"
  bubble-you:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.reading}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  bubble-them:
    backgroundColor: "{colors.tint-butter}"
    textColor: "{colors.text}"
    typography: "{typography.reading}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  nav-item-active:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
---

# Design System: Clerkroom

## Overview

**Creative North Star: "The Illustrated Case Studio"**

Clerkroom is a friendly, calm clinical-skills studio. Every station is a pastel case card with a flat-outline illustration on its tint; the consultation happens inside an illustrated consulting room where the conversation reads as speech bubbles; feedback lands as a coloured evaluation, a zoned gauge sweeping to the score, then pass or fail and tinted cards for what went well, what to improve and what to learn. The world was pinned by the user through four reference mock-ups and replaces the earlier printed mark-sheet world entirely.

Density is relaxed but not sparse: white panels on a cool off-white canvas, generous 16px corners, soft two-layer shadows, and one navy ink colour that carries text and the primary action. Colour lives in the tints, which own card tops, question cards, finding cards and notices, never text. Light and Dark are full appearances selected by the Light / Dark / System setting (the main process sets `nativeTheme.themeSource`, and the stylesheet follows `prefers-color-scheme`); in dark the shell turns charcoal, the tints become deep muted fills and the primary becomes a light pill, while the consulting room stays a light sky scene.

The system rejects the earlier mark-sheet world (red-ink rules, condensed verdict type, paper textures), and it does not copy the references' non-product elements: no user profile, no name greeting, no notifications.

**Key Characteristics:**
- Cool canvas, white panels, navy ink; pastel tints carry all colour.
- One family, Plus Jakarta Sans, self-hosted; tabular numerals for every figure.
- Soft, rounded, shadowed: 10-16px radii on controls and panels, pills fully round.
- Hand-authored flat-outline SVG illustration with an outline token that flips for dark; the consulting room is soft editorial artwork with natural figures, generated locally.
- Line icons at 1.5 stroke, round caps and joins.
- Full light and dark appearances; the consulting room stays light in both.

## Colors

A navy-ink-on-white system where colour arrives only as soft pastel tints and semantic status hues.

### Primary
- **Consulting Navy** (accent): the single action colour. Primary pill buttons ("Start station", "Submit answers for evaluation", "Try again"), the selected filter chip, the current stepper step, checked radio and checkbox marks. In dark it inverts to a near-white pill with charcoal text (accent-dark on on-accent-dark).
- **Focus Blue** (focus): keyboard focus rings (2px outline, 2px offset), the field focus border and 3px halo, link underline tint, text selection wash and caret. It is also mixed 14% into the navy for the primary hover.

### Tertiary: the pastel tints
- **Sky, Mint, Butter, Rose, Peach, Lilac, Slate** (tint-*): the colour of the world. Each station owns one tint (mapped by station id, with a specialty fallback) that fills its card top; the lower card band is a lighter step of the same hue (42% tint mixed into surface in oklab). Question cards cycle sky, mint, butter, lilac, peach. Findings use mint (went well), butter (could be improved), rose (key learning points), lilac (practise next). Butter is also the patient's speech bubble. Rose fills error notices and the low-time banner; mint fills confirmation notices; lilac fills the sensitive-topic footer; sky backs the Progress chart and onboarding header. In dark each tint is a deep muted fill of the same hue.
- **Difficulty pills** (pill-mint, pill-butter, pill-rose, bg and text pairs): Foundation, Intermediate, Advanced. Mint also marks a passed best attempt; rose marks "Must pass".

### Neutral
- **Cool Canvas** (canvas): the window background behind panels.
- **Panel White** (surface): panels, header, sidebar, cards' controls, the doctor's speech bubble, inputs.
- **Soft Well** (surface-2): hover fills, the active sidebar item, segmented-control track, neutral pills, the AI-feedback notice.
- **Hairline** (line) and **Firm Line** (line-strong): panel borders and dividers; control outlines and scrollbar thumbs.
- **Navy Ink** (text), **Slate Ink** (text-2), **Quiet Ink** (text-3): primary text; secondary text and labels; hints, captions and placeholders.
- **Illustration Outline** (ill-line): every illustration stroke; it flips to near-white in dark so outlines stay legible on the deep tints.
- **Room Sky** (room-sky): the consulting-room backdrop, matched to the scene artwork's wall and dimmed one step in dark (the artwork dims with it).

### Semantic
- **Pass Green, Borderline Amber, Fail Red** (good, warn, bad): the gauge zones and score arc, result captions, finding and result icons, model status dot, low timer, danger button text. They mark state, never decorate.

### Named Rules
**The Ink on Tint Rule.** On any tint, including the lighter lower band of a station card, text is Navy Ink or Slate Ink only. Both were measured to pass WCAG AA on every tint in both appearances. Quiet Ink is for panels and the canvas, never on a tint.

**The Tint Owns the Surface Rule.** Tints fill surfaces (card tops, question and finding cards, notices, the patient bubble); they are never text colours and never borders. One tint per card; a card's lower band is a lighter step of its own hue, not a second colour.

**The One Navy Voice Rule.** The navy accent is the only saturated action colour. One primary pill per decision region; everything else is a quiet outlined button.

**The Light Room Rule.** The consulting room keeps its light sky scene and light tokens in both appearances; in dark only the sky and floor step down. The room is a place, not a panel.

## Typography

**Display Font:** Plus Jakarta Sans (with -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif)
**Body Font:** Plus Jakarta Sans
**Label/Mono Font:** Plus Jakarta Sans with tabular numerals; ui-monospace only where a code value is shown.

**Character:** A rounded, open geometric sans that reads friendly without being childish, chosen to match the user's reference images. Weights 400, 500, 600 and 700 are self-hosted through @fontsource (OFL) because the renderer's CSP blocks remote fonts.

### Hierarchy
- **Display** (700, 38px, line-height 1, tabular): the score numeral inside the evaluation gauge. Timers use the same treatment at 22px.
- **Headline** (700, 24px, 1.2, -0.015em, balanced wrap): page titles. The station brief sets it at 26px and onboarding at 28px inside their hero cards.
- **Title** (700, 16px, 1.3, -0.005em): panel and section titles; finding-card titles at 15px. Station card titles are 17px bold, clamped to two lines.
- **Body** (400, 14.5px, 1.55): default UI and form text. Reading surfaces go slightly larger: speech bubbles 15px/1.5, examiner questions 15.5px semibold, the feedback summary 15.5px/1.65 capped at 75ch.
- **Label** (600, 12.5px, text-2): field and filter labels, stepper steps, card meta. Buttons 13.5px 600 (12.5px small); chips 13px 600; pills 11.5px 600.

### Named Rules
**The One Family Rule.** Plus Jakarta Sans everywhere, bundled locally. Hierarchy comes from size and weight (400 to 700), not from a second family, uppercase or letter-spaced caps.

**The Tabular Figures Rule.** Every score, percentage, time and count uses tabular numerals so figures do not jitter as they change.

## Layout

A fixed three-part shell: a 56px header (logo mark and Clerkroom wordmark, the educational-simulation pill, model status, the Light / Dark / System segmented control), a 224px left sidebar of icon-plus-label items, and a scrolling main area that resets to the top on every route change. The brief and consultation hide the sidebar so the whole window belongs to the station.

Pages are centred columns with 32px side padding, 28px top and 56px bottom, and 24px between blocks: up to 1400px for the station grid, 1024px for Progress, 896px for examiner questions. The station grid is auto-fill with a 250px minimum column and 20px gaps (four up at desktop width, three when narrower). The Stations page has no header block: a filter panel of three labelled chip rows (Specialty, Station type, Level) with the import button at the right, then the grid.

The consultation is a large rounded room on the left (its scene height clamps between 150px and 330px, 128px when the window is under 700px tall) with a task and resources column on the right and the composer below. Older transcript lines fade out under a 56px top mask rather than being cut. Spacing steps are 6, 8, 12, 16, 20, 24 and 32px; panels pad 24px, cards 16px.

## Elevation & Depth

A soft, layered system: surfaces sit on the canvas with a two-layer ambient shadow and a hairline border, and lift only in response to hover or keyboard focus. Tinted inner cards (questions, findings) are flat fills inside a shadowed panel. In dark the same shadows deepen to black at higher opacity; the room carries its own slightly stronger light-scene shadow.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgb(20 28 45 / 0.06), 0 6px 18px -6px rgb(20 28 45 / 0.12)`): panels, station cards, speech bubbles, result cards, the selected segment, icon tiles on question cards.
- **Lift** (`box-shadow: 0 2px 4px rgb(20 28 45 / 0.08), 0 14px 30px -10px rgb(20 28 45 / 0.22)`): a station card on hover or focus-within, paired with a 2px rise.

### Named Rules
**The Soft Lift Rule.** Two shadows only, both diffuse and ambient. Depth answers state (hover, focus); nothing at rest floats higher than a card.

## Shapes

Everything is rounded; nothing is square. Controls and fields use gently curved 10px corners (8px for small buttons), notices and icon tiles 12px, panels, cards, bubbles and tinted sections 16px, and the hero surfaces (brief card, onboarding card, consulting room) 24px. Chips, pills, progress bars, the stepper and the typing dots are fully round. Speech bubbles carry a 14px rotated-square tail pointing down at the speaker (left for you, right for the patient) in the bubble's own fill. Checkboxes are 18px with 5px corners and a 1.5px border; radios are circles.

Illustrations are flat fills inside a 2px round-capped outline in the illustration outline colour, with tube-like vessels drawn as an outline stroke under a fill stroke. Icons are 24px-grid line glyphs at 1.5 stroke with round caps and joins, rendered at 16 to 18px.

## Components

### Buttons
Quiet and friendly: the navy pill decides, the outline follows.
- **Shape:** gently curved (10px), 36px tall, 15px side padding; small 30px tall with 8px corners.
- **Primary:** navy fill and border, white label (light); near-white fill, charcoal label (dark). Hover mixes 14% focus blue into the fill.
- **Secondary:** panel-white fill, firm-line border, navy ink label; hover to the soft well with a darker border.
- **Danger:** outline with fail-red label and a red-tinted border; hover washes 8% red.
- **Icon:** square 36px outline button holding a single line icon (the station card's edit button is 32px).
- **States:** 140ms ease-out colour transitions; disabled at 45% opacity with a not-allowed cursor; focus shows the 2px focus-blue ring.
- **Link:** navy semibold text with a 1.5px focus-blue underline at 3px offset, turning focus blue on hover.

### Chips
- **Style:** full-round, 30px tall, panel-white fill, firm-line border, slate-ink 13px semibold label.
- **State:** selected chips fill navy with white text (inverted in dark); they behave as a radio group under a left-aligned 12.5px label.

### Pills
- **Style:** full-round, 11.5px semibold, 2px by 9px. Mint, butter and rose pairs mark difficulty and results; the neutral pill (soft well, hairline border) carries the educational badge, pass mark and weighting facts. On a tint, a small panel-white pill labels "Best", "Sensitive topic" and "Custom".

### Cards / Containers
- **Panel:** panel white, hairline border, 16px corners, card shadow, 24px padding, optional 16px bold title row.
- **Station card:** the signature. Tint top (illustration centred, time and badges above, the 17px title below), then the lighter band of the same hue with specialty and station type, the difficulty pill, an edit icon button and the small navy "Start station" pill. Hover rises 2px to the lift shadow and scales the illustration to 105%.
- **Question card:** a tint section (16px corners, 16px padding) inside a panel, with a 36px white icon tile, the question at 15.5px semibold and a full-width field.
- **Finding card:** tint section (20px padding) with a 15px title and matching status icon on every line; each rises in with a stagger.

### Inputs / Fields
- **Style:** panel-white fill, firm-line border, 10px corners, 9px by 13px padding, 14.5px text, quiet-ink placeholder.
- **Focus:** border turns focus blue with a 3px 20% focus-blue halo, 140ms.
- **Disabled:** 55% opacity.
- **Choice:** checkbox and radio marks fill navy when checked; the real input stays in the DOM for assistive technology.

### Navigation
- **Sidebar:** icon (18px) plus 14px semibold label, 12px corners; the current item sits on a soft-well pill with a hairline ring and navy ink, others are slate ink turning navy on a soft-well hover.
- **Appearance switch:** a segmented control on the soft well; the selected segment is panel white with the card shadow; labels appear from 1280px, icons always.
- **Stepper:** Reading, Consultation, Examiner questions, Evaluation as round steps joined by 16px rules; current is a navy pill, done carries a check on the soft well, ahead is quiet ink.

### Speech Bubbles and Result Cards
The consultation as a conversation: the doctor's bubbles are panel white on the left, the patient's are butter on the right, both 16px corners with a downward tail, 15px text and a 11.5px speaker-and-time label above. Examination and investigation results appear centred as white result cards with a mint 32px icon tile. A system event is a small centred pill.

### Evaluation Gauge
A 240px semicircle on a zoned track: fail red to 40%, borderline amber to the pass mark, pass green above it, each zone at roughly a quarter opacity. The score arc in the result colour draws from zero once (1400ms, cubic-bezier(0.22, 1, 0.36, 1)) when feedback first arrives; the pass mark is ticked and labelled; the 38px score sits inside and the pass or fail caption rises in after 1200ms. Revisits render without motion.

### Notices
Error notices fill rose, confirmations fill mint, both with a status icon and navy text at 12px corners. The educational-simulation badge is always in the header; the AI-feedback caveat is a soft-well notice; stations with sensitive topics carry a persistent lilac footer with a helpline link.

### Illustration
Station cards use hand-authored flat-outline SVG: organs, capsules and mind motifs. Fills are a fixed friendly palette (coral, soft blue, sage, sun yellow); outlines use the illustration outline token. The ConsultingRoom scene is soft editorial artwork with natural adult proportions, generated locally with FLUX.2 [klein] through the QVAC SDK and bundled as three variants (male, female, other patient): the doctor in a white coat with a stethoscope at a light wooden desk with a laptop on the left, the patient seated facing them on the right, a plain pale-blue wall and a plant. Its top fades into the room sky under a mask, so the bubbles sit on one continuous wall.

## Do's and Don'ts

### Do:
- **Do** set text on any tint, including a station card's lower band, in Navy Ink or Slate Ink only.
- **Do** give each station one tint for its whole card: the full tint on top, a 42% oklab mix with the surface below.
- **Do** keep one navy primary pill per decision region, with outlined secondary buttons beside it.
- **Do** use Plus Jakarta Sans from the bundled @fontsource files, weights 400 to 700, and tabular numerals for every figure.
- **Do** use the 1.5-stroke line icon set, round caps and joins, at 16 to 18px.
- **Do** keep the consulting room light in both appearances and let old transcript lines fade under the top mask.
- **Do** honour reduced motion: the gauge sweep, rise-in and typing dots switch off.
- **Do** keep the educational-simulation badge, the AI-feedback caveat and the sensitive-topic helpline footer visible.

### Don't:
- **Don't** put Quiet Ink (text-3) on a tint; it is for panels and the canvas only.
- **Don't** load fonts or images from a remote origin; the CSP forbids it and the app is offline.
- **Don't** depict means of self-harm in any illustration; sensitive-topic stations use neutral imagery (a mind motif, a sprout).
- **Don't** use tints as text or border colours, or mix two tints on one card.
- **Don't** put a small uppercase or letter-spaced label above a heading; field labels label controls only.
- **Don't** use hard offset or coloured shadows; depth is the two soft ambient shadows.
- **Don't** add a user profile, name greeting or notifications from the references; they are not product truth.
- **Don't** bring back the mark-sheet world: red-ink rules, condensed verdict type or paper textures.
