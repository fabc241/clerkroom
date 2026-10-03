<h1 align="center">
  <img src="docs/clerkroom-title.svg" alt="Clerkroom" height="64">
</h1>

<p align="center">
  <img src="docs/clerkroom-demo.gif" width="800"
       alt="Clerkroom demo: picking the chest pain station, asking the AI patient a question by voice, the patient answering, and the marked feedback with a 100% pass">
</p>

**Clerkroom** is a digital simulated patient for clinical education on macOS. Medical students
practise clinical stations by talking to an AI patient, then receive structured, rubric-based
formative feedback. Everything runs locally and offline on the Mac, powered by the
[QVAC SDK](https://github.com/tetherto/qvac) and the **MedPsy-4B** model from the QVAC registry.

> **Educational simulation only. Not a medical device.** Clerkroom does not diagnose, treat or
> advise about real people and must not be used for real patient care. All cases are fictional.
> AI-generated feedback may be inaccurate and is not an examiner's judgement.

## Features

- **12 fictional stations**: psychiatry (low mood, suicide risk after overdose, first-episode
  psychosis, MSE with elevated mood, alcohol history, panic) plus medicine (chest pain,
  breathlessness, abdominal pain, headache) and communication (explaining an SSRI, breaking bad
  news).
- **Station flow**: reading time → timed consultation (default 8 min) → examiner questions →
  feedback.
- **Simulated patient**: persona, ideas/concerns/expectations, and hidden facts revealed only
  when asked (progressive disclosure: the model only learns a fact once the student asks about it). A character guard retries or cleans replies that break role or name the diagnosis.
- **Scripted examination & investigations**: findings come from the station file, never from the
  model.
- **Formative feedback**: checklist marking with evidence quotes verified against the transcript,
  domain scores computed in code (data gathering / clinical management / interpersonal), key-point
  marking of post-station answers, a pass/fail result, and suggestions for what to practise next.
  See [How attempts are marked](#how-attempts-are-marked).
- **Progress** history with export to Markdown/JSON.
- **Station editor**: form and JSON editing, import/export, live validation.
- **Optional voice input**: dictate to the patient and answer the examiner questions by voice.
  Speech is transcribed on the Mac by **Parakeet Unified 0.6B** (`PARAKEET_UNIFIED_0_6B_Q8_0`,
  English, 741 MB) through the QVAC SDK's built-in transcription. The text lands in the text box
  for review and is never sent automatically. Off by default; turn it on under **Model**.
- **Optional spoken replies**: the patient's replies are read aloud on the Mac by **Parler TTS
  mini v1** (`TTS_MINI_V1_EN_PARLER_TTS_Q8_0`, English, 1.16 GB, Metal on Apple Silicon) in the
  voice the station sets in `patient.voice`, one sentence at a time so the first words play within
  a few seconds. The text stays on screen; the audio is played, never saved. Sending your next
  message, stopping the reply or ending the station stops the voice. Off by default; turn it on
  under **Model**.
- **Offline & private**: no accounts, telemetry or remote calls apart from the one-time model
  downloads. Strict CSP, sandboxed renderer, and all permission requests denied except the
  microphone, which is allowed only for the app window while voice input is on. Audio stays in
  memory and is discarded after transcription.
- **Optional app lock**: Clerkroom asks for Touch ID or the Mac's login password when it opens and
  after the Mac sleeps or its screen locks, and saved attempts and user stations are encrypted with
  a key kept in the macOS Keychain (Electron `safeStorage`). The main process answers no data
  request until the user unlocks, so the lock also holds against the renderer. Off by default;
  turning it on or off asks for Touch ID or the password. See [App lock](#app-lock).

## Requirements

- macOS 14 or later. Apple Silicon is strongly recommended (Metal GPU); Intel Macs run on the CPU.
- 8 GB RAM minimum, 16 GB recommended. Use the 1.7B model on 8 GB machines.
- About 3 GB free disk space for the model (stored in `~/.qvac/models`).
- Node.js ≥ 22.17 and npm ≥ 10.9 (to build from source; Node 22 LTS for packaging).
- Xcode Command Line Tools (`xcode-select --install`), to compile the app-lock helper with `swiftc`.

## Getting started

```bash
npm install
npx install-electron   # only if npm skipped Electron's binary download
npm run dev
```

On first launch, accept the educational-use notice, then open **Model** and download MedPsy-4B
(Q4_K_M, 2.7 GB). On later launches the app loads the model automatically.

For voice input, turn on **Voice input** on the same screen and download the Parakeet model
(741 MB). macOS asks for microphone access the first time you press a microphone button.

`npm run dev` uses the QVAC worker generated in `qvac/`. After changing the plugins in
`qvac.config.json`, run `npm run bundle-worker` to regenerate it. Packaging regenerates it
automatically.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run the app with hot reload |
| `npm test` | Unit tests (schema, prompts, character guard, scoring, stores) |
| `npm run typecheck` | Type-check main/preload and renderer |
| `npm run validate-stations` | Validate every bundled station file |
| `npm run eval` | Scripted evaluation of patient role-play and examiner against the real model |
| `npx tsx scripts/smokeModel.ts` | Download/load MedPsy and stream one completion |
| `npx tsx scripts/smokeVoice.ts` | Download/load Parakeet Unified and transcribe a sentence spoken by macOS `say` |
| `npx tsx scripts/smokeSpeech.ts [station-id]` | Download/load Parler TTS mini and speak a station's opening line in its patient voice to `speech.wav` |
| `npm run bundle-worker` | Regenerate the dev QVAC worker in `qvac/` from `qvac.config.json` |
| `npm run build:unlock` | Compile the Touch ID / password helper (`native/unlock.swift`); `dev`, `package` and `make` run it |
| `npm run package` / `npm run make` | Package an arm64 `.app` / build `.zip` and `.dmg` (use Node 22, see below) |

## Packaging

Run packaging with **Node 22 LTS** (`.nvmrc`). Under Node 26, Electron Packager exits silently while
extracting the Electron zip.

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run package
```

The QVAC Forge plugin bundles the Bare worker and prunes unused addons and prebuilds, which gives
an arm64 app of about 510 MB. The model is not bundled; it downloads on first run. ASAR is disabled
(required by QVAC), and universal builds are not supported, so build x64 separately with
`--arch=x64` if needed. After packaging, a Forge hook re-signs the bundle ad hoc (`codesign --sign -`)
so its signature is valid, which the Keychain needs for the app lock. It has no Developer ID
signature: for local use, right-click → Open the first time; code
signing and notarization are needed before distributing it.

## App lock

Turned on under **Settings & about › App lock**. It needs no account and stores no password.

- **Who it asks:** `native/unlock.swift` is a small helper that asks macOS's LocalAuthentication to
  confirm the Mac's owner (Touch ID, or the login password as a fallback). The app only reads its
  exit code. It ships in `Contents/Resources/unlock/`.
- **What it blocks:** while locked, every IPC request except checking and unlocking waits in the
  main process until the user unlocks (`src/main/appLock.ts`, `src/main/ipc.ts`). DevTools are off
  in the packaged app.
- **What it encrypts:** session records and user stations, with Electron `safeStorage` (a key in
  the login Keychain that only Clerkroom can read silently). Settings stay plain so the app knows
  to lock. Encrypted files keep the lock on even if `settings.json` is edited. Exports you save
  are plain files.
- **Limits:** it protects against someone else opening the app or reading its files on your Mac.
  It does not protect against malware running as your user. The app is only signed ad hoc, so each new
  build has a new identity and macOS may ask once for access to the "Clerkroom Safe Storage"
  Keychain item. Allow it, or the encrypted data cannot be read. Signing the app removes this
  prompt.

## Architecture

```
Renderer (React, sandboxed)  ──IPC (contextBridge)──►  Main process (Node)
                                                         ├─ ModelManager   (download / load / unload)
                                                         ├─ PatientEngine  (role-play + character guard)
                                                         ├─ ExaminerEngine (checklist, answers, summary)
                                                         ├─ VoiceManager   (Parakeet speech-to-text)
                                                         ├─ SpeechManager  (Parler text-to-speech)
                                                         ├─ Station/Session/Settings stores (JSON files)
                                                         └─ @qvac/sdk ──► Bare worker (llama.cpp, Metal)
```

- `src/shared/` — zod station schema, constants, IPC and session types, and deterministic scoring.
- `src/main/qvac/` — the QVAC integration. MedPsy is a reasoning model (Qwen3-4B-Thinking base).
  Its reasoning is captured with `captureThinking` and never shown. Sampling follows the model
  card (`temp 0.6, top_p 0.95, top_k 20`), and the context is 8192 tokens.
- Voice input: the renderer records with `MediaRecorder`, decodes and resamples to 16 kHz mono
  s16le (`src/renderer/src/lib/recorder.ts`) and sends the PCM over IPC. `src/main/qvac/transcriber.ts`
  validates it and calls `transcribe()` on Parakeet, which runs on the CPU so it does not compete
  with MedPsy for Metal memory.
- Spoken replies: when a patient reply is final, `src/main/qvac/speaker.ts` splits it into sentences
  and synthesises them one after another with `textToSpeech()` on Parler, sending each as 44.1 kHz
  s16le PCM on `patient:audio`. The renderer queues the parts back to back with Web Audio
  (`src/renderer/src/lib/player.ts`). Parler and MedPsy can share the GPU, but running both at once
  slows each down, so a new message stops the reply that is still being read.
- `src/main/prompts/` — prompt builders. MedPsy's chat template always adds its own "medical
  assistant" persona, so the patient prompt explicitly overrides that identity.
- `stations/` — bundled station JSON files. User stations live in the app's data folder.

## How attempts are marked

The examiner model only judges each checklist item and examiner answer. Everything that decides the
result is calculated in code (`src/shared/rubric.ts`), so the same marks always give the same result.

- **Evidence is required.** A checklist item earns credit ("done" = full, "partly" = half) only if
  the model quotes something the student actually said or did, and the quote is found in the
  transcript. Examiner-answer key points need a quote from the student's written answer. Invented or
  unverifiable credit scores 0.
- **Score** = checklist (weighted by item weight) × 80% + examiner questions × 20%. Each question
  counts equally, by the share of its key points covered. Stations without questions use the
  checklist alone.
- **Result**:
  - **Failed** if the student said and did nothing, if the score is below the **55% pass mark**, or
    if any **must-pass** item (`"critical": true`) is not done.
  - **Passed** otherwise.
  - **Incomplete** if the model's reply could not be read for some items *and* the result depends on
    them. The student can mark the attempt again.
- **Rating** comes from the score: Fail < 40 ≤ Borderline < 55 ≤ Pass < 70 ≤ Good < 85 ≤ Excellent.
  A failed station is never rated above Borderline.

## Writing stations

Stations are JSON files validated by `src/shared/stationSchema.ts`. Tips:

- **Hidden facts use progressive disclosure.** The patient model is not told a hidden fact until
  the student's question contains one of its **ask keywords**, so it cannot volunteer it. Write
  generous ask keywords as word stems (`suicid`, `sleep`) or phrases (`end your life`). Avoid
  generic words that appear in ordinary openers ("hear", "see", "tell", "help"). If you leave ask
  keywords empty, content words from the trigger are used instead.
- Give each hidden fact detection **keywords** taken from its answer, so the eval can tell when it
  was disclosed.
- Run `npm test`: it checks that generic openers unlock nothing and that asking about each trigger
  unlocks its fact.
- Mark safety-critical checklist items `"critical": true` (for example asking about suicidal intent
  in a risk assessment). Missing one fails the station whatever the score, so keep it to one or two
  items per station.
- List the diagnosis and related jargon in `forbiddenTerms`. The patient won't say them until the
  candidate does.
- Keep cases fictional. Never base a station on a real, identifiable person.
- An optional `patient.voice` block sets how the patient sounds when replies are spoken with Parler
  TTS mini, for example `{ "voice": "Jon", "pace": "slow", "pitch": "low", "expressivity": "monotone", "emotion": "sad" }`.
  `voice` is required and must be one of Parler's 34 named speakers (see `PARLER_SPEAKERS` in
  `src/shared/constants.ts`); keeping the same speaker keeps the voice consistent from reply to
  reply. The other fields are optional and use the engine's exact words: `pace` is `slow`,
  `moderate` or `fast`; `pitch` is `low`, `moderate` or `high`; `expressivity` is `monotone`,
  `slightly expressive` or `expressive`; `emotion` is one of Parler's 12 emotions, such as `sad`,
  `fear`, `anger` (not "angry") or `neutral`.

## Licences

- App code: Apache-2.0.
- QVAC SDK: Apache-2.0 (Tether).
- Parakeet Unified speech model: see its QVAC registry entry for licence terms.
- Parler TTS mini v1 speech model: Apache-2.0 (Hugging Face).
- MedPsy model: Apache-2.0 "for research and educational purposes"; its synthetic training data is
  CC-BY-NC 4.0. **Distribute this app free of charge and for non-commercial use only.**
