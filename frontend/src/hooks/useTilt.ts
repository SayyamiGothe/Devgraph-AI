import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { clamp, prefersReducedMotion } from '../lib/motion'

/**
 * Pointer-reactive card: writes `--rotate-x` / `--rotate-y` (tilt in degrees) and
 * `--mouse-x` / `--mouse-y` (cursor position, %) onto the element. CSS decides what
 * to do with them — a 3D transform, a spotlight gradient, or both.
 *
 * Values are set directly on the node instead of through state so pointer moves
 * never trigger a React render.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(maxTilt = 7) {
  const ref = useRef<T | null>(null)

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<T>) => {
      const node = ref.current
      if (!node || prefersReducedMotion()) return

      const rect = node.getBoundingClientRect()
      const px = (event.clientX - rect.left) / rect.width
      const py = (event.clientY - rect.top) / rect.height

      node.style.setProperty('--mouse-x', `${(px * 100).toFixed(2)}%`)
      node.style.setProperty('--mouse-y', `${(py * 100).toFixed(2)}%`)
      node.style.setProperty('--rotate-y', `${(clamp(px - 0.5, -0.5, 0.5) * maxTilt * 2).toFixed(2)}deg`)
      node.style.setProperty('--rotate-x', `${(clamp(0.5 - py, -0.5, 0.5) * maxTilt * 2).toFixed(2)}deg`)
    },
    [maxTilt],
  )

  const onPointerLeave = useCallback(() => {
    const node = ref.current
    if (!node) return
    node.style.setProperty('--rotate-x', '0deg')
    node.style.setProperty('--rotate-y', '0deg')
    node.style.setProperty('--mouse-x', '50%')
    node.style.setProperty('--mouse-y', '50%')
  }, [])

  return { ref, onPointerMove, onPointerLeave }
}
