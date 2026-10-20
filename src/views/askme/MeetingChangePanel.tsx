import { useEffect } from 'react'
import { formatDate } from '../../format'
import { currentDocuments } from '../../meetings'
import type { Document } from '../../types'

/**
 * A change from a meeting, shown inside the original document: the overruled sentence is struck
 * through and the verified sentence from the meeting sits right next to it.
 */
export function MeetingChangePanel({ doc, onOpenDoc, onClose }: { doc: Document; onOpenDoc: (id: string) => void; onClose: () => void }) {
  const m = doc.meeting!
  const original = currentDocuments().find((d) => d.id === m.replaces)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Split the original text around the overruled sentence; all parts are rendered as plain text.
  const text = original?.text ?? ''
  const at = m.oldSentence ? text.indexOf(m.oldSentence) : -1
  const before = at >= 0 ? text.slice(0, at) : ''
  const after = at >= 0 ? text.slice(at + m.oldSentence.length) : text

  const change = (
    <span className="doc-change">
      <del className="doc-del">{m.oldSentence || m.oldValue}</del>{' '}
      <ins className="doc-ins">{m.newSentence || m.newValue}</ins>
      <span className="doc-note">
        Aangepast in {m.title} · {formatDate(m.date)} · ✓ geverifieerd door {m.verifiedBy}
      </span>
    </span>
  )

  return (
    <aside className="preview-panel meeting-panel" aria-label="Wijziging uit meeting">
      <div className="preview-header">
        <h2>{original?.title ?? doc.title}</h2>
        <button className="close" onClick={onClose} aria-label="Sluiten">
          ✕
        </button>
      </div>
      <p className="meeting-panel-sub">Origineel document, met de wijziging uit de meeting erin aangeduid.</p>

      <div className="meeting-change">
        <div className="meeting-change-label">Gewijzigd in {m.title}</div>
        <div className="meeting-change-values">
          <span className="meeting-old">{m.oldValue}</span>
          <span aria-hidden>→</span>
          <span className="meeting-new">{m.newValue}</span>
        </div>
        <blockquote className="meeting-quote">
          “{m.line}”<footer>
            {m.speaker} · {formatDate(m.date)} · ✓ geverifieerd door {m.verifiedBy}
          </footer>
        </blockquote>
      </div>

      <h3>Document</h3>
      <div className="preview-text doc-with-change">
        {at >= 0 ? (
          <>
            {before}
            {change}
            {after}
          </>
        ) : (
          <>
            {change}
            {'\n\n'}
            {after}
          </>
        )}
      </div>

      {original && (
        <button className="meeting-replaces" onClick={() => onOpenDoc(original.id)}>
          <span className="group-dot" style={{ background: 'var(--danger)' }} aria-hidden />
          <span className="group-text">
            <span className="group-name">Open het originele bestand</span>
            <span className="group-meta">
              {original.filename} · {original.owner ?? 'Geen eigenaar'} · {formatDate(original.modified)}
            </span>
          </span>
          <span className="group-chev" aria-hidden>
            ›
          </span>
        </button>
      )}
    </aside>
  )
}
