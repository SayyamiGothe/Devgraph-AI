import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../lib/api'

interface ApiState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

/** `AbortController.abort()` surfaces as a CanceledError through axios. */
function isCancel(error: unknown): boolean {
  const name = (error as Error)?.name
  return name === 'CanceledError' || name === 'AbortError'
}

export function readErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/**
 * Runs `fetcher` on mount and whenever `key` changes, cancelling the in-flight
 * request first. `key` is a plain string so callers stay explicit about what
 * identifies the request (`'workspaces'`, `` `documents:${projectId}` ``).
 *
 * Pass `enabled: false` to hold off — e.g. until a project is selected.
 */
export function useApi<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: enabled })
  const [nonce, setNonce] = useState(0)

  // Keep the latest fetcher without making it a dependency — inline arrow
  // functions would otherwise re-fetch on every render.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, error: null, loading: false })
      return
    }

    const controller = new AbortController()
    let active = true

    setState((current) => ({ ...current, loading: true, error: null }))

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (active) setState({ data, error: null, loading: false })
      })
      .catch((error: unknown) => {
        if (!active || isCancel(error)) return
        setState({ data: null, error: readErrorMessage(error), loading: false })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [key, enabled, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const setData = useCallback((data: T | null) => {
    setState((current) => ({ ...current, data }))
  }, [])

  return { ...state, reload, setData }
}
