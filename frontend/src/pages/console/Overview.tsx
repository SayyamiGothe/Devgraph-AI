import { useMemo, type CSSProperties } from 'react'
import { ConsoleShell } from '../../components/console/ConsoleShell'
import { StatCard, type Stat } from '../../components/console/StatCard'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useAuth } from '../../context/AuthContext'
import { useConsoleData } from '../../context/ConsoleDataContext'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { Link } from '../../router'

export function Overview() {
  const { user } = useAuth()
  const { loading, error, workspaces, projects, documentsOf, totals } = useConsoleData()
  const organisation = useApi('organisation', (signal) => api.organisations.mine(signal))

  const name = user?.email?.split('@')[0] ?? 'there'

  const stats = useMemo<Stat[]>(
    () => [
      {
        label: 'Documents indexed',
        value: totals.documents,
        tone: 'violet',
        foot: 'across every project',
      },
      { label: 'Projects', value: totals.projects, tone: 'cyan', foot: 'in your organisation' },
      { label: 'Workspaces', value: totals.workspaces, tone: 'mint', foot: 'org-scoped' },
      {
        label: 'Empty projects',
        value: projects.filter((project) => documentsOf(project.id).length === 0).length,
        tone: 'amber',
        foot: 'nothing uploaded yet',
      },
    ],
    [totals, projects, documentsOf],
  )

  // Newest documents first — ids are monotonic, so they stand in for a timestamp
  // until the API returns `created_at`.
  const recent = useMemo(() => {
    const byProject = new Map(projects.map((project) => [project.id, project.name]))

    return projects
      .flatMap((project) =>
        documentsOf(project.id).map((document) => ({
          ...document,
          projectName: byProject.get(document.project_id) ?? `#${document.project_id}`,
        })),
      )
      .sort((a, b) => b.id - a.id)
      .slice(0, 6)
  }, [projects, documentsOf])

  const busiest = useMemo(
    () =>
      [...projects]
        .map((project) => ({ project, documents: documentsOf(project.id).length }))
        .sort((a, b) => b.documents - a.documents)
        .slice(0, 4),
    [projects, documentsOf],
  )

  const maxDocuments = Math.max(1, ...busiest.map((item) => item.documents))

  return (
    <ConsoleShell
      title={`Welcome back, ${name}`}
      subtitle={
        organisation.data
          ? `${organisation.data.name} · org #${user?.organisation_id ?? '—'}`
          : 'Here is what your graph has been doing.'
      }
    >
      {error && (
        <div className="alert animate-in">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="console__loading animate-in">
          <Spinner size={20} label="Loading your organisation" />
          <span>Loading your organisation…</span>
        </div>
      )}

      <div className="console__grid">
        {/* ---- Stats ---- */}
        <section className="console__stats">
          {stats.map((stat, i) => (
            <StatCard stat={stat} index={i} key={stat.label} />
          ))}
        </section>

        {/* ---- Recent documents ---- */}
        <section className="card card--wide animate-in" style={{ '--delay': '160ms' } as CSSProperties}>
          <header className="card__head">
            <div>
              <h2>Recently indexed</h2>
              <p>Parsed, chunked and embedded on upload.</p>
            </div>
            <Button variant="subtle" size="sm" to="/app/documents">
              Upload
            </Button>
          </header>

          <ul className="queue">
            {recent.map((item, i) => (
              <li
                className="queue__row animate-in"
                key={item.id}
                style={{ '--delay': `${220 + i * 70}ms` } as CSSProperties}
              >
                <span className="queue__name">
                  <span className="queue__file" aria-hidden="true">
                    ❐
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <em>{item.projectName}</em>
                  </span>
                </span>

                <Badge tone="mint">indexed</Badge>

                <span className="queue__track">
                  <span className="queue__fill is-done" style={{ '--fill': '100%' } as CSSProperties} />
                </span>

                <span className="queue__pct text-mono">100%</span>
              </li>
            ))}
          </ul>

          {!loading && recent.length === 0 && (
            <div className="empty-state">
              <span aria-hidden="true">❐</span>
              <h3>No documents yet</h3>
              <p>
                Upload your first file on the <Link to="/app/documents">Documents</Link> page.
              </p>
            </div>
          )}
        </section>

        {/* ---- Busiest projects ---- */}
        <section className="card animate-in" style={{ '--delay': '240ms' } as CSSProperties}>
          <header className="card__head">
            <div>
              <h2>Where the documents are</h2>
              <p>Top projects by document count</p>
            </div>
          </header>

          <ol className="activity-feed">
            {busiest.map((item, i) => (
              <li
                className="activity-feed__item animate-in"
                key={item.project.id}
                style={{ '--delay': `${300 + i * 80}ms` } as CSSProperties}
              >
                <span className="activity-feed__dot is-violet" aria-hidden="true" />
                <span className="activity-feed__text">
                  <strong>{item.project.name}</strong>{' '}
                  {item.documents === 0 ? 'has nothing uploaded' : 'holds'}{' '}
                  {item.documents > 0 && <em>{item.documents} documents</em>}
                </span>
                <span className="activity-feed__at text-mono">
                  {Math.round((item.documents / maxDocuments) * 100)}%
                </span>
              </li>
            ))}
          </ol>

          {!loading && busiest.length === 0 && (
            <div className="empty-state">
              <span aria-hidden="true">⧉</span>
              <h3>No projects yet</h3>
              <p>
                Start on the <Link to="/app/workspaces">Workspaces</Link> page.
              </p>
            </div>
          )}
        </section>

        {/* ---- Projects ---- */}
        <section className="card card--wide animate-in" style={{ '--delay': '320ms' } as CSSProperties}>
          <header className="card__head">
            <div>
              <h2>Active projects</h2>
              <p>
                Across {workspaces.length} workspace{workspaces.length === 1 ? '' : 's'}
              </p>
            </div>
            <Button variant="subtle" size="sm" to="/app/workspaces">
              View all
            </Button>
          </header>

          <div className="project-grid">
            {projects.slice(0, 4).map((project, i) => {
              const documents = documentsOf(project.id).length

              return (
                <article
                  className="project-card animate-in"
                  key={project.id}
                  style={{ '--delay': `${380 + i * 80}ms` } as CSSProperties}
                >
                  <div className="flex-between">
                    <h3>{project.name}</h3>
                    {documents > 0 ? (
                      <Badge tone="mint">indexed</Badge>
                    ) : (
                      <Badge tone="amber">empty</Badge>
                    )}
                  </div>

                  <p>{project.description ?? 'No description.'}</p>

                  <div className="project-card__meta">
                    <span>
                      <strong className="text-mono">{documents.toLocaleString()}</strong> docs
                    </span>
                    <span>
                      workspace <strong className="text-mono">#{project.workspaces_id}</strong>
                    </span>
                  </div>

                  <span className="project-card__track">
                    <span
                      className="project-card__fill"
                      style={
                        { '--fill': `${(documents / maxDocuments) * 100}%` } as CSSProperties
                      }
                    />
                  </span>
                </article>
              )
            })}
          </div>

          {!loading && projects.length === 0 && (
            <div className="empty-state">
              <span aria-hidden="true">⧉</span>
              <h3>No projects yet</h3>
              <p>Create a workspace, then a project inside it.</p>
            </div>
          )}
        </section>
      </div>
    </ConsoleShell>
  )
}
