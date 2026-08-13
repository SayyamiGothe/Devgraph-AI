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
import { SESSION_EXPIRED_EVENT } from '../lib/axios'
import { clearSession, getSession, setSession, subscribeToSession } from '../lib/session'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthValue {
  status: AuthStatus
  user: CurrentUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, organisationId: number) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getSession().access)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() =>
    getSession().access ? 'loading' : 'anonymous',
  )

  // The axios interceptors own the tokens, so mirror the store rather than
  // treating React state as the source of truth. A silent refresh or a forced
  // sign-out therefore shows up here too.
  useEffect(() => subscribeToSession((session) => setToken(session.access)), [])

  useEffect(() => {
    const onExpired = () => {
      setUser(null)
      setStatus('anonymous')
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

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

    api.auth
      .me(controller.signal)
      .then((me) => {
        if (!active) return
        setUser(me)
        setStatus('authenticated')
      })
      .catch((error: unknown) => {
        if (!active || (error as Error)?.name === 'CanceledError') return
        // An expired or malformed token should not trap the user in a loop.
        // (401s that could be refreshed were already retried by the interceptor.)
        if (error instanceof ApiError && error.isAuthError) clearSession()
        setUser(null)
        setStatus('anonymous')
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [token])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login(email, password)
    setSession({ access: result.access_token, refresh: result.refresh_token })
    // `me` runs in the effect above; surface it eagerly so the dashboard has
    // a user on first paint rather than a spinner.
    const me = await api.auth.me()
    setUser(me)
    setStatus('authenticated')
  }, [])

  const register = useCallback(
    async (email: string, password: string, organisationId: number) => {
      const created = await api.auth.register(email, password, organisationId)
      const result = await api.auth.login(email, password)
      setSession({ access: result.access_token, refresh: result.refresh_token })
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

  const logout = useCallback(async () => {
    const { refresh } = getSession()

    // Revoke server-side first, but never let a failure strand the user in a
    // signed-in shell — the local session goes either way.
    if (refresh) {
      try {
        await api.auth.logout(refresh)
      } catch {
        /* already revoked, expired, or the server is down */
      }
    }

    clearSession()
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
