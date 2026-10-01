---
version: 1
slug: "src-renderer-src-app-tsx"
primary_target: "src/renderer/src/App.tsx"
related_targets: ["src/renderer/src/screens"]
---

# Clerkroom app shell (all renderer screens)

Scope: the whole Electron renderer (App shell, Library, Brief, Encounter, Post-station questions, Feedback, Progress, Model, Station editor, About/settings, Onboarding). Mode: Operate.

Audience and job: UK medical student practising OSCE stations alone on a Mac, day and late at night. Goals: exam realism, focus in the consultation, clear pass/fail feedback, motivation to return. Appearance: Light, Dark or System (default System), in settings and as a quick control in the header, persisted.

Pinned by the user (2026-09-30), replacing the earlier mark-sheet world: four reference mock-ups define the style for stations, consultation, examiner questions and evaluation, to be kept across the whole app in light and dark. Stations page: no header block; only the three filters (specialty, station type, level) and the station list below. Not copied from the references because they are not product truth: user profile, name greeting, notifications.

Memorable moment: the evaluation gauge sweeping to the final score, then the result.

Unresolved: illustrations are hand-authored SVG (no image generation in this session); real artwork may replace them.

## Direction contract

THESIS: A friendly, calm clinical-skills studio: every station is an illustrated pastel case card, the consultation happens in an illustrated consulting room with speech bubbles, and feedback reads as a coloured evaluation. Pinned by the user's reference images; refuses the earlier printed mark-sheet world.

OWN-WORLD: Light: cool off-white canvas, white panels with soft shadow and 10-16px radii, navy ink text, pastel tints (sky, mint, butter, rose, peach, lilac, slate) owning card tops and question cards, navy pill primary buttons, difficulty pills in mint / butter / rose. Dark: charcoal shell and panels, the same tints as deep muted fills, light pill primary. Plus Jakarta Sans throughout. Line icons at 1.5 stroke. Friendly flat-outline organ and people illustrations.

STORY: The student filters and picks an illustrated case, reads the brief, talks to the patient in the consulting room, answers colour-coded examiner questions, then sees a gauge with pass or fail and what went well, what to improve and the key learning points, with the full detailed report one click away.

FIRST VIEWPORT: Stations. Header: logo mark and Clerkroom wordmark, safety pill, model status, Light / Dark / System segmented control. Left sidebar with icon + label items, active item on a soft grey pill. Main: a filter row (specialty, station type, level chips; import button at the right), then a 4-up grid (3-up narrower) of pastel case cards: illustration and time on the tint, title, difficulty pill, "Start station" navy pill.

FORM: user-pinned reference world (not rolled); previous seed aa001d44 superseded by the user's brief.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
