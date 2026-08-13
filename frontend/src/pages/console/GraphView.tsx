import { useEffect, useState, type CSSProperties } from 'react'
import { ConsoleShell } from '../../components/console/ConsoleShell'
import { KnowledgeGraph } from '../../components/graph/KnowledgeGraph'
import { Badge } from '../../components/ui/Badge'
import { useConsoleData } from '../../context/ConsoleDataContext'
import { readErrorMessage, useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { Link, useNumericParam } from '../../router'

export function GraphView() {
  const { projects, documentsOf } = useConsoleData()
  const projectFromUrl = useNumericParam('project')

  const [projectId, setProjectId] = useState<number | null>(projectFromUrl)
  const [question, setQuestion] = useState('')
  const [probe, setProbe] = useState('')

  useEffect(() => {
    if (projectId !== null || projects.length === 0) return
    setProjectId(projectFromUrl ?? projects[0].id)
  }, [projectId, projectFromUrl, projects])

  const project = projects.find((item) => item.id === projectId) ?? null
  const documents = projectId === null ? [] : documentsOf(projectId)

  // `GET /rag/retrieve` is the closest thing to a graph query the API has: it
  // returns the chunks a question would pull in, so it doubles as a way to see
  // what the index actually holds.
  const chunks = useApi(
    `retrieve:${projectId}:${probe}`,
    (signal) => api.rag.retrieve(probe, projectId as number, signal),
    projectId !== null && probe.trim().length > 0,
  )

  const facets = [
    { label: 'Documents', value: documents.length, tone: 'cyan' as const },
    { label: 'Projects', value: projects.length, tone: 'mint' as const },
    { label: 'Matched chunks', value: chunks.data?.length ?? 0, tone: 'amber' as const },
    {
      label: 'Source documents',
      value: new Set((chunks.data ?? []).map((chunk) => chunk.document_id)).size,
      tone: 'rose' as const,
    },
  ]

  return (
    <ConsoleShell
      title="Graph"
      subtitle={
        project ? `Probe the retrieval index for ${project.name}.` : 'Probe the retrieval index.'
      }
    >
      <div className="console__toolbar animate-in">
        <label className="select">
          <span>Project</span>
          <select
            value={projectId ?? ''}
            onChange={(event) => setProjectId(Number(event.target.value))}
            disabled={projects.length === 0}
          >
            {projects.length === 0 && <option value="">No projects</option>}
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <form
          className="filter"
          onSubmit={(event) => {
            event.preventDefault()
            setProbe(question.trim())
          }}
        >
          <span aria-hidden="true">⌕</span>
          <input
            value={question}
            placeholder="Retrieve chunks for…"
            aria-label="Retrieval probe"
            onChange={(event) => setQuestion(event.target.value)}
          />
          {question && (
            <button
              type="button"
              onClick={() => {
                setQuestion('')
                setProbe('')
              }}
              aria-label="Clear probe"
            >
              ✕
            </button>
          )}
        </form>
      </div>

      <div className="console__facets animate-in">
        {facets.map((facet, i) => (
          <div
            className="facet animate-in"
            key={facet.label}
            style={{ '--delay': `${i * 80}ms` } as CSSProperties}
          >
            <Badge tone={facet.tone}>{facet.label}</Badge>
            <strong className="text-mono">{facet.value.toLocaleString()}</strong>
          </div>
        ))}
      </div>

      {chunks.error && (
        <div className="alert animate-in">
          <span aria-hidden="true">⚠</span>
          <span>{readErrorMessage(chunks.error)}</span>
        </div>
      )}

      {chunks.data && chunks.data.length > 0 && (
        <section className="card animate-in">
          <header className="card__head">
            <div>
              <h2>Retrieved chunks</h2>
              <p>Top matches for “{probe}” from GET /rag/retrieve.</p>
            </div>
          </header>

          <ul className="chunk-list">
            {chunks.data.map((chunk) => (
              <li key={chunk.chunk_id}>
                <span className="chunk-list__meta text-mono">
                  doc #{chunk.document_id} · chunk {chunk.chunk_index}
                </span>
                <p>{chunk.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="animate-in" style={{ '--delay': '160ms' } as CSSProperties}>
        <KnowledgeGraph initial="core" />
      </div>

      <p className="console__note">
        Facets and chunks are live; the node/edge layout itself is still the fixed sample in{' '}
        <code>src/components/graph/KnowledgeGraph.tsx</code> — the backend has no graph endpoint
        yet. Full answers live on the <Link to="/app/ask">Ask</Link> page.
      </p>
    </ConsoleShell>
  )
}
