// Skill tree: who knows which topic, how well and how recently.
// Built from the expert scores in analysis.json; nothing here is generated or self-reported.
import { analysis } from './analysis'
import { documents } from './library'
import type { Document } from './types'

/** 1 = kent het, 2 = ervaren, 3 = aanspreekpunt. */
export type Level = 1 | 2 | 3

export const LEVEL_LABEL: Record<Level, string> = { 1: 'Kent het', 2: 'Ervaren', 3: 'Aanspreekpunt' }

// Tunable thresholds on the expert score (see analyze.py, M4b).
const EXPERIENCED_SCORE = 1.5
const CONTACT_SCORE = 2
const STALE_DAYS = 365

export interface Skill {
  person: string
  topic: string
  level: Level
  score: number
  inhoud: number
  lastActivity: string
  /** Not active on this topic for more than a year. */
  stale: boolean
  warning: string | null
  reasons: string[]
  /** Documents of this topic the person changed in content, most changes first. */
  evidence: { doc: Document; count: number }[]
}

export interface TopicNode {
  id: string
  title: string
  domain: string
  /** People who know the topic, best first. */
  skills: Skill[]
}

export interface DomainNode {
  id: string
  topics: TopicNode[]
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Payroll BE / Procedures" → "Payroll". Shared folders like Teams say nothing about the domain. */
function domainOf(doc: Document): string | null {
  const first = doc.folder.split('/')[0].trim().replace(/\s+(BE|NL|DE)$/, '')
  return first === 'Teams' || first === 'Klantendienst' ? null : first
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>()
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1))
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'Overig'
}

const latestChange = documents.flatMap((d) => d.history.map((h) => h.date)).sort().at(-1) ?? '1970-01-01'
const daysBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000

function buildTopics(): TopicNode[] {
  const docsByTopic = new Map<string, Document[]>()
  for (const d of documents) docsByTopic.set(d.topic, [...(docsByTopic.get(d.topic) ?? []), d])

  return [...docsByTopic.entries()].map(([topic, docs]) => {
    // A topic can span several clusters; add up a person's scores over them.
    const perPerson = new Map<string, Omit<Skill, 'level' | 'evidence' | 'stale'>>()
    for (const cluster of analysis.clusters.filter((c) => c.topic === topic)) {
      for (const e of cluster.experts) {
        const prev = perPerson.get(e.author)
        const best = !prev || e.score > prev.score
        perPerson.set(e.author, {
          person: e.author,
          topic,
          score: (prev?.score ?? 0) + e.score,
          inhoud: (prev?.inhoud ?? 0) + e.inhoud,
          lastActivity: prev && prev.lastActivity > e.last_activity ? prev.lastActivity : e.last_activity,
          warning: best ? e.warning : prev!.warning,
          reasons: best ? e.reasons : prev!.reasons,
        })
      }
    }

    const ranked = [...perPerson.values()].sort((a, b) => b.score - a.score)
    const skills: Skill[] = ranked.map((s, i) => {
      // Someone who mostly worked on outdated versions stays at "kent het", whatever the score.
      const level: Level = s.warning ? 1 : i === 0 && s.score >= CONTACT_SCORE ? 3 : s.score >= EXPERIENCED_SCORE ? 2 : 1
      const evidence = docs
        .map((doc) => ({ doc, count: doc.history.filter((h) => h.author === s.person && h.change === 'inhoud').length }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count)
      return { ...s, level, evidence, stale: daysBetween(s.lastActivity, latestChange) > STALE_DAYS }
    })

    const domain = mostCommon(docs.flatMap((d) => domainOf(d) ?? []))
    return { id: topic, title: capitalize(topic), domain, skills }
  })
}

export const skillTopics = buildTopics()

export const skillDomains: DomainNode[] = [...new Set(skillTopics.map((t) => t.domain))]
  .sort((a, b) => a.localeCompare(b, 'nl'))
  .map((id) => ({
    id,
    topics: skillTopics.filter((t) => t.domain === id).sort((a, b) => a.title.localeCompare(b.title, 'nl')),
  }))

export const people = [...new Set(skillTopics.flatMap((t) => t.skills.map((s) => s.person)))].sort((a, b) => a.localeCompare(b, 'nl'))

/** How many active people know a topic at least well ("ervaren"). One or none is a risk. */
export function coverage(topic: TopicNode, away: Set<string>): number {
  return topic.skills.filter((s) => s.level >= 2 && !away.has(s.person)).length
}

/** The person to ask about a topic: the best active one, if any knows it well. */
export function contactFor(topicId: string, away: Set<string> = new Set()): Skill | undefined {
  return skillTopics.find((t) => t.id === topicId)?.skills.find((s) => s.level >= 2 && !away.has(s.person))
}

export function skillsOf(person: string): Skill[] {
  return skillTopics.flatMap((t) => t.skills.filter((s) => s.person === person))
}
