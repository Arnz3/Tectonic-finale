import { useState } from 'react'
import { Logo } from './components/Logo'
import { PreviewPanel } from './components/PreviewPanel'
import type { Document } from './types'
import { TimelineView } from './views/TimelineView'

const MAX_QUERY_LENGTH = 100

export default function App() {
  const [query, setQuery] = useState('')
  const [doc, setDoc] = useState<Document | null>(null)

  return (
    <div className="app">
      <header className="top-bar">
        <Logo />
        <input
          className="search"
          type="search"
          aria-label="Stel een vraag"
          placeholder="Stel een vraag of kies een onderwerp…"
          maxLength={MAX_QUERY_LENGTH}
          value={query}
          onChange={(e) => setQuery(e.target.value.slice(0, MAX_QUERY_LENGTH))}
        />
      </header>

      <div className="body">
        <main className="content">
          <TimelineView query={query.trim()} onOpenDoc={setDoc} />
        </main>
        {doc && <PreviewPanel doc={doc} onClose={() => setDoc(null)} />}
      </div>
    </div>
  )
}
