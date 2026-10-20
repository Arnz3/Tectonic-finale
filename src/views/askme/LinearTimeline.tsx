import { useMemo, useState } from 'react'
import { contactFor, LEVEL_LABEL, skillTopics, type Level } from '../../skills'
import type { Document } from '../../types'
import { TRUST, type TimelineDoc, type Topic, type Trust } from './askmeData'
import { GroupPopover } from './GroupPopover'

/** One item on the line: a file (square) or a person who can be asked (round). */
type Item =
  | { kind: 'file'; id: string; date: Date; doc: TimelineDoc; source?: Document; copies: number }
  | { kind: 'person'; id: string; date: Date; name: string; level: Level; isContact: boolean; warning: string | null }

const dateFmt = new Intl.DateTimeFormat('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' })
const toDate = (iso: string) => new Date(`${iso}T00:00:00`)

const FILE_TYPE: Record<string, { label: string; color: string; soft: string }> = {
  docx: { label: 'DOCX', color: '#2b579a', soft: '#e8eefb' },
  pdf: { label: 'PDF', color: '#d13438', soft: '#fdecec' },
  xlsx: { label: 'XLSX', color: '#217346', soft: '#e6f4ea' },
  pptx: { label: 'PPTX', color: '#c43e1c', soft: '#fdeee8' },
  txt: { label: 'TXT', color: '#616161', soft: '#f0f0f0' },
  transcript: { label: 'MEETING', color: '#6d5bd0', soft: '#f3f1fd' },
}
const typeOf = (filename = '') => FILE_TYPE[filename.split('.').pop()?.toLowerCase() ?? ''] ?? FILE_TYPE.txt

// Trusted and verified items stand out; older, copied or other-scope items fade back, like history.
const PROMINENT: Trust[] = ['best', 'meeting']

const initials = (name: string) =>
  name
    .split(' ')
    .filter((p) => p[0] === p[0].toUpperCase())
    .map((p) => p[0])
    .join('')
    .slice(0, 2)

