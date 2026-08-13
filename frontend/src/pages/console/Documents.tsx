import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ConsoleShell } from '../../components/console/ConsoleShell'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useConsoleData } from '../../context/ConsoleDataContext'
import { readErrorMessage } from '../../hooks/useApi'
import { api, type DocumentRecord } from '../../lib/api'
import { Link, useNumericParam } from '../../router'

/** One in-flight or finished upload. */
interface Upload {
  id: string
  name: string
  size: number
  progress: number
  status: 'uploading' | 'indexing' | 'done' | 'failed'
  error?: string
}

const STATUS_TONE = {
  uploading: 'cyan',
  indexing: 'violet',
  done: 'mint',
  failed: 'rose',
} as const

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : '—'
}

export function Documents() {
  const { loading, error, projects, documentsOf, reloadDocuments, reload } = useConsoleData()
  const projectFromUrl = useNumericParam('project')

  const [projectId, setProjectId] = useState<number | null>(projectFromUrl)
  const [dragging, setDragging] = useState(false)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const fileInput = useRef<HTMLInputElement | null>(null)

  // Default to the project in the URL, else the first one that loads.
  useEffect(() => {
    if (projectId !== null || projects.length === 0) return
    setProjectId(projectFromUrl ?? projects[0].id)
  }, [projectId, projectFromUrl, projects])

  const project = projects.find((item) => item.id === projectId) ?? null
  const documents = useMemo(
    () => (projectId === null ? [] : documentsOf(projectId)),
    [projectId, documentsOf],
  )

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return documents
    return documents.filter((document) => document.name.toLowerCase().includes(needle))
  }, [documents, query])

  const patchUpload = (id: string, patch: Partial<Upload>) => {
    setUploads((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const send = async (files: FileList | File[]) => {
    if (projectId === null) {
      setActionError('Pick a project before uploading.')
      return
    }

    setActionError(null)

    // Sequential: each POST /documents parses, chunks and embeds the file
    // synchronously, so firing them all at once just starves the backend.
    for (const file of Array.from(files)) {
      const id = `${file.name}-${file.size}-${uploads.length}-${Math.random().toString(36).slice(2, 8)}`

      setUploads((current) => [
        { id, name: file.name, size: file.size, progress: 0, status: 'uploading' },
        ...current,
      ])

      try {
        await api.documents.upload(
          { name: file.name, projectId, file },
          {
            onProgress: (fraction) => {
              // Once the bytes are up, the backend is still embedding.
              patchUpload(id, {
                progress: fraction,
                status: fraction >= 1 ? 'indexing' : 'uploading',
              })
            },
          },
        )

        patchUpload(id, { progress: 1, status: 'done' })
        await reloadDocuments(projectId)
      } catch (err) {
        patchUpload(id, {
          status: 'failed',
          error: readErrorMessage(err, 'Upload failed.'),
        })
      }
    }
  }

  const remove = async (document: DocumentRecord) => {
    if (!window.confirm(`Delete “${document.name}”? Its chunks and embeddings go too.`)) return

    setActionError(null)

    try {
      await api.documents.remove(document.id)
      if (projectId !== null) await reloadDocuments(projectId)
    } catch (err) {
      setActionError(readErrorMessage(err, 'Could not delete the document.'))
    }
  }

  return (
    <ConsoleShell title="Documents" subtitle="Everything the pipeline has seen.">
      {(error || actionError) && (
        <div className="alert animate-in">
          <span aria-hidden="true">⚠</span>
          <span>{actionError ?? error}</span>
        </div>
      )}

      {loading && (
        <div className="console__loading animate-in">
          <Spinner size={20} label="Loading documents" />
          <span>Loading projects…</span>
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="empty-state animate-in">
          <span aria-hidden="true">⧉</span>
          <h3>No projects to upload into</h3>
          <p>
            Create a workspace and a project on the <Link to="/app/workspaces">Workspaces</Link>{' '}
            page first.
          </p>
        </div>
      )}

      {projects.length > 0 && (
        <>
          <div className="console__toolbar animate-in">
            <label className="select">
              <span>Project</span>
              <select
                value={projectId ?? ''}
                onChange={(event) => setProjectId(Number(event.target.value))}
              >
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="filter">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                placeholder="Filter documents"
                aria-label="Filter documents"
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Clear filter">
                  ✕
                </button>
              )}
            </div>

            <span className="console__count text-mono">{rows.length} documents</span>
          </div>

          {/* Real upload: POST /documents (multipart) via the axios instance. */}
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
              if (event.dataTransfer.files.length) send(event.dataTransfer.files)
            }}
          >
            <span className="dropzone__icon" aria-hidden="true">
              ⇪
            </span>
            <div>
              <strong>Drop PDFs, DOCX or Markdown here</strong>
              <p>
                Parsed, chunked and embedded on upload into{' '}
                <strong>{project?.name ?? 'the selected project'}</strong>.
              </p>
            </div>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                if (event.target.files?.length) send(event.target.files)
                event.target.value = ''
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              Browse files
            </Button>
          </div>

          {uploads.length > 0 && (
            <section className="card animate-in">
              <header className="card__head">
                <div>
                  <h2>Uploads</h2>
                  <p>Bytes first, then parsing, chunking and embedding on the server.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setUploads([])}>
                  Clear
                </Button>
              </header>

              <ul className="queue">
                {uploads.map((item) => (
                  <li className="queue__row" key={item.id}>
                    <span className="queue__name">
                      <span className="queue__file" aria-hidden="true">
                        ❐
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <em>
                          {(item.size / 1024).toFixed(0)} KB
                          {item.error ? ` · ${item.error}` : ''}
                        </em>
                      </span>
                    </span>

                    <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>

                    <span className="queue__track">
                      <span
                        className={`queue__fill is-${item.status === 'failed' ? 'failed' : item.status === 'done' ? 'done' : 'extracting'}`}
                        style={
                          {
                            '--fill': `${(item.status === 'indexing' ? 1 : item.progress) * 100}%`,
                          } as CSSProperties
                        }
                      />
                    </span>

                    <span className="queue__pct text-mono">
                      {item.status === 'indexing' ? '…' : `${Math.round(item.progress * 100)}%`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="table animate-in" style={{ '--delay': '150ms' } as CSSProperties}>
            <div className="table__head" role="row">
              <span>Document</span>
              <span>Project</span>
              <span>Type</span>
              <span>Stored at</span>
              <span />
            </div>

            {rows.map((item, i) => (
              <div
                className="table__row animate-in"
                role="row"
                key={item.id}
                style={{ '--delay': `${180 + i * 40}ms` } as CSSProperties}
              >
                <span className="table__name">
                  <span className="queue__file" aria-hidden="true">
                    ❐
                  </span>
                  {item.name}
                </span>
                <span className="table__dim">{project?.name ?? `#${item.project_id}`}</span>
                <span className="text-mono">{extensionOf(item.name)}</span>
                <span className="table__dim text-mono">{item.file_path}</span>
                <span className="table__progress">
                  <Button variant="ghost" size="sm" onClick={() => remove(item)}>
                    Delete
                  </Button>
                </span>
              </div>
            ))}

            {rows.length === 0 && (
              <div className="empty-state">
                <span aria-hidden="true">❐</span>
                <h3>{query ? 'No documents match that filter' : 'No documents in this project'}</h3>
                <p>
                  {query
                    ? 'Try a shorter phrase, or clear the filter.'
                    : 'Drop a file above to parse, chunk and embed it.'}
                </p>
              </div>
            )}
          </div>

          <p className="console__note">
            <Button variant="ghost" size="sm" onClick={reload}>
              Refresh
            </Button>
            Ask questions about these files on the{' '}
            <Link to={projectId ? `/app/ask?project=${projectId}` : '/app/ask'}>Ask</Link> page.
          </p>
        </>
      )}
    </ConsoleShell>
  )
}
