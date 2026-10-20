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

/** A change from an earlier meeting that was already verified: one sentence of a document is overruled. */
function seedChange(c: {
  replaces: string
  oldSentence: string
  newSentence: string
  oldValue: string
  newValue: string
  title: string
  meeting: string
  date: string
  speaker: string
  line: string
  verifiedBy: string
}): Document {
  const old = documents.find((d) => d.id === c.replaces)!
  return {
    id: `meeting-seed-${c.replaces}`,
    title: c.title,
    filename: `${c.meeting}.transcript`,
    folder: 'Teams / Meetings',
    country: old.country,
    topic: old.topic,
    layer: old.layer,
    status: 'goedgekeurd',
    owner: c.verifiedBy,
    created: c.date,
    modified: c.date,
    text: `${c.newSentence}\n\nGewijzigd in “${c.meeting}” (${c.speaker}) en geverifieerd door ${c.verifiedBy}. Overschrijft één zin in “${old.title}”: “${c.oldSentence}”`,
    history: [{ author: c.verifiedBy, date: c.date, change: 'inhoud', summary: `Geverifieerd: ${c.oldValue} → ${c.newValue}` }],
    meeting: {
      title: c.meeting,
      date: c.date,
      speaker: c.speaker,
      line: c.line,
      oldValue: c.oldValue,
      newValue: c.newValue,
      replaces: c.replaces,
      verifiedBy: c.verifiedBy,
      verifiedAt: c.date,
    },
  }
}

/** Fictional changes from earlier meetings, so the purple updates are visible without running the demo. */
const SEED_CHANGES: Document[] = [
  seedChange({
    replaces: 'doc-07',
    oldSentence: 'Correcties op de eindejaarspremie moeten uiterlijk op 30 november bij de payrollconsultant binnen zijn.',
    newSentence: 'Correcties op de eindejaarspremie moeten uiterlijk op 25 november bij de payrollconsultant binnen zijn.',
    oldValue: '30 november',
    newValue: '25 november',
    title: 'Eindejaarspremie: deadline 25 november',
    meeting: 'Payroll weekmeeting',
    date: '2026-09-15',
    speaker: 'Sofie Claes',
    line: 'Let op: dit jaar moeten de correcties voor de eindejaarspremie al op 25 november binnen zijn, niet meer op 30 november.',
    verifiedBy: 'Pieter Wouters',
  }),
  seedChange({
    replaces: 'doc-16',
    oldSentence: 'Een voltijdse werknemer met een volledige referteperiode ontvangt ecocheques voor een totaal van € 250 per jaar.',
    newSentence: 'Een voltijdse werknemer met een volledige referteperiode ontvangt ecocheques voor een totaal van € 275 per jaar.',
    oldValue: '€ 250',
    newValue: '€ 275',
    title: 'Ecocheques: € 275 per jaar',
    meeting: 'Sociaal overleg Q3',
    date: '2026-07-08',
    speaker: 'Tom Vermeulen',
    line: 'Het nieuwe sectorakkoord is rond: de ecocheques gaan naar € 275 per jaar voor een voltijdse werknemer.',
    verifiedBy: 'An Peeters',
  }),
  seedChange({
    replaces: 'doc-08',
    oldSentence: 'Deze dagen moeten opgenomen worden vóór 31 maart van het volgende jaar.',
    newSentence: 'Deze dagen moeten opgenomen worden vóór 30 april van het volgende jaar.',
    oldValue: '31 maart',
    newValue: '30 april',
    title: 'Verlof: overdracht tot 30 april',
    meeting: 'HR-teamoverleg',
    date: '2026-05-20',
    speaker: 'Jens Maes',
    line: 'Directie heeft beslist dat overgedragen verlofdagen voortaan tot 30 april opgenomen mogen worden.',
    verifiedBy: 'Sofie Claes',
  }),
]

let changes: Document[] = SEED_CHANGES
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
  changes = SEED_CHANGES
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
