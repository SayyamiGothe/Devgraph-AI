import type { CSSProperties } from 'react'
import './ui.scss'

interface LogoProps {
  size?: number
  /** Hide the wordmark and show the glyph only (sidebar rail, favicons). */
  compact?: boolean
}

/**
 * The DevGraph mark: three nodes and their edges, drawn in as the page loads.
 */
export function Logo({ size = 32, compact = false }: LogoProps) {
  return (
    <span className="logo" style={{ '--logo-size': `${size}px` } as CSSProperties}>
      <svg viewBox="0 0 32 32" width={size} height={size} role="img" aria-label="DevGraph AI">
        <defs>
          <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#9d86ff" />
            <stop offset="0.5" stopColor="#f472b6" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>

        <g className="logo__edges" stroke="url(#logo-gradient)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M8 9 L24 7" />
          <path d="M8 9 L16 24" />
          <path d="M24 7 L16 24" />
        </g>

        <g fill="url(#logo-gradient)" className="logo__nodes">
          <circle cx="8" cy="9" r="3.4" />
          <circle cx="24" cy="7" r="2.6" />
          <circle cx="16" cy="24" r="3" />
        </g>
      </svg>

      {!compact && (
        <span className="logo__word">
          Dev<span className="logo__word-accent">Graph</span>
          <em>AI</em>
        </span>
      )}
    </span>
  )
}