function FileGlyph({ type }: { type: { label: string; color: string } }) {
  // A page with a folded corner, tinted per file type.
  return (
    <svg width="34" height="40" viewBox="0 0 34 40" aria-hidden>
      <path d="M3 2h19l9 9v27H3z" fill="#fff" stroke={type.color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M22 2v9h9" fill="none" stroke={type.color} strokeWidth="2" strokeLinejoin="round" />
      <text x="17" y="29" textAnchor="middle" fontSize={type.label.length > 4 ? 6 : 8} fontWeight="700" fill={type.color}>
        {type.label}
      </text>
    </svg>
  )
}

/**
 * A single horizontal timeline without branches: files as square blocks, people who can be asked
 * as round blocks, each on a stem above its date.
 */
export function LinearTimeline({
  topic,
  docs,
  onOpenDoc,
  onShowPerson,
}: {
  topic: Topic
  docs: Document[]
  onOpenDoc: (id: string) => void
  onShowPerson: (name: string) => void
}) {
  const [openGroup, setOpenGroup] = useState<{ id: string; rect: DOMRect } | null>(null)

  const items = useMemo<Item[]>(() => {
    const byId = new Map(docs.map((d) => [d.id, d]))
    // A bundle of copies is one block: its newest member, with the number of copies.
    const leadOf = new Map(Object.values(topic.groups).map((g) => [g.id, g.members[g.members.length - 1]]))
    const files: Item[] = topic.docs
      .filter((d) => !d.group || leadOf.get(d.group) === d.id)
      .map((d) => ({
        kind: 'file' as const,
        id: d.id,
        date: d.date,
        doc: d,
        source: byId.get(d.id),
        copies: d.group ? topic.groups[d.group].members.length - 1 : 0,
      }))
    const contact = contactFor(topic.id)
    const people: Item[] = (skillTopics.find((t) => t.id === topic.id)?.skills ?? []).map((s) => ({
      kind: 'person' as const,
      id: `person:${s.person}`,
      date: toDate(s.lastActivity),
      name: s.person,
      level: s.level,
      isContact: contact?.person === s.person,
      warning: s.warning,
    }))
    return [...files, ...people].sort((a, b) => a.date.getTime() - b.date.getTime() || (a.kind === 'person' ? 1 : -1))
  }, [topic, docs])

  if (items.length === 0) return <div className="empty">Geen documenten in deze categorie.</div>

  return (
    <div className="line-timeline">
      <div className="lt-scroll">
        <ol className="lt-track">
          {items.map((item, i) => {
            const progress = items.length > 1 ? i / (items.length - 1) : 1
            if (item.kind === 'person') {
              return (
                <li key={item.id} className={`lt-item person${item.isContact ? ' prominent' : ''}`} style={{ ['--p' as string]: progress }}>
                  <button
                    className={`lt-person level-${item.level}`}
                    onClick={() => onShowPerson(item.name)}
                    title={`${item.name} · ${LEVEL_LABEL[item.level]}${item.warning ? ` · ${item.warning}` : ''}`}
                  >
                    <span className="lt-avatar">{initials(item.name)}</span>
                    <span className="lt-name">{item.name}</span>
                    <span className="lt-pill person-pill">{item.isContact ? 'Aanspreekpunt' : LEVEL_LABEL[item.level]}</span>
                  </button>
                  <span className="lt-stem" aria-hidden />
                  <span className="lt-dot round" aria-hidden />
                  <time className="lt-date">{dateFmt.format(item.date)}</time>
                </li>
              )
            }
            const d = item.doc
            const type = typeOf(item.source?.filename)
            const prominent = PROMINENT.includes(d.trust)
            const replacement = d.replacedBy ? topic.docs.find((x) => x.id === d.replacedBy) : undefined
            return (
              <li
                key={item.id}
                className={`lt-item file t-${d.trust}${prominent ? ' prominent' : ''}`}
                style={{ ['--p' as string]: progress, ['--trust' as string]: TRUST[d.trust].color }}
              >
                <button
                  className="lt-file"
                  title={d.tooltip.join('\n')}
                  onClick={(e) => {
                    if (item.copies && d.group) setOpenGroup({ id: d.group, rect: e.currentTarget.getBoundingClientRect() })
                    else onOpenDoc(d.id)
                  }}
                >
                  {item.copies > 0 && <span className="lt-badge">+{item.copies}</span>}
                  <FileGlyph type={type} />
                  <span className="lt-title">{d.title}</span>
                  <span className="lt-pill" style={{ color: type.color, background: type.soft }}>
                    {type.label}
                  </span>
                  <span className="lt-status">
                    {item.copies > 0
                      ? `${item.copies + 1} kopieën`
                      : replacement
                        ? `Vervangen door ${replacement.title}`
                        : TRUST[d.trust].label}
                  </span>
                </button>
                <span className="lt-stem" aria-hidden />
                <span className="lt-dot" aria-hidden />
                <time className="lt-date">{dateFmt.format(item.date)}</time>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="askme-legend">
        <span>
          <span className="lt-legend-square" aria-hidden /> Bestand
        </span>
        <span>
          <span className="lt-legend-round" aria-hidden /> Persoon die je kan aanspreken
        </span>
        {(['meeting', 'best', 'similar', 'expired', 'other_scope'] as Trust[])
          .filter((t) => topic.docs.some((d) => d.trust === t))
          .map((t) => (
            <span key={t}>
              <span className="askme-legend-dot" style={{ background: TRUST[t].color }} aria-hidden />
              {TRUST[t].label}
            </span>
          ))}
      </div>

      {openGroup && topic.groups[openGroup.id] && (
        <GroupPopover
          topic={topic}
          groupId={openGroup.id}
          anchor={openGroup.rect}
          onOpenDoc={(id) => {
            setOpenGroup(null)
            onOpenDoc(id)
          }}
          onClose={() => setOpenGroup(null)}
        />
      )}
    </div>
  )
}
