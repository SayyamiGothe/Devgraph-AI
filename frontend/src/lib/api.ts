/**
 * Thin client for the DevGraph AI FastAPI backend.
 *
 * Requests go to `/api/*` and Vite's dev proxy rewrites that to the backend
 * root (see vite.config.ts), so `/api/auth/login` hits `POST /auth/login`.
 */

const BASE = '/api'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** FastAPI reports errors as `{detail: string}` or a 422 validation array. */
function readDetail(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload) return payload

  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail: unknown }).detail
    if (typeof detail === 'string') return detail

    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const { loc, msg } = item as { loc?: unknown[]; msg?: string }
          const field = Array.isArray(loc) ? loc[loc.length - 1] : undefined
          return field ? `${String(field)}: ${msg ?? 'invalid'}` : (msg ?? null)
        })
        .filter(Boolean)
      if (parts.length) return parts.join(' · ')
    }
  }

  return fallback
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string | null
  signal?: AbortSignal
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    throw new ApiError('Cannot reach the API. Is the FastAPI server running on port 8000?', 0)
  }

  const raw = await response.text()
  let payload: unknown = null
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = raw
    }
  }

  if (!response.ok) {
    throw new ApiError(readDetail(payload, `Request failed (${response.status})`), response.status)
  }

  return payload as T
}

// --- Types mirroring app/schemas/auth.py ------------------------------------

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface RegisterResponse {
  id: number
  email: string
  role: string
  organisation_id: number
}

/** `GET /auth/me` currently returns id/email/organisation_id (no role). */
export interface CurrentUser {
  id: number
  email: string
  organisation_id: number
  role?: string
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } }),

  register: (email: string, password: string, organisationId: number) =>
    request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: { email, password, organisation_id: organisationId },
    }),

  me: (token: string, signal?: AbortSignal) =>
    request<CurrentUser>('/auth/me', { token, signal }),

  /** ADMIN-only on the backend; surfaces 403 for everyone else. */
  deleteUser: (userId: number, token: string) =>
    request<{ message: string; deleted_by: string }>(`/auth/users/${userId}`, {
      method: 'DELETE',
      token,
    }),
}
