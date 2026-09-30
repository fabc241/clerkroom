# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Electron desktop app for macOS; the interface is a React + Tailwind renderer in a single window with a
native traffic-light title bar.)

## Users

Medical students practising alone on their own Mac, rehearsing UK-style OSCE stations before exams.
They open a station, read the brief, hold a timed consultation with an AI simulated patient, answer
examiner questions, then study the feedback. Practice happens in short, repeated, self-directed
sessions, often under exam pressure.

## Product Purpose

DigiPat is a digital simulated patient: it lets a student practise a clinical station end to end
without a partner, actor or examiner, and get structured, rubric-based formative feedback with a
clear pass or fail. Success is a student who practises more stations, understands exactly why an
attempt passed or failed, and improves on the next attempt.

## Positioning

Everything runs locally and offline on the student's Mac (QVAC SDK + MedPsy-4B). No accounts, no
telemetry, no cloud. The patient only learns hidden facts once the student asks about them, and the
marking only credits what the student actually said, verified against the transcript, with scores
and the pass/fail result calculated in code.

## Operating Context

- UK OSCE / medical-school context and UK English terminology (e.g. "safety-net", "ICE",
  "warning shot", finals, UKMLA CPSA, MRCPsych CASC).
- Flow: station library → brief with reading time → timed consultation (default 8 min) with
  examination and investigation panels → post-station examiner questions → feedback with transcript
  evidence → progress history.
- Twelve fictional stations across psychiatry, medicine and communication; students can import,
  edit and export stations in a station editor.
- Optional local voice dictation (Parakeet speech-to-text), off by default.
- One-time model download (~2.7 GB) managed from the Model screen.

## Capabilities and Constraints

- Offline and private: strict CSP (`default-src 'self'`), no remote origins, so fonts and assets
  must be bundled locally. Sandboxed renderer; all permission requests denied except microphone
  when voice input is on.
- macOS 14+, Apple Silicon recommended; window uses a draggable title bar with traffic lights at
  the top left.
- Scoring rules: checklist evidence must be quoted from the transcript; final score = checklist
  80% + examiner questions 20%; pass mark 55%; must-pass items fail the station; "incomplete" when
  the AI could not mark parts that change the result.
- Undecided: whether the existing screen flow should change in a redesign (the user did not make it
  binding); light/dark appearance choice is requested as a feature.

## Brand Commitments

- The product name is **DigiPat** (binding).
- No other visual identity is binding; the current teal is not a commitment.

## Evidence on Hand

- Twelve bundled station files in `stations/`.
- No testimonials, users, institutional endorsements or performance claims exist; do not invent any.

## Product Principles

1. Honest by construction: never show credit, results or claims the transcript cannot back.
2. The consultation comes first: during a station nothing should compete with the patient and
   the clock.
3. Private and local: the student's practice never leaves their Mac, and the product should say so
   plainly.
4. Formative, not judgemental: feedback explains what to do next, not just a number.
5. Safety is non-negotiable: DigiPat is an educational simulation, not a medical device.

## Accessibility & Inclusion

- Users may be personally affected by sensitive topics (suicide, self-harm, substances, psychosis,
  bereavement); stations with such topics must keep the helpline notice reachable.
- The "educational simulation only, not a medical device" notice and the AI-feedback caveat are
  safety and licensing requirements and must remain visible (their styling may change).
- Long reading and typing sessions: comfortable text, keyboard-first use, WCAG 2.1 AA contrast in
  both light and dark appearance.
