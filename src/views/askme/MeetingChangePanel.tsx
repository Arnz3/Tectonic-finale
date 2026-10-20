import { useEffect } from 'react'
import { formatDate } from '../../format'
import { currentDocuments } from '../../meetings'
import type { Document } from '../../types'

/** Details of a change that was said in a meeting and verified by a person. */
export function MeetingChangePanel({ doc, onOpenDoc, onClose }: { doc: Document; onOpenDoc: (id: string) => void; onClose: () => void }) {
  const m = doc.meeting!
  const replaced = currentDocuments().find((d) => d.id === m.replaces)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside className="preview-panel meeting-panel" aria-label="Wijziging uit meeting">
      <div className="preview-header">
        <h2>{doc.title}</h2>
        <button className="close" onClick={onClose} aria-label="Sluiten">
          ✕
        </button>
      </div>

      <div className="meeting-change">
        <div className="meeting-change-label">Gewijzigd</div>
        <div className="meeting-change-values">
          <span className="meeting-old">{m.oldValue}</span>
          <span aria-hidden>→</span>
          <span className="meeting-new">{m.newValue}</span>
        </div>
      </div>

      <dl className="preview-meta">
        <dt>Meeting</dt>
        <dd>{m.title}</dd>
        <dt>Datum</dt>
        <dd>{formatDate(m.date)}</dd>
        <dt>Gezegd door</dt>
        <dd>{m.speaker}</dd>
        <dt>Geverifieerd</dt>
        <dd>
          <span className="meeting-verified">✓ {m.verifiedBy}</span> · {formatDate(m.verifiedAt)}
        </dd>
      </dl>

      <h3>Uit het transcript</h3>
      <blockquote className="meeting-quote">
        “{m.line}”<footer>{m.speaker}</footer>
      </blockquote>

      <h3>Nieuwe tekst</h3>
      <div className="preview-text">{doc.text.split('\n\n')[0]}</div>

      {replaced && (
        <>
          <h3>Vervangt</h3>
          <button className="meeting-replaces" onClick={() => onOpenDoc(replaced.id)}>
            <span className="group-dot" style={{ background: 'var(--danger)' }} aria-hidden />
            <span className="group-text">
              <span className="group-name">{replaced.title}</span>
              <span className="group-meta">Daar stond nog {m.oldValue}</span>
            </span>
            <span className="group-chev" aria-hidden>
              ›
            </span>
          </button>
        </>
      )}
    </aside>
  )
}
