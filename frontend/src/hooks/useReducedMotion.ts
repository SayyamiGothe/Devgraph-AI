import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'

/**
 * Reactive version of the reduced-motion check, for animations that live in JS
 * or SMIL and therefore can't be switched off from a media query in CSS.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)

  useEffect(() => {
    if (!window.matchMedia) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
