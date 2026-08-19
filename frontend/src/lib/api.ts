/**
 * Typed client for the DevGraph AI FastAPI backend.
 *
 * Every call goes through `axiosInstance` (see lib/axios.ts), which attaches the
 * bearer token, refreshes it on 401 and turns failures into `ApiError`. Types
 * below mirror `backend/app/schemas/*.py` — keep them in step.
 */

import { ApiError, axiosInstance, del, get, post, put } from './axios'

export { ApiError, axiosInstance }

// --- Auth (app/schemas/auth.py) ---------------------------------------------

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface RefreshResponse {
  access_token: string
  token_type: string
}

export interface RegisterResponse {
  id: number
  email: string
  role: string
  organisation_id: number
}

/** `GET /auth/me` returns id/email/organisation_id — no role yet. */
export interface CurrentUser {
  id: number
  email: string
  organisation_id: number
  role?: string
}

// --- Organisation / workspace / project ------------------------------------

export interface Organisation {
  id: number
  name: string
}

export interface Workspace {
  id: number
  name: string
  organisation_id: number
}

export interface Project {
  id: number
  name: string
  description: string | null
  workspaces_id: number
  organisation_id: number
}

export interface DocumentRecord {
  id: number
  name: string
  file_path: string
  project_id: number
}

// --- Conversations / chat / RAG --------------------------------------------

export interface Conversation {
  id: number
  project_id: number
  title: string | null
}

export interface ChatMessage {
  id: number
  conversation_id: number
  role: 'user' | 'assistant' | string
  content: string
}

export interface RagSource {
  document_id: number
  chunk_id: number
  document_name: string
  chunk_index: number

  /** Present only when the chunk came from ingested source code. */
  code_fqn?: string | null
  file_path?: string | null
  start_line?: number | null
  end_line?: number | null
}

export interface RagAnswer {
  question: string
  project_id: number
  answer: string
  sources: RagSource[]
}

export interface RetrievedChunk {
  document_id: number
  chunk_id: number
  chunk_index: number
  text: string
}

export interface UploadOptions {
  signal?: AbortSignal
  /** 0–1, fires as the file goes up. */
  onProgress?: (fraction: number) => void
}

// --- Code repositories (app/schemas/code_repository.py) ---------------------

export type RepositoryStatus = 'processing' | 'ready' | 'failed'

export interface CodeRepository {
  id: number
  name: string
  project_id: number
  status: RepositoryStatus
  error: string | null
  /** Python files parsed. */
  file_count: number
  /** Files that could not be parsed at all. A high number means a thin graph. */
  skipped_count: number
  node_count: number
  edge_count: number
  created_at: string
}

/** One node's immediate neighbourhood in the code graph. */
export interface GraphNeighbours {
  fqn: string
  kind: 'module' | 'class' | 'function' | string
  file_path: string
  start_line: number
  end_line: number
  signature: string
  docstring: string
  parent: string | null
  callers: string[]
  callees: string[]
  bases: string[]
}

export interface ImpactCaller {
  fqn: string
  kind: string
  file_path: string
  start_line: number
  /** Shortest number of CALLS edges from this caller to the target. */
  hops: number
}

export interface ImpactResult {
  fqn: string
  depth: number
  caller_count: number
  callers: ImpactCaller[]
  /** The backend's reminder that the graph is heuristic, not exhaustive. */
  note: string
}

export interface PollOptions {
  signal?: AbortSignal
  intervalMs?: number
  timeoutMs?: number
  /** Called on every poll, so the UI can show interim counts. */
  onTick?: (repository: CodeRepository) => void
}

export const auth = {
  login: (email: string, password: string) =>
    post<LoginResponse>('/auth/login', { email, password }, { skipAuth: true }),

  register: (email: string, password: string, organisationId: number) =>
    post<RegisterResponse>(
      '/auth/register',
      { email, password, organisation_id: organisationId },
      { skipAuth: true },
    ),

  /** The axios interceptor calls this route too; this is the explicit path. */
  refresh: (refreshToken: string) =>
    post<RefreshResponse>('/auth/refresh', { refresh_token: refreshToken }, { skipAuth: true }),

  logout: (refreshToken: string) =>
    post<{ message: string }>('/auth/logout', { refresh_token: refreshToken }, { skipAuth: true }),

  me: (signal?: AbortSignal) => get<CurrentUser>('/auth/me', { signal }),
}

