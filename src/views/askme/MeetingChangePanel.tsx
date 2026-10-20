import { useEffect } from 'react'
import { PdfPage } from '../../components/PdfPage'
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
      {original && <PdfPage doc={original} mark={{ sentence: m.oldSentence, node: change }} />}

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
