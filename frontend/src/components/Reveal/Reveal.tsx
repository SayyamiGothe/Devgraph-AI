import type { CSSProperties, JSX, ReactNode, Ref } from 'react'
import { useReveal } from '../../hooks/useReveal'
import './Reveal.scss'

type Variant = 'up' | 'left' | 'right' | 'scale' | 'fade' | 'blur'

interface RevealProps {
  children: ReactNode
  /** Direction/style of the entrance. */
  variant?: Variant
  /** Milliseconds to hold before animating — use for stagger. */
  delay?: number
  /** Milliseconds the animation runs. */
  duration?: number
  /** Element to render, for keeping the markup semantic. */
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: CSSProperties
}

/**
 * Declarative scroll reveal. The transition itself lives in Reveal.scss; this
 * only toggles `is-visible` when the element enters the viewport.
 */
export function Reveal({
  children,
  variant = 'up',
  delay = 0,
  duration = 700,
  as = 'div',
  className = '',
  style,
}: RevealProps) {
  const { ref, visible } = useReveal<HTMLElement>()

  // Rendered tag is dynamic, but every tag we allow accepts the same three
  // props, so type it as a div and let the runtime use the real tag.
  const Tag = as as 'div'

  return (
    <Tag
      ref={ref as Ref<HTMLDivElement>}
      className={`reveal reveal--${variant} ${visible ? 'is-visible' : ''} ${className}`.trim()}
      style={
        {
          ...style,
          '--reveal-delay': `${delay}ms`,
          '--reveal-duration': `${duration}ms`,
        } as CSSProperties
      }
    >
      {children}
    </Tag>
  )
}