export const organisations = {
  mine: (signal?: AbortSignal) => get<Organisation>('/organisations', { signal }),

  /** ADMIN only. */
  rename: (name: string) => put<Organisation>('/organisations', { name }),
}

export const workspaces = {
  list: (signal?: AbortSignal) => get<Workspace[]>('/workspaces', { signal }),

  get: (workspaceId: number, signal?: AbortSignal) =>
    get<Workspace>(`/workspaces/${workspaceId}`, { signal }),

  create: (name: string) => post<Workspace>('/workspaces', { name }),

  update: (workspaceId: number, name: string) =>
    put<Workspace>(`/workspaces/${workspaceId}`, { name }),

  remove: (workspaceId: number) => del<{ message: string }>(`/workspaces/${workspaceId}`),
}

export const projects = {
  list: (signal?: AbortSignal) => get<Project[]>('/projects', { signal }),

  get: (projectId: number, signal?: AbortSignal) =>
    get<Project>(`/projects/${projectId}`, { signal }),

  create: (input: { name: string; description?: string | null; workspaces_id: number }) =>
    post<Project>('/projects', {
      name: input.name,
      description: input.description ?? null,
      workspaces_id: input.workspaces_id,
    }),

  update: (projectId: number, input: { name?: string; description?: string | null }) =>
    put<Project>(`/projects/${projectId}`, input),

  remove: (projectId: number) => del<{ message: string }>(`/projects/${projectId}`),
}

export const documents = {
  list: (projectId: number, signal?: AbortSignal) =>
    get<DocumentRecord[]>('/documents', { params: { project_id: projectId }, signal }),

  get: (documentId: number, signal?: AbortSignal) =>
    get<DocumentRecord>(`/documents/${documentId}`, { signal }),

  /**
   * `POST /documents` is multipart: name + project_id + file. The backend parses,
   * chunks and embeds the file inside this request, so it can take a while —
   * hence the generous per-call timeout.
   */
  upload: (input: { name: string; projectId: number; file: File }, options: UploadOptions = {}) => {
    const form = new FormData()
    form.append('name', input.name)
    form.append('project_id', String(input.projectId))
    form.append('file', input.file)

    return post<DocumentRecord>('/documents', form, {
      timeout: 300_000,
      signal: options.signal,
      onUploadProgress: (event) => {
        if (!options.onProgress) return
        const total = event.total ?? input.file.size
        if (total > 0) options.onProgress(Math.min(event.loaded / total, 1))
      },
    })
  },

  rename: (documentId: number, name: string) =>
    put<DocumentRecord>(`/documents/${documentId}`, { name }),

  remove: (documentId: number) => del<{ message: string }>(`/documents/${documentId}`),
}

export const conversations = {
  listByProject: (projectId: number, signal?: AbortSignal) =>
    get<Conversation[]>(`/conversations/project/${projectId}`, { signal }),

  get: (conversationId: number, signal?: AbortSignal) =>
    get<Conversation>(`/conversations/${conversationId}`, { signal }),

  create: (projectId: number, title?: string | null) =>
    post<Conversation>('/conversations', { project_id: projectId, title: title ?? null }),
}

export const chat = {
  messages: (conversationId: number, signal?: AbortSignal) =>
    get<ChatMessage[]>(`/chat-messages/conversation/${conversationId}`, { signal }),
}

