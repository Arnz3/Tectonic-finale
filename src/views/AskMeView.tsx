import { useEffect, useMemo, useRef, useState } from 'react'
import { libraryItems } from '../library'
import { useMeetingChanges } from '../meetings'
import { MeetingChangePanel } from './askme/MeetingChangePanel'
import type { Document, ViewProps } from '../types'
import { formatDate } from '../format'
import { contactFor, LEVEL_LABEL } from '../skills'
import { answerFor } from './askme/answer'
import { buildTopics, topicForQuestion, TRUST, type Topic, type Trust } from './askme/askmeData'
import { GroupPopover } from './askme/GroupPopover'
import { createTimeline, type CardAnchor, type TimelineCallbacks } from './askme/timeline'
import { createTopicGraph } from './askme/topicGraph'

const fileById = new Map(libraryItems.filter((f) => f.document).map((f) => [f.id, f]))
const LEGEND: Trust[] = ['meeting', 'best', 'similar', 'expired', 'support', 'other_scope']

/**
 * ASKME: topics of the library as a graph; a topic (clicked, or recognised in a question typed
 * in the search box) opens a timeline that shows which source to trust.
 */
export function AskMeView({ items, onOpen, query }: ViewProps) {
  const changes = useMeetingChanges()
  const docs = useMemo(() => [...items.flatMap((i) => (i.document ? [i.document] : [])), ...changes], [items, changes])
  const [change, setChange] = useState<Document | null>(null)
  const topics = useMemo(() => buildTopics(docs), [docs])
  const asked = useMemo(() => topicForQuestion(query, topics, docs), [query, topics, docs])
  const [picked, setPicked] = useState<string | null>(null)

  // A new question starts from scratch.
  useEffect(() => setPicked(null), [query])

  const topic = asked ?? topics.find((t) => t.id === picked)

  if (docs.length === 0) return <div className="graph-empty">Geen documenten gevonden voor deze zoekopdracht.</div>

  const openDoc = (id: string) => {
    const meetingChange = changes.find((c) => c.id === id)
    if (meetingChange) return setChange(meetingChange)
    setChange(null)
    const file = fileById.get(id)
    if (file) onOpen(file)
  }

  return (
    <div className="askme">
      <div className="askme-bar">
        {topic ? (
          <>
            {!asked && (
              <>
                <button className="askme-back" onClick={() => setPicked(null)}>
                  Alle onderwerpen
                </button>
                <span className="askme-sep">›</span>
              </>
            )}
            <strong>{topic.title}</strong>
            <span className="askme-hint">
              {topic.docs.length} {topic.docs.length === 1 ? 'bron' : 'bronnen'}
            </span>
          </>
        ) : (
          <span className="askme-hint">
            {query ? 'Geen onderwerp herkend in je vraag. Kies hieronder een onderwerp.' : 'Kies een onderwerp of stel een vraag.'}
          </span>
        )}
      </div>

      {topic ? (
        <>
          <AnswerCard question={query} topic={topic} docs={docs} onOpenDoc={openDoc} />
          <AskMeTimeline key={topic.id} topic={topic} onOpenDoc={openDoc} />
        </>
      ) : (
        <AskMeTopics key={topics.map((t) => t.id).join('|')} topics={topics} onOpenTopic={setPicked} />
      )}
      {change && <MeetingChangePanel doc={change} onOpenDoc={openDoc} onClose={() => setChange(null)} />}
    </div>
  )
}

function AskMeTopics({ topics, onOpenTopic }: { topics: Topic[]; onOpenTopic: (id: string) => void }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ onOpenTopic })
  callbacks.current = { onOpenTopic }

  useEffect(() => {
    const graph = createTopicGraph({
      stage: stageRef.current!,
      svgEl: svgRef.current!,
      tip: tipRef.current!,
      centerTitle: 'Alle kennis',
      topics,
      callbacks,
    })
    return () => graph.destroy()
  }, [topics])

  return (
    <div className="askme-stage-wrap">
      <div className="askme-stage" ref={stageRef}>
        <svg ref={svgRef} role="img" aria-label="Onderwerpen in deze bibliotheek" />
        <div className="askme-tip" ref={tipRef} />
      </div>
    </div>
  )
}

