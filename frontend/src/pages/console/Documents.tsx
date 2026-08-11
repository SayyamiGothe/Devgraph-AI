import { useMemo, useState, type CSSProperties } from 'react'
import { ConsoleShell } from '../../components/console/ConsoleShell'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { INGEST_QUEUE, type IngestStatus } from '../../lib/mock'

const FILTERS: Array<{ key: 'all' | IngestStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'parsing', label: 'Parsing' },
  { key: 'extracting', label: 'Extracting' },
  { key: 'linking', label: 'Linking' },
  { key: 'done', label: 'Indexed' },
  { key: 'failed', label: 'Failed' },
]

const STATUS_TONE: Record<IngestStatus, 'violet' | 'cyan' | 'mint' | 'amber' | 'rose'> = {
  parsing: 'cyan',
  extracting: 'violet',
  linking: 'amber',
  done: 'mint',
  failed: 'rose',
}

export function Documents() {
  const [filter, setFilter] = useState<'all' | IngestStatus>('all')
  const [dragging, setDragging] = useState(false)

  const rows = useMemo(
    () => (filter === 'all' ? INGEST_QUEUE : INGEST_QUEUE.filter((item) => item.status === filter)),
    [filter],
  )

  return (
    <ConsoleShell title="Documents" subtitle="Everything the pipeline has seen.">
      {/* Drop zone — visual only; there is no upload endpoint yet. */}
      <div
        className={`dropzone animate-in ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
        }}
      >
        <span className="dropzone__icon" aria-hidden="true">
          ⇪
        </span>
        <div>
          <strong>Drop PDFs, DOCX or Markdown here</strong>
          <p>Layout-aware parsing keeps tables and footnotes intact. Up to 2 GB per batch.</p>
        </div>
        <Button variant="outline" size="sm">
          Browse files
        </Button>
      </div>

      <div className="console__toolbar animate-in" style={{ '--delay': '90ms' } as CSSProperties}>
        <div className="tabs" role="tablist" aria-label="Filter by status">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={filter === item.key}
              className={`tabs__tab ${filter === item.key ? 'is-on' : ''}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
              {/* Underline slides via a scaling pseudo element per tab. */}
              <span className="tabs__ink" aria-hidden="true" />
            </button>
          ))}
        </div>

        <span className="console__count text-mono">{rows.length} documents</span>
      </div>

      <div className="table animate-in" style={{ '--delay': '150ms' } as CSSProperties}>
        <div className="table__head" role="row">
          <span>Document</span>
          <span>Project</span>
          <span>Pages</span>
          <span>Status</span>
          <span>Progress</span>
        </div>

        {rows.map((item, i) => (
          <div
            className="table__row animate-in"
            role="row"
            key={item.id}
            style={{ '--delay': `${180 + i * 60}ms` } as CSSProperties}
          >
            <span className="table__name">
              <span className="queue__file" aria-hidden="true">
                ❐
              </span>
              {item.name}
            </span>
            <span className="table__dim">{item.project}</span>
            <span className="text-mono">{item.pages}</span>
            <span>
              <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
            </span>
            <span className="table__progress">
              <span className="queue__track">
                <span
                  className={`queue__fill is-${item.status}`}
                  style={{ '--fill': `${item.progress * 100}%` } as CSSProperties}
                />
              </span>
              <em className="text-mono">{Math.round(item.progress * 100)}%</em>
            </span>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="empty-state">
            <span aria-hidden="true">❐</span>
            <h3>No documents in this state</h3>
            <p>Pick another filter to see the rest of the queue.</p>
          </div>
        )}
      </div>
    </ConsoleShell>
  )
}
