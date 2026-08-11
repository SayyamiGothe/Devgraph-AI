import type { CSSProperties } from 'react'
import { ConsoleShell } from '../../components/console/ConsoleShell'
import { StatCard } from '../../components/console/StatCard'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'
import { ACTIVITY, INGEST_QUEUE, STATS, WORKSPACES, type IngestStatus } from '../../lib/mock'

const STATUS_TONE: Record<IngestStatus, 'violet' | 'cyan' | 'mint' | 'amber' | 'rose'> = {
  parsing: 'cyan',
  extracting: 'violet',
  linking: 'amber',
  done: 'mint',
  failed: 'rose',
}

export function Overview() {
  const { user } = useAuth()
  const name = user?.email?.split('@')[0] ?? 'there'
  const projects = WORKSPACES.flatMap((workspace) => workspace.projects)

  return (
    <ConsoleShell
      title={`Welcome back, ${name}`}
      subtitle="Here is what your graph has been doing."
    >
      <div className="console__grid">
        {/* ---- Stats ---- */}
        <section className="console__stats">
          {STATS.map((stat, i) => (
            <StatCard stat={stat} index={i} key={stat.label} />
          ))}
        </section>

        {/* ---- Ingest queue ---- */}
        <section className="card card--wide animate-in" style={{ '--delay': '160ms' } as CSSProperties}>
          <header className="card__head">
            <div>
              <h2>Ingest queue</h2>
              <p>Live pipeline stages for documents landing right now.</p>
            </div>
            <Badge tone="mint" dot>
              streaming
            </Badge>
          </header>

          <ul className="queue">
            {INGEST_QUEUE.map((item, i) => (
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
                    <em>
                      {item.project} · {item.pages} pages
                    </em>
                  </span>
                </span>

                <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>

                <span className="queue__track">
                  <span
                    className={`queue__fill is-${item.status}`}
                    style={{ '--fill': `${item.progress * 100}%` } as CSSProperties}
                  />
                </span>

                <span className="queue__pct text-mono">{Math.round(item.progress * 100)}%</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ---- Activity ---- */}
        <section className="card animate-in" style={{ '--delay': '240ms' } as CSSProperties}>
          <header className="card__head">
            <div>
              <h2>Activity</h2>
              <p>Last 24 hours</p>
            </div>
          </header>

          <ol className="activity-feed">
            {ACTIVITY.map((event, i) => (
              <li
                className="activity-feed__item animate-in"
                key={event.id}
                style={{ '--delay': `${300 + i * 80}ms` } as CSSProperties}
              >
                <span className={`activity-feed__dot is-${event.tone}`} aria-hidden="true" />
                <span className="activity-feed__text">
                  <strong>{event.actor}</strong> {event.action} <em>{event.target}</em>
                </span>
                <span className="activity-feed__at text-mono">{event.at}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ---- Projects ---- */}
        <section className="card card--wide animate-in" style={{ '--delay': '320ms' } as CSSProperties}>
          <header className="card__head">
            <div>
              <h2>Active projects</h2>
              <p>Across {WORKSPACES.length} workspaces</p>
            </div>
            <Button variant="subtle" size="sm" to="/app/workspaces">
              View all
            </Button>
          </header>

          <div className="project-grid">
            {projects.slice(0, 4).map((project, i) => (
              <article
                className="project-card animate-in"
                key={project.id}
                style={{ '--delay': `${380 + i * 80}ms` } as CSSProperties}
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
                    <strong className="text-mono">{project.entities.toLocaleString()}</strong> entities
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
          </div>
        </section>
      </div>
    </ConsoleShell>
  )
}
