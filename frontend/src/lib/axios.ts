/**
 * The single axios instance every request in the app goes through.
 *
 * Responsibilities, in interceptor order:
 *   1. request  — attach `Authorization: Bearer <access token>`.
 *   2. response — on 401, refresh once via `POST /auth/refresh` and replay the
 *      original request; concurrent 401s share one refresh call.
 *   3. response — normalise every failure into `ApiError` so UI code can switch
 *      on `error.status` and print `error.message` without knowing about axios
 *      or FastAPI's `{detail: ...}` shape.
 *
 * Base URL: `VITE_API_BASE_URL` if set, otherwise `/api`, which Vite's dev
 * proxy rewrites onto the FastAPI root (see vite.config.ts) — so `/auth/login`
 * here reaches `POST http://127.0.0.1:8000/auth/login`.
 */

import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { clearSession, getSession, setAccessToken } from './session'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** Per-request opt-outs. Both default to off. */
interface DevgraphConfig {
  /** Skip the bearer header — used by login/register/refresh. */
  skipAuth?: boolean
  /** Internal: marks a request that has already been replayed after a refresh. */
  retried?: boolean
}

type RequestConfig = AxiosRequestConfig & DevgraphConfig
type InternalConfig = InternalAxiosRequestConfig & DevgraphConfig

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server. */
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

  /** No token, or a token the backend rejected. */
  get isAuthError(): boolean {
    return this.status === 401
  }

  get isNetworkError(): boolean {
    return this.status === 0
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

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError

    if (axiosError.response) {
      const { status, data } = axiosError.response
      return new ApiError(readDetail(data, `Request failed (${status})`), status)
    }

    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return new ApiError('The request timed out. The backend may still be working on it.', 0)
    }

    return new ApiError(
      'Cannot reach the API. Is the FastAPI server running on port 8000?',
      0,
    )
  }

  return new ApiError((error as Error)?.message || 'Something went wrong.', 0)
}

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  // Long enough for a RAG answer (embedding + retrieval + LLM) to come back.
  timeout: 60_000,
  headers: { Accept: 'application/json' },
})

// ---- 1. Attach the bearer token -------------------------------------------

axiosInstance.interceptors.request.use((config: InternalConfig) => {
  if (!config.skipAuth) {
    const { access } = getSession()
    if (access) config.headers.Authorization = `Bearer ${access}`
  }

  // Let the browser set the multipart boundary itself.
  if (config.data instanceof FormData && typeof config.headers?.delete === 'function') {
    config.headers.delete('Content-Type')
  }

  return config
})

// ---- 2. Silent refresh + 3. error normalisation ---------------------------

/** Fires when a refresh fails, so `AuthContext` can drop the user to /login. */
export const SESSION_EXPIRED_EVENT = 'devgraph:session-expired'

let refreshInFlight: Promise<string> | null = null

/**
 * Exchanges the refresh token for a new access token. Concurrent callers await
 * the same promise so a burst of 401s produces exactly one refresh request.
 */
function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight

  const { refresh } = getSession()
  if (!refresh) return Promise.reject(new ApiError('Session expired. Please sign in again.', 401))

  refreshInFlight = axiosInstance
    .post<{ access_token: string }>('/auth/refresh', { refresh_token: refresh }, {
      skipAuth: true,
      retried: true,
    } as RequestConfig)
    .then((response) => {
      const access = response.data?.access_token
      if (!access) throw new ApiError('Refresh did not return an access token.', 401)
      setAccessToken(access)
      return access
    })
    .finally(() => {
      refreshInFlight = null
    })

  return refreshInFlight
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw toApiError(error)

    const config = error.config as InternalConfig | undefined
    const status = error.response?.status

    const canRetry =
      status === 401 && config && !config.retried && !config.skipAuth && Boolean(getSession().refresh)

    if (canRetry) {
      try {
        const access = await refreshAccessToken()
        config.retried = true
        config.headers.Authorization = `Bearer ${access}`
        return await axiosInstance.request(config)
      } catch {
        // The refresh token is dead too — stop pretending we have a session.
        clearSession()
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
        throw new ApiError('Your session expired. Please sign in again.', 401)
      }
    }

    throw toApiError(error)
  },
)

// ---- Thin helpers so callers never touch `response.data` -------------------

export async function get<T>(url: string, config?: RequestConfig): Promise<T> {
  const response = await axiosInstance.get<T>(url, config)
  return response.data
}

export async function post<T>(url: string, body?: unknown, config?: RequestConfig): Promise<T> {
  const response = await axiosInstance.post<T>(url, body, config)
  return response.data
}

export async function put<T>(url: string, body?: unknown, config?: RequestConfig): Promise<T> {
  const response = await axiosInstance.put<T>(url, body, config)
  return response.data
}

export async function del<T>(url: string, config?: RequestConfig): Promise<T> {
  const response = await axiosInstance.delete<T>(url, config)
  return response.data
}

export type { RequestConfig }
