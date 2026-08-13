import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { ConsoleShell } from '../../components/console/ConsoleShell'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useConsoleData } from '../../context/ConsoleDataContext'
import { readErrorMessage } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { Link } from '../../router'

export function Workspaces() {
  const { loading, error, workspaces, projectsOf, documentsOf, reload } = useConsoleData()

  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)

  // Create-workspace form
  const [creating, setCreating] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Create-project form, keyed by the workspace it belongs to
  const [projectFor, setProjectFor] = useState<number | null>(null)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')

  const tree = useMemo(
    () =>
      workspaces.map((workspace) => {
        const projects = projectsOf(workspace.id)
        return {
          workspace,
          projects,
          documents: projects.reduce((sum, project) => sum + documentsOf(project.id).length, 0),
        }
      }),
    [workspaces, projectsOf, documentsOf],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return tree

    return tree
      .map((node) => ({
        ...node,
        projects: node.projects.filter(
          (project) =>
            project.name.toLowerCase().includes(needle) ||
            (project.description ?? '').toLowerCase().includes(needle),
        ),
      }))
      .filter(
        (node) =>
          node.projects.length > 0 || node.workspace.name.toLowerCase().includes(needle),
      )
  }, [tree, query])

  const submitWorkspace = async (event: FormEvent) => {
    event.preventDefault()
    const name = workspaceName.trim()
    if (!name || busy) return

    setBusy(true)
    setFormError(null)

    try {
      const created = await api.workspaces.create(name)
      setWorkspaceName('')
      setCreating(false)
      reload()
      setOpenId(created.id)
    } catch (err) {
      setFormError(readErrorMessage(err, 'Could not create the workspace.'))
    } finally {
      setBusy(false)
    }
  }

  const submitProject = async (event: FormEvent, workspaceId: number) => {
    event.preventDefault()
    const name = projectName.trim()
    if (!name || busy) return

    setBusy(true)
    setFormError(null)

    try {
      await api.projects.create({
        name,
        description: projectDescription.trim() || null,
        workspaces_id: workspaceId,
      })
      setProjectName('')
      setProjectDescription('')
      setProjectFor(null)
      reload()
    } catch (err) {
      setFormError(readErrorMessage(err, 'Could not create the project.'))
    } finally {
      setBusy(false)
    }
  }

  const removeProject = async (projectId: number, name: string) => {
    if (!window.confirm(`Delete project “${name}” and every document in it?`)) return

    setBusy(true)
    setFormError(null)

    try {
      await api.projects.remove(projectId)
      reload()
    } catch (err) {
      setFormError(readErrorMessage(err, 'Could not delete the project.'))
    } finally {
      setBusy(false)
    }
  }

  const removeWorkspace = async (workspaceId: number, name: string) => {
    if (!window.confirm(`Delete workspace “${name}”?`)) return

    setBusy(true)
    setFormError(null)

    try {
      await api.workspaces.remove(workspaceId)
      reload()
    } catch (err) {
      setFormError(readErrorMessage(err, 'Could not delete the workspace.'))
    } finally {
      setBusy(false)
    }
  }

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

        <Button
          size="sm"
          iconLeft={<span aria-hidden="true">＋</span>}
          onClick={() => setCreating((v) => !v)}
        >
          New workspace
        </Button>
      </div>

      {(error || formError) && (
        <div className="alert animate-in">
          <span aria-hidden="true">⚠</span>
          <span>{formError ?? error}</span>
        </div>
      )}

      {creating && (
        <form className="inline-form animate-in" onSubmit={submitWorkspace}>
          <input
            autoFocus
            value={workspaceName}
            placeholder="Workspace name, e.g. Platform"
            aria-label="Workspace name"
            onChange={(event) => setWorkspaceName(event.target.value)}
          />
          <Button type="submit" size="sm" loading={busy} disabled={!workspaceName.trim()}>
            Create
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCreating(false)
              setWorkspaceName('')
            }}
          >
            Cancel
          </Button>
        </form>
      )}

      {loading && (
        <div className="console__loading animate-in">
          <Spinner size={20} label="Loading workspaces" />
          <span>Loading workspaces…</span>
        </div>
      )}

      {!loading && workspaces.length === 0 && (
        <div className="empty-state animate-in">
          <span aria-hidden="true">⧉</span>
          <h3>No workspaces yet</h3>
          <p>Create one to start grouping projects and documents.</p>
        </div>
      )}

      {!loading && workspaces.length > 0 && filtered.length === 0 && (
        <div className="empty-state animate-in">
          <span aria-hidden="true">⌕</span>
          <h3>Nothing matches “{query}”</h3>
          <p>Try a shorter phrase, or clear the filter.</p>
        </div>
      )}

      <div className="workspace-list">
        {filtered.map((node, i) => {
          const { workspace, projects, documents } = node
          const open = openId === workspace.id

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
                    org #{workspace.organisation_id} · {projects.length} projects ·{' '}
                    {documents.toLocaleString()} documents
                  </em>
                </span>

                <Badge tone="violet">workspace</Badge>
              </button>

              {/* Grid-rows trick: animates open/closed without a fixed height. */}
              <div className="workspace__panel">
                <div className="workspace__panel-inner">
                  {projects.map((project, j) => {
                    const docs = documentsOf(project.id)

                    return (
                      <article
                        className="project-card project-card--row"
                        key={project.id}
                        style={{ '--delay': `${j * 70}ms` } as CSSProperties}
                      >
                        <div className="flex-between">
                          <h3>{project.name}</h3>
                          {docs.length > 0 ? (
                            <Badge tone="mint">{docs.length} indexed</Badge>
                          ) : (
                            <Badge tone="amber">empty</Badge>
                          )}
                        </div>

                        <p>{project.description ?? 'No description.'}</p>

                        <div className="project-card__meta">
                          <span>
                            <strong className="text-mono">{docs.length.toLocaleString()}</strong> docs
                          </span>
                          <span>
                            project <strong className="text-mono">#{project.id}</strong>
                          </span>
                        </div>

                        <div className="project-card__actions">
                          <Button variant="subtle" size="sm" to={`/app/ask?project=${project.id}`}>
                            Ask
                          </Button>
                          <Button
                            variant="subtle"
                            size="sm"
                            to={`/app/documents?project=${project.id}`}
                          >
                            Documents
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => removeProject(project.id, project.name)}
                          >
                            Delete
                          </Button>
                        </div>
                      </article>
                    )
                  })}

                  {projects.length === 0 && (
                    <p className="workspace__none">
                      No projects here yet.{' '}
                      {query && 'Clear the filter to be sure — some may be hidden.'}
                    </p>
                  )}

                  {projectFor === workspace.id ? (
                    <form
                      className="inline-form inline-form--stack"
                      onSubmit={(event) => submitProject(event, workspace.id)}
                    >
                      <input
                        autoFocus
                        value={projectName}
                        placeholder="Project name"
                        aria-label="Project name"
                        onChange={(event) => setProjectName(event.target.value)}
                      />
                      <input
                        value={projectDescription}
                        placeholder="Description (optional)"
                        aria-label="Project description"
                        onChange={(event) => setProjectDescription(event.target.value)}
                      />
                      <div className="inline-form__row">
                        <Button type="submit" size="sm" loading={busy} disabled={!projectName.trim()}>
                          Create project
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setProjectFor(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="workspace__foot">
                      <Button
                        variant="outline"
                        size="sm"
                        iconLeft={<span aria-hidden="true">＋</span>}
                        onClick={() => {
                          setProjectFor(workspace.id)
                          setProjectName('')
                          setProjectDescription('')
                        }}
                      >
                        New project
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeWorkspace(workspace.id, workspace.name)}
                      >
                        Delete workspace
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )
        })}
      </div>

      <p className="console__note">
        Live from <code>GET /workspaces</code>, <code>GET /projects</code> and{' '}
        <code>GET /documents</code>. Upload files on the <Link to="/app/documents">Documents</Link>{' '}
        page.
      </p>
    </ConsoleShell>
  )
}