export const rag = {
  /** Retrieval only — handy for debugging what the LLM was shown. */
  retrieve: (question: string, projectId: number, signal?: AbortSignal) =>
    get<RetrievedChunk[]>('/rag/retrieve', {
      params: { question, project_id: projectId },
      signal,
    }),

  ask: (input: {
    question: string
    projectId: number
    conversationId: number
    topK?: number
  }) =>
    post<RagAnswer>(
      '/rag/ask',
      {
        question: input.question,
        project_id: input.projectId,
        conversation_id: input.conversationId,
        top_k: input.topK ?? 5,
      },
      // Retrieval + generation; well past the default timeout on a cold model.
      { timeout: 120_000 },
    ),
}

export const repositories = {
  list: (projectId: number, signal?: AbortSignal) =>
    get<CodeRepository[]>('/repositories', { params: { project_id: projectId }, signal }),

  get: (repositoryId: number, signal?: AbortSignal) =>
    get<CodeRepository>(`/repositories/${repositoryId}`, { signal }),

  /**
   * `POST /repositories/upload` is multipart: name + project_id + file (.zip).
   *
   * Unlike document upload this returns as soon as the bytes are on disk, with
   * status "processing". Parsing, graph writes and embedding continue in a
   * background task — use `waitUntilReady` to follow it.
   */
  upload: (
    input: { name: string; projectId: number; file: File },
    options: UploadOptions = {},
  ) => {
    const form = new FormData()
    form.append('name', input.name)
    form.append('project_id', String(input.projectId))
    form.append('file', input.file)

    return post<CodeRepository>('/repositories/upload', form, {
      // Only the upload itself happens in this request, but a large zip
      // still takes a while to travel.
      timeout: 300_000,
      signal: options.signal,
      onUploadProgress: (event) => {
        if (!options.onProgress) return
        const total = event.total ?? input.file.size
        if (total > 0) options.onProgress(Math.min(event.loaded / total, 1))
      },
    })
  },

  /** Polls until status leaves "processing". Resolves on ready AND on failed. */
  waitUntilReady: async (
    repositoryId: number,
    options: PollOptions = {},
  ): Promise<CodeRepository> => {
    const { signal, intervalMs = 2_000, timeoutMs = 900_000, onTick } = options
    const deadline = Date.now() + timeoutMs

    for (;;) {
      const repository = await get<CodeRepository>(`/repositories/${repositoryId}`, {
        signal,
      })

      onTick?.(repository)

      if (repository.status !== 'processing') return repository

      if (Date.now() > deadline) {
        throw new Error('Timed out waiting for the repository to finish processing.')
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  },

  /** Node counts and edge counts by type, straight from Neo4j. */
  stats: (repositoryId: number, signal?: AbortSignal) =>
    get<{ nodes: Record<string, number>; edges: Record<string, number> }>(
      `/repositories/${repositoryId}/stats`,
      { signal },
    ),

  /** Callers, callees and base classes for one fully-qualified name. */
  graph: (repositoryId: number, fqn: string, signal?: AbortSignal) =>
    get<GraphNeighbours>(`/repositories/${repositoryId}/graph`, {
      params: { fqn },
      signal,
    }),

  /** Blast radius: everything that transitively calls `fqn`. */
  impact: (repositoryId: number, fqn: string, depth = 2, signal?: AbortSignal) =>
    get<ImpactResult>(`/repositories/${repositoryId}/impact`, {
      params: { fqn, depth },
      signal,
    }),

  /** Drops the Neo4j subgraph, the Document rows, the chunks and the zip. */
  remove: (repositoryId: number) =>
    del<{ message: string }>(`/repositories/${repositoryId}`),
}

export const users = {
  /** ADMIN only. */
  create: (input: { email: string; password: string; role: string }) =>
    post<CurrentUser>('/user', input),

  get: (userId: number) => get<CurrentUser>(`/user/${userId}`),

  updateRole: (userId: number, role: string) => put<CurrentUser>(`/user/${userId}`, { role }),

  remove: (userId: number) => del<{ message: string }>(`/user/${userId}`),
}

/** Everything in one object, for `import { api } from '../lib/api'`. */
export const api = {
  auth,
  organisations,
  workspaces,
  projects,
  documents,
  repositories,
  conversations,
  chat,
  rag,
  users,
}
