import { useMemo, useState, type CSSProperties } from 'react'
import { ConsoleShell } from '../../components/console/ConsoleShell'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { WORKSPACES } from '../../lib/mock'

export function Workspaces() {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<number | null>(WORKSPACES[0]?.id ?? null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return WORKSPACES

    return WORKSPACES.map((workspace) => ({
      ...workspace,
      projects: workspace.projects.filter(
        (project) =>
          project.name.toLowerCase().includes(needle) ||
          project.description.toLowerCase().includes(needle),
      ),
    })).filter(
      (workspace) => workspace.projects.length > 0 || workspace.name.toLowerCase().includes(needle),
    )
  }, [query])

  return (
    <ConsoleShell title="Workspaces" subtitle="Organisation → workspaces → projects.">
      <div className="console__toolbar animate-in">
        <div className="filter">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            placeholder="Filter workspaces and projects"
            aria-label="Filter workspaces and projects"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear filter">
              ✕
            </button>
          )}
        </div>

        <Button size="sm" iconLeft={<span aria-hidden="true">＋</span>}>
          New workspace
        </Button>
      </div>

      {filtered.length === 0 && (
        <div className="empty-state animate-in">
          <span aria-hidden="true">⌕</span>
          <h3>Nothing matches “{query}”</h3>
          <p>Try a shorter phrase, or clear the filter.</p>
        </div>
      )}

      <div className="workspace-list">
        {filtered.map((workspace, i) => {
          const open = openId === workspace.id
          const docs = workspace.projects.reduce((sum, project) => sum + project.documents, 0)

          return (
            <section
              className={`workspace animate-in ${open ? 'is-open' : ''}`}
              key={workspace.id}
              style={{ '--delay': `${i * 100}ms` } as CSSProperties}
            >
              <button
                className="workspace__head"
                onClick={() => setOpenId(open ? null : workspace.id)}
                aria-expanded={open}
              >
                <span className="workspace__chevron" aria-hidden="true">
                  ›
                </span>

                <span className="workspace__title">
                  <strong>{workspace.name}</strong>
                  <em>
                    org #{workspace.organisation_id} · {workspace.projects.length} projects ·{' '}
                    {docs.toLocaleString()} documents
                  </em>
                </span>

                <Badge tone="violet">workspace</Badge>
              </button>

              {/* Grid-rows trick: animates open/closed without a fixed height. */}
              <div className="workspace__panel">
                <div className="workspace__panel-inner">
                  {workspace.projects.map((project, j) => (
                    <article
                      className="project-card project-card--row"
                      key={project.id}
                      style={{ '--delay': `${j * 70}ms` } as CSSProperties}
                    >
                      <div className="flex-between">
                        <h3>{project.name}</h3>
                        {project.indexed === 1 ? (
                          <Badge tone="mint">indexed</Badge>
                        ) : (
                          <Badge tone="amber">{Math.round(project.indexed * 100)}%</Badge>
                        )}
                      </div>

                      <p>{project.description}</p>

                      <div className="project-card__meta">
                        <span>
                          <strong className="text-mono">{project.documents.toLocaleString()}</strong> docs
                        </span>
                        <span>
                          <strong className="text-mono">{project.entities.toLocaleString()}</strong>{' '}
                          entities
                        </span>
                        <span className="project-card__updated">{project.updated}</span>
                      </div>

                      <span className="project-card__track">
                        <span
                          className="project-card__fill"
                          style={{ '--fill': `${project.indexed * 100}%` } as CSSProperties}
                        />
                      </span>
                    </article>
                  ))}

                  {workspace.projects.length === 0 && (
                    <p className="workspace__none">No projects match the current filter.</p>
                  )}
                </div>
              </div>
            </section>
          )
        })}
      </div>

      <p className="console__note">
        Workspace and project data is local sample data — the backend exposes auth routes only so
        far. Swap <code>src/lib/mock.ts</code> for real calls once{' '}
        <code>/workspaces</code> and <code>/projects</code> exist.
      </p>
    </ConsoleShell>
  )
}
