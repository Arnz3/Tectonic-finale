import type { AnalysisEdge } from './analysis'

export type FileKind =
  | 'folder'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'pdf'
  | 'image'
  | 'video'
  | 'zip'
  | 'text'

export interface HistoryEntry {
  author: string
  date: string
  change: 'inhoud' | 'opmaak'
  summary: string
}

/** A document from data/documents.json (see CLAUDE.md, section 4). */
export interface Document {
  id: string
  title: string
  filename: string
  folder: string
  country: 'BE' | 'NL' | 'DE'
  topic: string
  layer: 'wet' | 'sector' | 'procedure' | 'klant'
  status: 'goedgekeurd' | 'concept' | 'verouderd'
  owner: string | null
  created: string
  modified: string
  text: string
  history: HistoryEntry[]
  /** Set for a change that was said in a meeting and verified by a person (see src/meetings.ts). */
  meeting?: MeetingChange
}

export interface MeetingChange {
  title: string
  date: string
  speaker: string
  /** The literal line from the transcript. */
  line: string
  oldValue: string
  newValue: string
  /** The literal sentence in the original document, and what it says now. */
  oldSentence: string
  newSentence: string
  /** The document this change replaces. */
  replaces: string
  verifiedBy: string
  verifiedAt: string
}

export interface FileItem {
  id: string
  parentId: string | null
  name: string
  kind: FileKind
  /** bytes, 0 for folders */
  size: number
  modified: string // ISO date
  modifiedBy: string
  /** Set for files backed by a dataset document; undefined for folders. */
  document?: Document
}

export type SortKey = 'name' | 'modified' | 'modifiedBy' | 'size'

export interface SortState {
  key: SortKey
  dir: 'asc' | 'desc'
}

/** Props every view receives. A new view only has to render `items`. */
export interface ViewProps {
  items: FileItem[]
  onOpen: (item: FileItem) => void
  sort: SortState
  onSort: (key: SortKey) => void
  /** Resolves the folder path of an item, handy when showing search results. */
  pathOf: (item: FileItem) => string
  showPath: boolean
  /** Only used by views that show relations between documents. */
  onSelectEdge: (edge: AnalysisEdge) => void
  /** Only used by views that show people; `docIds` are the documents currently shown. */
  onSelectPerson: (author: string, docIds: string[]) => void
  /** The current search query (trimmed), empty when not searching. */
  query: string
  /** Opens a topic in the Inzicht view. */
  onAskTopic: (topic: string) => void
  /** Shows a person in the Mensen view. */
  onShowPerson: (name: string) => void
}
