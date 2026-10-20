import * as d3 from 'd3'
import { useMemo, useState } from 'react'
import { formatDate } from '../format'
import { coverage, LEVEL_LABEL, people, skillDomains, skillsOf, type Level, type Skill, type TopicNode } from '../skills'
import type { ViewProps } from '../types'

type TreeDatum =
  | { kind: 'root'; label: string; children: TreeDatum[] }
  | { kind: 'domain'; label: string; children: TreeDatum[] }
  | { kind: 'topic'; label: string; topic: TopicNode; skill?: Skill; children?: TreeDatum[] }
  | { kind: 'person'; label: string; skill: Skill }

const ROW = 34
const COL = [0, 150, 330, 540]
const PAD = { top: 24, left: 24, right: 300, bottom: 24 }

function Dots({ level }: { level: Level }) {
  return (
    <tspan className="sk-dots">
      {[1, 2, 3].map((i) => (i <= level ? '●' : '○')).join('')}
    </tspan>
  )
}

/**
 * Skill tree ("Mensen"): who knows which topic. Team view shows coverage per topic,
 * person view shows one person's knowledge with the evidence behind it.
 */
export function SkillsView({ query, onAskTopic }: ViewProps) {
  const [person, setPerson] = useState<string | null>(null)
  // Demo of a role change: people marked as away no longer count as a contact.
  const [away, setAway] = useState<Set<string>>(new Set())
  const q = query.trim().toLowerCase()

  const data = useMemo<TreeDatum>(() => {
    if (person) {
      const mine = skillsOf(person)
      return {
        kind: 'root',
        label: person,
        children: skillDomains
          .map((d) => ({
            kind: 'domain' as const,
            label: d.id,
            children: d.topics.flatMap((t) => {
              const skill = mine.find((s) => s.topic === t.id)
              return skill ? [{ kind: 'topic' as const, label: t.title, topic: t, skill }] : []
            }),
          }))
          .filter((d) => d.children.length > 0),
      }
    }
    // A search narrows the team tree to matching topics or people.
    const keep = (t: TopicNode) => !q || t.title.toLowerCase().includes(q) || t.skills.some((s) => s.person.toLowerCase().includes(q))
    return {
      kind: 'root',
      label: 'Organisatie',
      children: skillDomains
        .map((d) => ({
          kind: 'domain' as const,
          label: d.id,
          children: d.topics.filter(keep).map((t) => ({
            kind: 'topic' as const,
            label: t.title,
            topic: t,
            children: t.skills.map((s) => ({ kind: 'person' as const, label: s.person, skill: s })),
          })),
        }))
        .filter((d) => d.children.length > 0),
    }
  }, [person, q])

  const layout = useMemo(() => {
    const root = d3.hierarchy<TreeDatum>(data, (d) => ('children' in d ? d.children : undefined))
    d3.tree<TreeDatum>().nodeSize([ROW, 1]).separation((a, b) => (a.parent === b.parent ? 1 : 1.4))(root)
    const nodes = root.descendants()
    const minX = Math.min(...nodes.map((n) => n.x!))
    const maxX = Math.max(...nodes.map((n) => n.x!))
    const pos = (n: d3.HierarchyNode<TreeDatum>) => ({ x: PAD.left + COL[n.depth], y: PAD.top + n.x! - minX })
    return {
      nodes: nodes.map((n) => ({ n, ...pos(n) })),
      links: root.links().map((l) => ({ id: `${l.source.data.label}>${l.target.data.label}`, s: pos(l.source), t: pos(l.target) })),
      // Leaves carry the longest labels: people with a warning in the team view, topics in the person view.
      width: PAD.left + COL[root.height] + (person ? 240 : PAD.right),
      height: PAD.top + maxX - minX + PAD.bottom,
    }
  }, [data, person])

  const link = d3
    .linkHorizontal<{ s: { x: number; y: number }; t: { x: number; y: number } }, { x: number; y: number }>()
    .source((d) => d.s)
    .target((d) => d.t)
    .x((p) => p.x)
    .y((p) => p.y)

  const toggleAway = (name: string) =>
    setAway((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  return (
    <div className="skills">
      <div className="skills-bar">
        <div className="segmented-pill" role="tablist" aria-label="Weergave van de kenniskaart">
          <button role="tab" aria-selected={!person} className={!person ? 'active' : ''} onClick={() => setPerson(null)}>
            Team
          </button>
          <button role="tab" aria-selected={!!person} className={person ? 'active' : ''} onClick={() => setPerson(person ?? people[0])}>
            Persoon
          </button>
        </div>
        {person && (
          <select className="skills-select" value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Kies een persoon">
            {people.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        )}
        <div className="spacer" />
        <div className="skills-legend">
          {([1, 2, 3] as Level[]).map((l) => (
            <span key={l}>
              <span className="sk-dots">{[1, 2, 3].map((i) => (i <= l ? '●' : '○')).join('')}</span> {LEVEL_LABEL[l]}
            </span>
          ))}
          {!person && (
            <>
              <span>
                <span className="cov-dot ok" /> 2+ ervaren
              </span>
              <span>
                <span className="cov-dot one" /> 1 persoon
              </span>
              <span>
                <span className="cov-dot none" /> niemand
              </span>
            </>
          )}
        </div>
      </div>

      <div className={`skills-body${person ? ' with-side' : ''}`}>
        {/* Remount per tree, so a new tree starts scrolled to the left. */}
        <div className="skills-stage" key={person ?? 'team'}>
          {layout.nodes.length <= 1 ? (
            <div className="empty">Geen onderwerpen of mensen gevonden voor deze zoekopdracht.</div>
          ) : (
            <svg width={layout.width} height={layout.height} role="img" aria-label="Kenniskaart">
              {layout.links.map((l) => (
                <path key={l.id} className="sk-link" d={link(l) ?? ''} />
              ))}
              {layout.nodes.map(({ n, x, y }) => {
                const d = n.data
                const key = n.ancestors().map((a) => a.data.label).join('>')
                if (d.kind === 'root') {
                  const w = 14 + d.label.length * 7.6
                  return (
                    <g key={key} transform={`translate(${x},${y})`}>
                      <rect className="sk-root" x={-6} y={-14} width={w} height={28} rx={14} />
                      <text className="sk-root-t" x={8} dy="0.35em">
                        {d.label}
                      </text>
                    </g>
                  )
                }
                if (d.kind === 'domain') {
                  return (
                    <text key={key} className="sk-domain" x={x + 8} y={y} dy="0.35em">
                      {d.label}
                    </text>
                  )
                }
                if (d.kind === 'topic') {
                  const n2 = coverage(d.topic, away)
                  const cls = n2 >= 2 ? 'ok' : n2 === 1 ? 'one' : 'none'
                  return (
                    <g
                      key={key}
                      className="sk-topic"
                      transform={`translate(${x},${y})`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${d.label}: open in Inzicht`}
                      onClick={() => onAskTopic(d.topic.id)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onAskTopic(d.topic.id)}
                    >
                      <circle className={`cov-mark ${person ? 'plain' : cls}`} r={5} />
                      <text className="sk-topic-t" x={12} dy="0.35em">
                        {d.label}
                        {d.skill ? (
                          <>
                            {'  '}
                            <Dots level={d.skill.level} />
                            <tspan className="sk-sub"> {LEVEL_LABEL[d.skill.level]}</tspan>
                            {d.skill.stale && <tspan className="sk-warn"> · niet recent</tspan>}
                          </>
                        ) : (
                          <tspan className={`sk-sub cov-${cls}`}> {n2 === 0 ? 'niemand ervaren' : n2 === 1 ? '1 ervaren' : `${n2} ervaren`}</tspan>
                        )}
                      </text>
                    </g>
                  )
                }
                const s = d.skill
                const isAway = away.has(s.person)
                return (
                  <g
                    key={key}
                    className={`sk-person${isAway ? ' away' : ''}`}
                    transform={`translate(${x},${y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${s.person}, ${LEVEL_LABEL[s.level]}. Open de kenniskaart van deze persoon.`}
                    onClick={() => setPerson(s.person)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setPerson(s.person)}
                  >
                    <circle className="sk-person-dot" r={3} />
                    <text x={10} dy="0.35em">
                      <tspan className="sk-person-t">{s.person}</tspan> <Dots level={s.level} />
                      {isAway && <tspan className="sk-warn"> · afwezig</tspan>}
                      {!isAway && s.warning && <tspan className="sk-warn"> · ⚠ vooral oude versies</tspan>}
                      {!isAway && !s.warning && s.stale && <tspan className="sk-sub"> · niet recent</tspan>}
                    </text>
                  </g>
                )
              })}
            </svg>
          )}
        </div>

        {person && <PersonSide person={person} away={away.has(person)} onToggleAway={() => toggleAway(person)} />}
      </div>

      <p className="skills-note">
        Een kenniskaart, geen beoordeling: ze toont wie je iets kan vragen, op basis van inhoudelijke bijdragen aan documenten. Niet
        gebruikt voor evaluaties.
      </p>
    </div>
  )
}

function PersonSide({ person, away, onToggleAway }: { person: string; away: boolean; onToggleAway: () => void }) {
  const mine = skillsOf(person).sort((a, b) => b.level - a.level || b.score - a.score)
  const contactFor = mine.filter((s) => s.level === 3)
  return (
    <aside className="skills-side" aria-label={`Kennis van ${person}`}>
      <h3>{person}</h3>
      <p className="skills-side-sub">
        {contactFor.length > 0
          ? `Aanspreekpunt voor ${contactFor.map((s) => s.topic).join(', ')}`
          : `Kent ${mine.length} ${mine.length === 1 ? 'onderwerp' : 'onderwerpen'}`}
      </p>

      <h4>Waarop dit gebaseerd is</h4>
      <ul className="skills-evidence">
        {mine.map((s) => (
          <li key={s.topic}>
            <div className="skills-evidence-head">
              <strong>{s.topic.charAt(0).toUpperCase() + s.topic.slice(1)}</strong>
              <span className="sk-dots">{[1, 2, 3].map((i) => (i <= s.level ? '●' : '○')).join('')}</span>
            </div>
            <div className="skills-last">
              {LEVEL_LABEL[s.level]} · laatst actief {formatDate(s.lastActivity)}
              {s.stale && ' · niet recent'}
            </div>
            {s.warning && <div className="skills-warn">{s.warning}</div>}
            <ul>
              {s.evidence.slice(0, 3).map((e) => (
                <li key={e.doc.id}>
                  {e.count}× inhoud · {e.doc.title}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <button className={`skills-away${away ? ' active' : ''}`} onClick={onToggleAway} aria-pressed={away}>
        {away ? 'Terug actief zetten' : 'Simuleer rolwissel of vertrek'}
      </button>
      <p className="skills-side-note">Demo: zie in de teamweergave welke onderwerpen dan zonder ervaren aanspreekpunt vallen.</p>
    </aside>
  )
}
