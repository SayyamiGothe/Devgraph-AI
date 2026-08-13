/**
 * Where the JWT pair lives.
 *
 * Kept out of React state on purpose: the axios interceptors in `lib/axios.ts`
 * need the current tokens synchronously, and `AuthContext` needs to hear about
 * changes the interceptors make (a silent refresh, or a forced sign-out after a
 * dead refresh token). A tiny store with a subscription solves both without a
 * circular import between the context and the client.
 */

const ACCESS_KEY = 'devgraph.access_token'
const REFRESH_KEY = 'devgraph.refresh_token'
// Older builds stored only the access token under this key.
const LEGACY_KEY = 'devgraph.token'

export interface Session {
  access: string | null
  refresh: string | null
}

type Listener = (session: Session) => void

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    // Private mode / storage disabled — fall back to memory-only auth.
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value) window.localStorage.setItem(key, value)
    else window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

let current: Session = {
  access: read(ACCESS_KEY) ?? read(LEGACY_KEY),
  refresh: read(REFRESH_KEY),
}

const listeners = new Set<Listener>()

export function getSession(): Session {
  return current
}

export function setSession(next: Session) {
  current = next
  write(ACCESS_KEY, next.access)
  write(REFRESH_KEY, next.refresh)
  write(LEGACY_KEY, null)
  listeners.forEach((listener) => listener(current))
}

/** Replaces just the access token — used after a silent refresh. */
export function setAccessToken(access: string | null) {
  setSession({ ...current, access })
}

export function clearSession() {
  setSession({ access: null, refresh: null })
}

export function subscribeToSession(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
