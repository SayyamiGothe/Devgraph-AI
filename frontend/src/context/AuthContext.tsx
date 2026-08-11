import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiError, api, type CurrentUser } from '../lib/api'

const TOKEN_KEY = 'devgraph.token'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthValue {
  status: AuthStatus
  user: CurrentUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, organisationId: number) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    // Private mode / storage disabled — fall back to memory-only auth.
    return null
  }
}

function writeStoredToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token)
    else window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readStoredToken)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (readStoredToken() ? 'loading' : 'anonymous'))

  // Resolve a stored token into a user on boot (and whenever it changes).
  useEffect(() => {
    if (!token) {
      setUser(null)
      setStatus('anonymous')
      return
    }

    const controller = new AbortController()
    let active = true
    setStatus((current) => (current === 'authenticated' ? current : 'loading'))

    api
      .me(token, controller.signal)
      .then((me) => {
        if (!active) return
        setUser(me)
        setStatus('authenticated')
      })
      .catch((error: unknown) => {
        if (!active || (error as Error)?.name === 'AbortError') return
        // An expired or malformed token should not trap the user in a loop.
        if (error instanceof ApiError && error.status === 401) {
          writeStoredToken(null)
          setToken(null)
        }
        setUser(null)
        setStatus('anonymous')
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [token])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password)
    writeStoredToken(result.access_token)
    setToken(result.access_token)
    // `me` runs in the effect above; surface it eagerly so the dashboard has
    // a user on first paint rather than a spinner.
    const me = await api.me(result.access_token)
    setUser(me)
    setStatus('authenticated')
  }, [])

  const register = useCallback(
    async (email: string, password: string, organisationId: number) => {
      const created = await api.register(email, password, organisationId)
      const result = await api.login(email, password)
      writeStoredToken(result.access_token)
      setToken(result.access_token)
      setUser({
        id: created.id,
        email: created.email,
        organisation_id: created.organisation_id,
        role: created.role,
      })
      setStatus('authenticated')
    },
    [],
  )

  const logout = useCallback(() => {
    writeStoredToken(null)
    setToken(null)
    setUser(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ status, user, token, login, register, logout }),
    [status, user, token, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
