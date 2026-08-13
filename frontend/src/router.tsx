import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from 'react'

/**
 * A ~100 line hash router.
 *
 * Hash routing means the FastAPI/static host never has to be taught about
 * client-side routes, and it keeps the dependency list at zero. If this app
 * later needs data loaders or nested layouts, swap it for react-router — the
 * `Link` / `useNavigate` / `useRoute` surface below is intentionally similar.
 */

interface RouterValue {
  path: string
  navigate: (to: string, opts?: { replace?: boolean }) => void
}

const RouterContext = createContext<RouterValue | null>(null)

function readHash(): string {
  const raw = window.location.hash.replace(/^#/, '')
  return raw === '' ? '/' : raw
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(readHash)

  useEffect(() => {
    const onChange = () => setPath(readHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (readHash() === to) return
    if (opts?.replace) {
      window.location.replace(`${window.location.pathname}${window.location.search}#${to}`)
      setPath(to)
    } else {
      window.location.hash = to
    }
  }, [])

  const value = useMemo(() => ({ path, navigate }), [path, navigate])

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

function useRouter(): RouterValue {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>')
  return ctx
}

/** The route without its query string — what `App` switches on. */
export function useRoute(): string {
  const { path } = useRouter()
  return path.split('?')[0]
}

/** The raw route, query string included. */
export function useLocation(): string {
  return useRouter().path
}

/** `#/app/documents?project=7` -> `URLSearchParams { project: '7' }`. */
export function useSearchParams(): URLSearchParams {
  const { path } = useRouter()
  const [, query = ''] = path.split('?')
  return useMemo(() => new URLSearchParams(query), [query])
}

/** Reads a numeric query param, or null when absent/not a number. */
export function useNumericParam(name: string): number | null {
  const params = useSearchParams()
  const raw = params.get(name)
  if (raw === null) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export function useNavigate() {
  return useRouter().navigate
}

/** `/app/projects/:id` against `/app/projects/7` -> `{ id: '7' }`, else null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const pSeg = pattern.split('/').filter(Boolean)
  const aSeg = path.split('/').filter(Boolean)
  if (pSeg.length !== aSeg.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < pSeg.length; i += 1) {
    const p = pSeg[i]
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(aSeg[i])
    } else if (p !== aSeg[i]) {
      return null
    }
  }
  return params
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string
  children: ReactNode
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const navigate = useNavigate()

  return (
    <a
      href={`#${to}`}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || event.metaKey || event.ctrlKey) return
        event.preventDefault()
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

/** Scrolls to the top on every route change — hash routing won't do it for us. */
export function useScrollReset(path: string) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [path])
}
