import { useEffect, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface TypingTextProps {
  /** Phrases are typed, held, deleted, then the next one starts. */
  phrases: string[]
  typeSpeed?: number
  deleteSpeed?: number
  holdFor?: number
  className?: string
}

/**
 * Terminal-style typewriter. With reduced motion it simply prints the first
 * phrase and stops.
 */
export function TypingText({
  phrases,
  typeSpeed = 46,
  deleteSpeed = 24,
  holdFor = 1900,
  className = '',
}: TypingTextProps) {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [length, setLength] = useState(0)
  const [deleting, setDeleting] = useState(false)

  const phrase = phrases[index % phrases.length] ?? ''

  useEffect(() => {
    if (reduced) return

    // One timer per keystroke keeps the rhythm irregular enough to feel human
    // without tracking elapsed time by hand.
    let delay = deleting ? deleteSpeed : typeSpeed

    if (!deleting && length === phrase.length) {
      delay = holdFor
    } else if (deleting && length === 0) {
      delay = 320
    }

    const timer = window.setTimeout(() => {
      if (!deleting && length === phrase.length) {
        setDeleting(true)
      } else if (deleting && length === 0) {
        setDeleting(false)
        setIndex((i) => (i + 1) % phrases.length)
      } else {
        setLength((l) => l + (deleting ? -1 : 1))
      }
    }, delay)

    return () => window.clearTimeout(timer)
  }, [length, deleting, phrase, phrases.length, typeSpeed, deleteSpeed, holdFor, reduced])

  if (reduced) {
    return <span className={className}>{phrases[0]}</span>
  }

  return (
    <span className={className}>
      {phrase.slice(0, length)}
      <i className="caret" aria-hidden="true" />
    </span>
  )
}
