import { describe, expect, it } from 'vitest'
import { questionUnlocks, unlockSchedule } from '../../src/shared/disclosure'
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
