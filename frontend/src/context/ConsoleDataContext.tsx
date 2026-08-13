import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, type DocumentRecord, type Project, type Workspace } from '../lib/api'
import { readErrorMessage } from '../hooks/useApi'

/**
 * One load of the organisation's tree — workspaces, their projects, and the
 * documents inside each project — shared by the sidebar and every console page
 * so they can't disagree with each other.
 *
 * Documents are fetched per project because the backend only exposes
 * `GET /documents?project_id=...`; an aggregate route would remove the fan-out.
 */

export type DocumentsByProject = Record<number, DocumentRecord[]>

interface ConsoleData {
  loading: boolean
  error: string | null
  workspaces: Workspace[]
  projects: Project[]
  documents: DocumentsByProject
  projectsOf: (workspaceId: number) => Project[]
  documentsOf: (projectId: number) => DocumentRecord[]
  totals: { workspaces: number; projects: number; documents: number }
  /** Re-reads everything. Call after a create/delete. */
  reload: () => void
  /** Re-reads one project's documents — cheaper after an upload. */
  reloadDocuments: (projectId: number) => Promise<void>
}

const ConsoleDataContext = createContext<ConsoleData | null>(null)

const EMPTY: DocumentRecord[] = []

export function ConsoleDataProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [documents, setDocuments] = useState<DocumentsByProject>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setLoading(true)
    setError(null)

    const load = async () => {
      const [workspaceList, projectList] = await Promise.all([
        api.workspaces.list(controller.signal),
        api.projects.list(controller.signal),
      ])

      if (!active) return

      setWorkspaces(workspaceList)
      setProjects(projectList)

      // A failed document read shouldn't blank the whole console, so each
      // project falls back to an empty list.
      const entries = await Promise.all(
        projectList.map(async (project) => {
          try {
            const list = await api.documents.list(project.id, controller.signal)
            return [project.id, list] as const
          } catch {
            return [project.id, EMPTY] as const
          }
        }),
      )

      if (!active) return
      setDocuments(Object.fromEntries(entries))
    }

    load()
      .catch((err: unknown) => {
        const name = (err as Error)?.name
        if (!active || name === 'CanceledError' || name === 'AbortError') return
        setError(readErrorMessage(err, 'Could not load your workspaces.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const reloadDocuments = useCallback(async (projectId: number) => {
    const list = await api.documents.list(projectId)
    setDocuments((current) => ({ ...current, [projectId]: list }))
  }, [])

  const value = useMemo<ConsoleData>(() => {
    const documentCount = Object.values(documents).reduce((sum, list) => sum + list.length, 0)

    return {
      loading,
      error,
      workspaces,
      projects,
      documents,
      projectsOf: (workspaceId) => projects.filter((p) => p.workspaces_id === workspaceId),
      documentsOf: (projectId) => documents[projectId] ?? EMPTY,
      totals: {
        workspaces: workspaces.length,
        projects: projects.length,
        documents: documentCount,
      },
      reload,
      reloadDocuments,
    }
  }, [loading, error, workspaces, projects, documents, reload, reloadDocuments])

  return <ConsoleDataContext.Provider value={value}>{children}</ConsoleDataContext.Provider>
}

export function useConsoleData(): ConsoleData {
  const ctx = useContext(ConsoleDataContext)
  if (!ctx) throw new Error('useConsoleData must be used inside <ConsoleDataProvider>')
  return ctx
}
