import { useEffect, useRef, useState } from 'react'
import { DEMO_MEETING, detectSignal, parseAmount, resetMeetingChanges, verifySignal, type Signal } from '../meetings'

const LINE_INTERVAL_MS = 1400

type Step = 'idle' | 'asking' | 'editing' | 'verified' | 'rejected'

/**
 * Demo of the Teams integration: a meeting transcript plays line by line, the analysis spots a
 * changed amount, and the island at the top asks the contact person to verify it.
 */
export function MeetingDemo({ open, onClose, onShowTopic }: { open: boolean; onClose: () => void; onShowTopic: (topic: string) => void }) {
  const [shown, setShown] = useState(0)
  const [signal, setSignal] = useState<Signal | null>(null)
  const [signalLine, setSignalLine] = useState<number | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  // The value the person confirmed; differs from what was said when they edited it.
  const [verifiedValue, setVerifiedValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const lines = DEMO_MEETING.lines

  // Play the transcript while the meeting window is open.
  useEffect(() => {
    if (!open || shown >= lines.length) return
    timer.current = window.setTimeout(() => {
      const line = lines[shown]
      setShown(shown + 1)
      if (!signal) {
        const found = detectSignal(line)
        if (found) {
          setSignal(found)
          setSignalLine(shown)
          setStep('asking')
          setExpanded(true)
        }
      }
    }, shown === 0 ? 500 : LINE_INTERVAL_MS)
    return () => window.clearTimeout(timer.current)
  }, [open, shown, lines, signal])

  // Once answered, the island shrinks back to a pill after a few seconds (calm: out of the way).
  useEffect(() => {
    if (step !== 'verified' && step !== 'rejected') return
    const t = window.setTimeout(() => setExpanded(false), 5000)
    return () => window.clearTimeout(t)
  }, [step])

  function restart() {
    resetMeetingChanges()
    setShown(0)
    setSignal(null)
    setSignalLine(null)
    setStep('idle')
    setExpanded(false)
    setError(null)
  }

  function confirm(value: string) {
    if (!signal) return
    verifySignal(signal, value)
    setVerifiedValue(value)
    setStep('verified')
    setExpanded(true)
  }

  function saveEdit() {
    const value = parseAmount(draft)
    if (!value) return setError('Geef een bedrag in, bijvoorbeeld 12,00.')
    setError(null)
    confirm(value)
  }

  return (
    <>
      {step !== 'idle' && signal && (
        <div className={`island${expanded ? ' expanded' : ''}`} role="status" aria-live="polite">
          {!expanded ? (
            <button className="island-pill" onClick={() => setExpanded(true)}>
              <span className="island-dot" aria-hidden />
              {step === 'asking' || step === 'editing'
                ? '1 wijziging te bevestigen'
                : step === 'verified'
                  ? `Bijgewerkt: ${signal.topic} ${verifiedValue}`
                  : 'Geen wijziging'}
            </button>
          ) : (
            <div className="island-card">
              <div className="island-head">
                <span className="island-brand">
                  <span className="island-dot" aria-hidden /> Graffify · voor {signal.verifier}
                </span>
                <button className="island-min" onClick={() => setExpanded(false)} aria-label="Verkleinen">
                  –
                </button>
              </div>

              {(step === 'asking' || step === 'editing') && (
                <>
                  <div className="island-title">
                    Klopt het dat de {signal.topic.replace(/s$/, '')} nu {signal.newValue} is?
                  </div>
                  <div className="island-sub">
                    In “{signal.doc.title}” staat nog {signal.oldValue}.
                  </div>
                  <blockquote className="island-quote">
                    “{signal.line.text}”
                    <footer>
                      {signal.line.speaker} · {DEMO_MEETING.title} · {signal.line.time}
                    </footer>
                  </blockquote>
                  {step === 'asking' ? (
                    <div className="island-actions">
                      <button className="island-yes" onClick={() => confirm(signal.newValue)}>
                        👍 Klopt
                      </button>
                      <button onClick={() => setStep('rejected')}>✕ Klopt niet</button>
                      <button
                        onClick={() => {
                          setDraft(signal.newValue.replace('€ ', ''))
                          setStep('editing')
                        }}
                      >
                        ✎ Aanpassen
                      </button>
                    </div>
                  ) : (
                    <form
                      className="island-edit"
                      onSubmit={(e) => {
                        e.preventDefault()
                        saveEdit()
                      }}
                    >
                      <label>
                        Juist bedrag
                        <span className="island-input">
                          €
                          <input value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 12))} inputMode="decimal" autoFocus />
                        </span>
                      </label>
                      <button type="submit" className="island-yes">
                        Opslaan
                      </button>
                      <button type="button" onClick={() => setStep('asking')}>
                        Annuleren
                      </button>
                      {error && <div className="island-error">{error}</div>}
                    </form>
                  )}
                </>
              )}

              {step === 'verified' && (
                <>
                  <div className="island-title">✓ Bijgewerkt</div>
                  <div className="island-sub">
                    Er is een nieuwe bron voor {signal.topic}. “{signal.doc.title}” is gemarkeerd als vervangen, met een link naar deze meeting.
                  </div>
                  <div className="island-actions">
                    <button
                      className="island-yes"
                      onClick={() => {
                        setExpanded(false)
                        onShowTopic(signal.topic)
                      }}
                    >
                      Bekijk in Graffify
                    </button>
                  </div>
                </>
              )}

              {step === 'rejected' && (
                <>
                  <div className="island-title">Genoteerd</div>
                  <div className="island-sub">Er verandert niets. {signal.oldValue} blijft de geldende waarde.</div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {open && (
        <section className="meeting-window" aria-label={`Meeting: ${DEMO_MEETING.title}`}>
          <header className="meeting-head">
            <div>
              <div className="meeting-title">{DEMO_MEETING.title}</div>
              <div className="meeting-rec">
                <span className="rec-dot" aria-hidden /> Transcriptie aan · alle deelnemers zijn op de hoogte
              </div>
            </div>
            <button className="meeting-close" onClick={onClose} aria-label="Meeting sluiten">
              ✕
            </button>
          </header>
          <ol className="transcript">
            {lines.slice(0, shown).map((l, i) => (
              <li key={i} className={i === signalLine ? 'flagged' : ''}>
                <span className="transcript-avatar" aria-hidden>
                  {l.speaker
                    .split(' ')
                    .map((p) => p[0])
                    .join('')}
                </span>
                <span className="transcript-body">
                  <span className="transcript-who">
                    {l.speaker} <time>{l.time}</time>
                  </span>
                  <span>{l.text}</span>
                  {i === signalLine && <span className="transcript-flag">Mogelijke wijziging gevonden</span>}
                </span>
              </li>
            ))}
            {shown < lines.length && <li className="transcript-typing">Graffify analyseert het gesprek…</li>}
          </ol>
          <footer className="meeting-foot">
            <span>Demo: vast transcript, fictieve personen</span>
            <button onClick={restart}>Opnieuw afspelen</button>
          </footer>
        </section>
      )}
    </>
  )
}
