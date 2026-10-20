import { analysis } from '../../analysis'
import type { Document } from '../../types'
import type { Topic } from './askmeData'

export interface Answer {
  doc: Document
  /** A literal sentence from the document; never generated. Empty when nothing matches. */
  quote: string
  /** Other documents in the same scope that are outdated or copies. */
  others: number
}

const STOP = new Set(['hoeveel', 'wanneer', 'welke', 'wordt', 'worden', 'moet', 'mijn', 'onze', 'deze', 'voor', 'over', 'zijn', 'hebben'])
const ASKS_FOR_VALUE = /\b(hoeveel|wanneer|hoelang|hoe lang|welk|welke|termijn|bedrag)/
// An amount, a percentage or a period; a bare year does not count.
const HAS_VALUE = /€|\d+[,.]\d+|\d+\s?(%|euro|dagen|dag|weken|week|maanden|maand|jaar)\b/i

// A rough stem: the first six letters, so "maaltijdcheques" matches "maaltijdcheque".
const stems = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
    .map((w) => w.slice(0, 6))

function sentences(text: string, title: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 260 && !s.startsWith(title))
}

/**
 * The most trustworthy document of a topic, and the sentence in it that best answers the question.
 * The sentence is quoted literally, so the answer is always traceable to its source.
 */
export function answerFor(question: string, topic: Topic, docs: Document[]): Answer | undefined {
  const byId = new Map(docs.map((d) => [d.id, d]))
  const best = topic.docs
    .filter((d) => d.trust === 'best' || d.trust === 'meeting')
    .sort(
      (a, b) =>
        // A change verified in a meeting is the newest confirmed knowledge.
        Number(b.trust === 'meeting') - Number(a.trust === 'meeting') ||
        // A client agreement only holds for that client, so it is not the general answer.
        Number(a.lane === 'client') - Number(b.lane === 'client') ||
        Number(b.id in analysis.recommended) - Number(a.id in analysis.recommended) ||
        Number(b.lane === 'procedure') - Number(a.lane === 'procedure') ||
        b.date.getTime() - a.date.getTime(),
    )[0]
  const doc = best && byId.get(best.id)
  if (!doc) return undefined

  const q = question || topic.id
  const wanted = new Set(stems(q))
  // A bare topic ("maaltijdcheques") most likely asks for the key figure.
  const wantsValue = ASKS_FOR_VALUE.test(q.toLowerCase()) || q.trim().split(/\s+/).length <= 2
  let quote = ''
  let top = 0
  for (const s of sentences(doc.text, doc.title)) {
    const words = new Set(stems(s))
    let score = [...wanted].filter((w) => words.has(w)).length
    if (wantsValue && HAS_VALUE.test(s)) score += 1.5
    if (score > top) {
      top = score
      quote = s
    }
  }

  const others = topic.docs.filter((d) => d.trust === 'expired' || d.trust === 'similar').length
  return { doc, quote, others }
}
