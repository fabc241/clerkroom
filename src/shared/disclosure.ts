import { normalizeForMatch } from './rubric'

/**
 * Progressive disclosure: the simulated patient only learns a hidden fact once the candidate
 * asks about its topic. A fact is unlocked when a candidate message contains one of its ask
 * keywords (single words match as word prefixes, so "suicid" matches "suicidal").
 */

const STOPWORDS = new Set(
  (
    'about above after again against also and any anyone anything are asked because been before being ' +
    'between both but can could does doing down during each else even ever every feel feeling feels few ' +
    'for from further have having her here hers herself him himself his how into its itself just less ' +
    'like may more most much must near need never now off once only other others ought our ours out over ' +
    'own past people perhaps previous same she should since some something such than that the their them ' +
    'themselves then there these they thing things this those though thoughts through under until upon ' +
    'very was were what when where whether which while who whom why will with within without would you ' +
    'your yours yourself current recent recently whether specifically'
  ).split(' ')
)

/** Content words from the author's trigger description, used alongside explicit ask keywords. */
export function deriveTriggerKeywords(trigger: string): string[] {
  return normalizeForMatch(trigger)
    .split(' ')
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
}

/** Authored ask keywords; words derived from the trigger are only a fallback for stations without them. */
export function askKeywordsFor(fact: { trigger: string; askKeywords?: string[] }): string[] {
  return fact.askKeywords?.length ? fact.askKeywords : deriveTriggerKeywords(fact.trigger)
}

export function questionUnlocks(question: string, fact: { trigger: string; askKeywords?: string[] }): boolean {
  const q = ` ${normalizeForMatch(question)} `
  const words = q.trim().split(' ')
  return askKeywordsFor(fact).some((k) => {
    const nk = normalizeForMatch(k)
    if (!nk) return false
    return nk.includes(' ') ? q.includes(` ${nk}`) : words.some((w) => w.startsWith(nk))
  })
}

/**
 * For each candidate message (in order), the indices of hidden facts it newly unlocks.
 * Deterministic, so the chat history can always be rebuilt identically from the transcript.
 */
export function unlockSchedule<F extends { trigger: string; askKeywords?: string[] }>(
  candidateMessages: string[],
  facts: F[]
): number[][] {
  const unlocked = new Set<number>()
  return candidateMessages.map((m) => {
    const now: number[] = []
    facts.forEach((f, i) => {
      if (!unlocked.has(i) && questionUnlocks(m, f)) {
        unlocked.add(i)
        now.push(i)
      }
    })
    return now
  })
}