function AskMeTimeline({ topic, onOpenDoc }: { topic: Topic; onOpenDoc: (id: string) => void }) {
  // An open bundle of copies is shown as a popover on top of the timeline, so nothing else moves.
  const [openGroup, setOpenGroup] = useState<{ id: string; rect: DOMRect } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const callbacks = useRef<TimelineCallbacks>({ onOpenDoc, onOpenGroup: () => {} })
  callbacks.current = {
    onOpenDoc,
    onOpenGroup: (id: string, a: CardAnchor) => {
      const s = stageRef.current!.getBoundingClientRect()
      setOpenGroup({ id, rect: new DOMRect(s.left + a.left, s.top + a.top, a.width, a.bottom - a.top) })
    },
  }

  useEffect(() => {
    const timeline = createTimeline({ stage: stageRef.current!, svgEl: svgRef.current!, tip: tipRef.current!, callbacks })
    timeline.render(topic, new Date())
    return () => timeline.destroy()
  }, [topic])

  const used = new Set(topic.docs.map((d) => d.trust))
  const replaced = topic.docs.some((d) => d.replacedBy && !d.replacedBy.startsWith('meeting-'))
  const replacedInMeeting = topic.docs.some((d) => d.replacedBy?.startsWith('meeting-'))
  return (
    <div className="askme-stage-wrap">
      <div className="askme-scroll">
        <div className="askme-stage askme-timeline" ref={stageRef}>
          <svg ref={svgRef} role="img" aria-label={`Tijdlijn ${topic.title}`} />
          <div className="askme-tip" ref={tipRef} />
        </div>
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
      <div className="askme-legend">
        {LEGEND.filter((k) => used.has(k)).map((k) => (
          <span key={k}>
            <span className="askme-legend-dot" style={{ background: TRUST[k].color }} aria-hidden />
            {TRUST[k].label}
          </span>
        ))}
        <span>
          <span className="askme-legend-line green" aria-hidden />
          Geldt tot vandaag
        </span>
        {replaced && (
          <span>
            <span className="askme-legend-line red" aria-hidden />
            Vervangen door
          </span>
        )}
        {replacedInMeeting && (
          <span>
            <span className="askme-legend-line purple" aria-hidden />
            Vervangen in meeting
          </span>
        )}
      </div>
    </div>
  )
}

function AnswerCard({ question, topic, docs, onOpenDoc }: { question: string; topic: Topic; docs: Document[]; onOpenDoc: (id: string) => void }) {
  const answer = useMemo(() => answerFor(question, topic, docs), [question, topic, docs])
  if (!answer) {
    return (
      <div className="answer answer-none">
        <div className="answer-label">Geen betrouwbare bron</div>
        <p>Geen enkel document over {topic.title.toLowerCase()} is goedgekeurd en actueel.</p>
      </div>
    )
  }
  const { doc, quote, others } = answer
  const contact = contactFor(topic.id)
  const m = doc.meeting
  const replaced = m ? docs.find((d) => d.id === m.replaces) : undefined
  return (
    <div className={`answer${m ? ' answer-meeting' : ''}`}>
      <div className="answer-label">
        <span className="answer-dot" aria-hidden /> {m ? 'Gewijzigd in een meeting · geverifieerd' : 'Betrouwbaarste bron'}
      </div>
      {quote && <blockquote className="answer-quote">{quote}</blockquote>}
      {m ? (
        <div className="answer-meta">
          <button className="answer-doc" onClick={() => onOpenDoc(doc.id)}>
            {m.title}
          </button>
          <span>{formatDate(m.date)}</span>
          <span>Geverifieerd door {m.verifiedBy}</span>
          {replaced && (
            <span>
              Was {m.oldValue} in “{replaced.title}”
            </span>
          )}
        </div>
      ) : (
        <div className="answer-meta">
          <button className="answer-doc" onClick={() => onOpenDoc(doc.id)}>
            {doc.title}
          </button>
          <span>{doc.owner ?? 'Geen eigenaar'}</span>
          <span>Bijgewerkt {formatDate(doc.modified)}</span>
        </div>
      )}
      {contact && (
        <div className="answer-contact">
          Vraag het aan <strong>{contact.person}</strong>
          <span className="sk-dots">{[1, 2, 3].map((i) => (i <= contact.level ? '●' : '○')).join('')}</span>
          <span>{LEVEL_LABEL[contact.level]}</span>
        </div>
      )}
      {others > 0 && (
        <div className="answer-warning">
          {others} {others === 1 ? 'andere versie is' : 'andere versies zijn'} verouderd of een kopie. Die zie je hieronder op de tijdlijn.
        </div>
      )}
    </div>
  )
}
