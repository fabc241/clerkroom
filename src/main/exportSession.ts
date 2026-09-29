import { DOMAIN_LABELS } from '@shared/stationSchema'
import type { SessionRecord } from '@shared/sessionTypes'

const DISCLAIMER =
  '_DigiPat — educational simulation only. Not a medical device; not for diagnosis or real patient care. All cases are fictional. Feedback is AI-generated and may be inaccurate._'

export function sessionToMarkdown(r: SessionRecord): string {
  const out: string[] = [`# ${r.stationTitle}`, '', DISCLAIMER, '', `Date: ${new Date(r.startedAt).toLocaleString()}`, '']
  out.push('## Transcript', '')
  for (const e of r.transcript) {
    if (e.kind === 'candidate') out.push(`**Doctor:** ${e.text}`, '')
    else if (e.kind === 'patient') out.push(`**Patient:** ${e.text}`, '')
    else if (e.kind === 'exam') out.push(`> Examined ${e.system}: ${e.finding}`, '')
    else if (e.kind === 'investigation') out.push(`> Requested ${e.test}: ${e.result}`, '')
    else out.push(`_${e.text}_`, '')
  }
  if (r.postAnswers.length) {
    out.push('## Post-station answers', '')
    for (const a of r.postAnswers) out.push(`**${a.question}**`, '', a.answer || '_(no answer)_', '')
  }
  const fb = r.feedback
  if (fb) {
    out.push('## Feedback (AI-generated, formative)', '')
    out.push(`Global rating: **${fb.globalRating}** · Checklist: **${fb.overallPercent}%**`, '')
    for (const d of fb.domainScores) out.push(`- ${DOMAIN_LABELS[d.domain]}: ${d.percent}%`)
    out.push('', fb.summary, '', '### Checklist', '')
    const mark = { yes: '✅', partial: '🟡', no: '❌' } as const
    for (const i of fb.items) {
      out.push(`- ${mark[i.met]} ${i.text}${i.comment ? ` — ${i.comment}` : ''}`)
      if (i.evidenceQuote && i.evidenceTurn !== null) out.push(`  - "${i.evidenceQuote}"`)
    }
    if (fb.practiseNext.length) {
      out.push('', '### Practise next', '')
      for (const p of fb.practiseNext) out.push(`- ${p}`)
    }
  }
  return out.join('\n') + '\n'
}
