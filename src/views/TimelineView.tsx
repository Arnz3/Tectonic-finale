import { useEffect, useMemo, useRef, useState } from 'react'
import { allDocuments } from '../meetings'
import type { Document } from '../types'
import { buildTopics, topicForQuestion, TRUST, type Topic, type Trust } from './askme/askmeData'
import { GroupPopover } from './askme/GroupPopover'
import { MeetingChangePanel } from './askme/MeetingChangePanel'
import { createTimeline, type CardAnchor, type TimelineCallbacks } from './askme/timeline'

const LEGEND: Trust[] = ['meeting', 'best', 'similar', 'expired', 'support', 'other_scope']
const DEFAULT_TOPIC = 'ecocheques'

const topics = buildTopics(allDocuments)
const docById = new Map(allDocuments.map((d) => [d.id, d]))

/** The trust timeline for one topic: pick a topic, or type a question in the search box. */
export function TimelineView({ query, onOpenDoc }: { query: string; onOpenDoc: (doc: Document) => void }) {
  const [picked, setPicked] = useState(() => (topics.some((t) => t.id === DEFAULT_TOPIC) ? DEFAULT_TOPIC : topics[0].id))
  const [change, setChange] = useState<Document | null>(null)
  const asked = useMemo(() => topicForQuestion(query, topics, allDocuments), [query])
  const topic = asked ?? topics.find((t) => t.id === picked)!

  const openDoc = (id: string) => {
    const doc = docById.get(id)
    if (!doc) return
    if (doc.meeting) return setChange(doc)
    setChange(null)
    onOpenDoc(doc)
  }

  return (
    <div className="askme">
      <div className="topic-pills" role="tablist" aria-label="Onderwerp">
        {topics.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === topic.id}
            className={t.id === topic.id ? 'active' : ''}
            onClick={() => setPicked(t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>
      <Timeline key={topic.id} topic={topic} onOpenDoc={openDoc} />
      {change && <MeetingChangePanel doc={change} onOpenDoc={openDoc} onClose={() => setChange(null)} />}
    </div>
  )
}

function Timeline({ topic, onOpenDoc }: { topic: Topic; onOpenDoc: (id: string) => void }) {
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
