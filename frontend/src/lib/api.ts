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
  conversations,
  chat,
  rag,
  users,
}
