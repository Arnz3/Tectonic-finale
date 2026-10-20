// Meeting analysis (demo): a Teams meeting transcript is scanned for facts that contradict the
// most trustworthy source. A person verifies each change before it counts.
// In production the transcript comes from Teams (Graph API) and an LLM extracts the facts;
// here the transcript is fixed and the detection is rule-based, so the demo is deterministic.
import { useSyncExternalStore } from 'react'
import { documents } from './library'
import { contactFor } from './skills'
import type { Document, MeetingChange } from './types'
import { answerFor } from './views/askme/answer'
import { buildTopics, topicForQuestion } from './views/askme/askmeData'

export interface TranscriptLine {
  speaker: string
  time: string
  text: string
}

/** Fictional demo meeting. */
export const DEMO_MEETING = {
  title: 'Teamoverleg Payroll BE',
  lines: [
    { speaker: 'Sofie Claes', time: '10:02', text: 'Goedemorgen allemaal, we overlopen even de payrollpunten voor november.' },
    { speaker: 'Pieter Wouters', time: '10:03', text: 'De eindejaarspremie loopt volgens planning, daar verandert niets aan.' },
    {
      speaker: 'Tom Vermeulen',
      time: '10:05',
      text: 'Nieuws van de sociale partners: de maaltijdcheque gaat vanaf 1 november naar € 12,00 per gewerkte dag.',
    },
    { speaker: 'Sofie Claes', time: '10:06', text: 'Oké, dan moeten we de klanten daar ook over informeren.' },
    { speaker: 'Jens Maes', time: '10:07', text: 'Ik pas de lay-out van de klantennieuwsbrief aan.' },
  ] satisfies TranscriptLine[],
}

const AMOUNT = /€\s?(\d+(?:[.,]\d{1,2})?)/

const toNumber = (s: string) => Number(s.replace(',', '.'))
export const formatAmount = (n: number) => `€ ${n.toFixed(2).replace('.', ',')}`

export interface Signal {
  line: TranscriptLine
  topic: string
  newValue: string
  oldValue: string
  /** The trusted sentence that the meeting contradicts. */
  oldStatement: string
  doc: Document
  /** Who is asked to verify: the contact person for the topic. */
  verifier: string
}

/** Compares an amount said in the meeting with the amount in the most trustworthy source. */
export function detectSignal(line: TranscriptLine): Signal | undefined {
  const said = line.text.match(AMOUNT)
  if (!said) return undefined
  const docs = currentDocuments()
  const topics = buildTopics(docs)
  const topic = topicForQuestion(line.text, topics, docs)
  if (!topic) return undefined
  const answer = answerFor(topic.id, topic, docs)
  const known = answer?.quote.match(AMOUNT)
  if (!answer || !known || toNumber(known[1]) === toNumber(said[1])) return undefined
  return {
    line,
    topic: topic.id,
    newValue: formatAmount(toNumber(said[1])),
    oldValue: formatAmount(toNumber(known[1])),
    oldStatement: answer.quote,
    doc: answer.doc,
    verifier: contactFor(topic.id)?.person ?? answer.doc.owner ?? 'de eigenaar',
  }
}

/** Parses "12", "12,5" or "€ 12,50"; undefined when it is not an amount. */
export function parseAmount(input: string): string | undefined {
  const m = input.trim().match(/^(?:€\s?)?(\d{1,6}(?:[.,]\d{1,2})?)$/)
  return m ? formatAmount(toNumber(m[1])) : undefined
}

/* ---------- verified changes (in memory, shared by all views) ---------- */

let changes: Document[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The person confirmed the change: it becomes a new source that replaces the old document. */
export function verifySignal(signal: Signal, value: string): Document {
  const date = today()
  const statement = signal.oldStatement.replace(AMOUNT, value)
  const meeting: MeetingChange = {
    title: DEMO_MEETING.title,
    date,
    speaker: signal.line.speaker,
    line: signal.line.text,
    oldValue: signal.oldValue,
    newValue: value,
    replaces: signal.doc.id,
    verifiedBy: signal.verifier,
    verifiedAt: date,
  }
  const doc: Document = {
    id: `meeting-${changes.length + 1}`,
    title: `${signal.topic.charAt(0).toUpperCase() + signal.topic.slice(1)}: ${value}`,
    filename: `${DEMO_MEETING.title}.transcript`,
    folder: 'Teams / Meetings',
    country: signal.doc.country,
    topic: signal.topic,
    layer: signal.doc.layer,
    status: 'goedgekeurd',
    owner: signal.verifier,
    created: date,
    modified: date,
    text: `${statement}\n\nGewijzigd in “${DEMO_MEETING.title}” (${signal.line.speaker}, ${signal.line.time}) en geverifieerd door ${signal.verifier}. Vervangt “${signal.doc.title}”.`,
    history: [{ author: signal.verifier, date, change: 'inhoud', summary: `Geverifieerd: ${signal.oldValue} → ${value}` }],
    meeting,
  }
  changes = [...changes.filter((c) => c.meeting!.replaces !== signal.doc.id), doc]
  emit()
  return doc
}

export function resetMeetingChanges() {
  changes = []
  emit()
}

export function currentDocuments(): Document[] {
  return changes.length ? [...documents, ...changes] : documents
}

export function useMeetingChanges(): Document[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => changes,
  )
}
