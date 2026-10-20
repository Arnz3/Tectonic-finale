import { useEffect } from 'react'
import { analysis } from '../analysis'
import { formatDate } from '../format'
import type { Document } from '../types'
import { PdfPage } from './PdfPage'

const countryLabel: Record<Document['country'], string> = { BE: 'België', NL: 'Nederland', DE: 'Duitsland' }

export function PreviewPanel({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const reasons = analysis.recommended[doc.id]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <aside className="preview-panel" aria-label="Voorbeeld">
      <div className="preview-header">
        <h2>{doc.title}</h2>
        <button className="close" onClick={onClose} aria-label="Sluiten">
          ✕
        </button>
      </div>

      <dl className="preview-meta">
        <dt>Status</dt>
        <dd>
          <span className={`status status-${doc.status}`}>{doc.status}</span>
        </dd>
        <dt>Eigenaar</dt>
        <dd>{doc.owner ?? <span className="warning">Geen eigenaar</span>}</dd>
        <dt>Gewijzigd</dt>
        <dd>{formatDate(doc.modified)}</dd>
        <dt>Land</dt>
        <dd>{countryLabel[doc.country]}</dd>
        <dt>Map</dt>
        <dd>{doc.folder}</dd>
      </dl>

      {reasons && (
        <div className="recommended-box">
          <div className="recommended-title">Waarom betrouwbaar</div>
          <ul>
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <h3>Document</h3>
      <PdfPage doc={doc} />

      <h3>Wijzigingsgeschiedenis</h3>
      <ul className="history">
        {doc.history.map((h, i) => (
          <li key={i}>
            <span className={`change change-${h.change}`}>{h.change}</span>
            <span>
              <strong>{h.author}</strong> · {formatDate(h.date)}
              <br />
              {h.summary}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
