import type { ReactNode } from 'react'
import './ui.scss'

type Tone = 'violet' | 'cyan' | 'mint' | 'amber' | 'rose' | 'neutral'

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode
  tone?: Tone
  /** Prefix with a pulsing status dot. */
  dot?: boolean
}) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  )
}
