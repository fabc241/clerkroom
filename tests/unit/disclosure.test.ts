import { describe, expect, it } from 'vitest'
import { askedOrDone, questionUnlocks, unlockSchedule } from '../../src/shared/disclosure'
import { buildPatientSystemPrompt } from '../../src/main/prompts/patientPrompt'
import { toPatientHistory } from '../../src/main/qvac/patientEngine'
import { normalizeForMatch } from '../../src/shared/rubric'
import { loadBundledStations } from './helpers'

const stations = loadBundledStations()
const byId = new Map(stations.map((s) => [s.id, s]))

const GENERIC_OPENERS = [
  "Hello, I'm Dr Rossi, one of the junior doctors. Can I confirm your name and age? What brings you in today?",
  "I'm sorry to hear that, it sounds really difficult. Can you tell me more about it?",
  'How can I help you today?',
  'Thank you for coming in. Is it okay if I ask you some questions?',
  'Is there anything else?',
  'OK, I see. Go on.'
]

describe('progressive disclosure', () => {
  it.each(stations.map((s) => [s.id, s] as const))('%s: generic openers unlock nothing', (_id, s) => {
    for (const q of GENERIC_OPENERS) {
      const unlocked = s.patient.revealOnlyIfAsked.filter((f) => questionUnlocks(q, f)).map((f) => f.topic)
      expect(unlocked, `"${q}"`).toEqual([])
    }
  })

  it.each(stations.map((s) => [s.id, s] as const))('%s: asking about each trigger unlocks that fact', (_id, s) => {
    for (const f of s.patient.revealOnlyIfAsked) {
      expect(questionUnlocks(`Can I ask you about ${f.trigger}?`, f), f.topic).toBe(true)
    }
  })

  it.each([
    ['psych-low-mood', 'Thoughts of death', 'Have you had any thoughts of ending your life?'],
    ['psych-low-mood', 'Sleep', 'How have you been sleeping?'],
    ['psych-suicide-risk-overdose', 'Planning', 'Was this something you had planned?'],
    ['psych-suicide-risk-overdose', 'Precautions against discovery', 'Who found you?'],
    ['psych-suicide-risk-overdose', 'Precautions against discovery', 'Was anyone with you at the time, and how were you found?'],
    ['psych-suicide-risk-overdose', 'Final acts / note', 'Did you leave a note?'],
    ['psych-suicide-risk-overdose', 'Intent and current feelings', 'Did you want to die when you took them?'],
    ['psych-first-episode-psychosis', 'Hearing voices', 'Do you ever hear voices when no one is around?'],
    ['med-chest-pain', 'Radiation', 'Does the pain go anywhere else?'],
    ['med-chest-pain', 'Associated symptoms', 'Have you felt sick or sweaty?'],
    ['med-breathlessness', 'Recent travel', 'Have you been on any long flights recently?'],
    ['med-headache-red-flags', 'Onset speed', 'How quickly did it come on?'],
    ['psych-alcohol-history', 'Quantity', 'How much do you drink in a typical day?']
  ])('%s / %s unlocks on natural phrasing: "%s"', (id, topic, q) => {
    const f = byId.get(id)!.patient.revealOnlyIfAsked.find((x) => x.topic === topic)!
    expect(questionUnlocks(q, f)).toBe(true)
  })

  // Must-pass items tied to these facts can only be credited if the question unlocks them, so a
  // natural way of asking that misses would fail a student who did ask.
  it.each([
    ...[
      'What did you hope would happen when you took the tablets?', 'Did you think the tablets would kill you?',
      'How do you feel now about still being here?', 'Are you having any thoughts of suicide at the moment?',
      'Do you still want to end your life?', 'Are you glad you were found?', 'Do you have any thoughts of doing it again?',
      'Were you trying to kill yourself?', 'Did you mean to end your life?', 'Do you feel like harming yourself now?',
      'How do you feel about having survived?'
    ].map((q) => ['psych-suicide-risk-overdose', 'Intent and current feelings', q]),
    ...['Did it start suddenly or gradually?', 'Was it there all at once?', 'How long did it take to reach its worst?', 'What were you doing when it began?'].map(
      (q) => ['med-headache-red-flags', 'Onset speed', q]
    ),
    ...['Do you ever feel life is not worth living?', 'Have you thought about harming yourself?', 'Do you ever wish you could go to sleep and not wake up?', 'Have you made any plans to take your own life?'].map(
      (q) => ['psych-low-mood', 'Thoughts of death', q]
    ),
    ...['Have the voices ever told you to hurt yourself?', 'Have you had thoughts of harming yourself?', 'Have you thought about ending your life?'].map(
      (q) => ['psych-first-episode-psychosis', 'Risk to self', q]
    ),
    ['psych-first-episode-psychosis', 'Risk to others', 'Do the voices tell you to harm other people?'],
    ['psych-mse-elevated-mood', 'Risk', 'Have you done anything risky lately?'],
    ['psych-mse-elevated-mood', 'Spending', 'Have you been spending a lot of money?'],
    ['psych-panic-anxiety', 'Physical red flags', 'Do you get chest pain when you exercise?'],
    ['psych-alcohol-history', 'When he stops drinking', 'Have you ever had seizures or the DTs?'],
    ['med-breathlessness', 'Recent travel', 'Have you been immobile or bed bound?'],
    ['med-breathlessness', 'Contraception', 'Are you on the pill?'],
    ['med-breathlessness', 'Past and family history', 'Any family history of blood clots?']
  ] as [string, string, string][])('%s / %s (tied to a must-pass item) unlocks on: "%s"', (id, topic, q) => {
    const f = byId.get(id)!.patient.revealOnlyIfAsked.find((x) => x.topic === topic)!
    expect(questionUnlocks(q, f)).toBe(true)
  })

  it('does not count an overdose consultation that never asked about intent as asking about it', () => {
    // The questions from an end-to-end run in which the examiner model credited the intent item.
    const questions = [
      "Hi Alex, my name is Dr Rossi, I'm one of the doctors here. I'd like to talk with you about what happened last night. What we discuss is confidential, unless I'm worried about your safety, in which case I may need to share it with the team. Is that okay?",
      "Thank you. There's no judgement here, lots of people go through really hard times, and it's okay to talk about it. Can you tell me what was happening in the lead up to last night?",
      'That sounds like a lot to cope with. Had you planned taking the tablets, and where did you get them from?',
      'Was anyone with you at the time, and how were you found?',
      'Did you leave a note or any messages for anyone?',
      'Sorry, just to be clear, were you alone, and who found you?',
      'Have you ever harmed yourself or taken an overdose in the past?',
      'How has your mood been lately, and how much alcohol or any drugs have you been using?',
      'Who do you have for support, and what keeps you going?',
      'Are there any more tablets or medicines at home that you could get hold of?',
      'Sorry Alex, I asked whether there are any more tablets or medicines at your flat?',
      "Thank you for being so open with me. I know you'd like to go home today. I'd like one of the mental health team, a psychiatrist, to come and talk with you before any decisions are made, so we can work out the right support together. Does that sound okay, and is there anything worrying you about that?"
    ]
    const st = byId.get('psych-suicide-risk-overdose')!
    const transcript = questions.map((text, at) => ({ kind: 'candidate' as const, text, at }))
    const done = askedOrDone(st, transcript)
    expect(done.has('Intent and current feelings')).toBe(false)
    expect(done.has('Planning')).toBe(true)
  })

  it.each([
    ['comm-starting-ssri', "Hello Priya, I'm Dr Rossi. I understand we're here to talk about the tablet my colleague suggested. Is that right?"],
    ['comm-starting-ssri', "Sertraline isn't addictive. If you stop it suddenly you can feel unwell, so we would come off it slowly."],
    ['med-chest-pain', "I'm going to get my senior now and we'll give you something for the pain."]
  ])('%s: statements unlock nothing: "%s"', (id, msg) => {
    const unlocked = byId.get(id)!.patient.revealOnlyIfAsked.filter((f) => questionUnlocks(msg, f)).map((f) => f.topic)
    expect(unlocked).toEqual([])
  })

  it.each([
    ['comm-starting-ssri', 'Work stigma', 'Tell me about your work.'],
    ['comm-starting-ssri', 'Alcohol', "OK. I'd like to ask about alcohol."],
    ['med-chest-pain', 'Radiation', 'Thanks. Does it spread to your arm.'],
    ['psych-alcohol-history', 'Quantity', 'how much do you drink']
  ])('%s / %s unlocks on a request without a question mark: "%s"', (id, topic, q) => {
    const f = byId.get(id)!.patient.revealOnlyIfAsked.find((x) => x.topic === topic)!
    expect(questionUnlocks(q, f)).toBe(true)
  })

  it('unlocks each fact only once, on the first question that asks', () => {
    const s = byId.get('psych-low-mood')!
    const facts = s.patient.revealOnlyIfAsked
    const schedule = unlockSchedule(['Hello, what brings you in?', 'How is your sleep?', 'And your sleep lately?'], facts)
    expect(schedule[0]).toEqual([])
    expect(schedule[1].map((i) => facts[i].topic)).toEqual(['Sleep'])
    expect(schedule[2]).toEqual([])
  })

  it.each(stations.map((s) => [s.id, s] as const))('%s: system prompt contains no hidden answers', (_id, s) => {
    const prompt = normalizeForMatch(buildPatientSystemPrompt(s))
    for (const f of s.patient.revealOnlyIfAsked) {
      expect(prompt.includes(normalizeForMatch(f.answer)), f.topic).toBe(false)
    }
  })

  it('attaches notes to the question that unlocks a fact, and rebuilds history deterministically', () => {
    const s = byId.get('psych-low-mood')!
    const transcript = [
      { kind: 'candidate' as const, text: 'Hello, what brings you in today?', at: 0 },
      { kind: 'patient' as const, text: 'I feel flat.', at: 1 },
      { kind: 'candidate' as const, text: 'How have you been sleeping?', at: 2 }
    ]
    const h1 = toPatientHistory(s, transcript)
    expect(h1[1].content).toBe('Hello, what brings you in today?')
    expect(h1[3].content).toContain('[Patient note')
    expect(h1[3].content).toContain('4 every morning')
    expect(toPatientHistory(s, transcript)).toEqual(h1)
  })
})
