import { useEffect, useRef, useState } from 'react'

interface RevealOptions {
  /** Fraction of the element that must be visible. */
  threshold?: number
  /** Shrinks the viewport so the reveal fires slightly before the edge. */
  rootMargin?: string
  /** Keep the revealed state after scrolling away (default true). */
  once?: boolean
}

/**
 * Scroll-triggered reveal. Returns a ref to attach and whether the element has
 * entered the viewport, so animation stays in CSS and React only flips a class.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.15,
  rootMargin = '0px 0px -12% 0px',
  once = true,
}: RevealOptions = {}) {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Without IntersectionObserver (or with motion turned down) show content
    // immediately rather than hiding it forever.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            if (once) observer.disconnect()
          } else if (!once) {
            setVisible(false)
          }
        })
      },
      { threshold, rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  return { ref, visible }
}
