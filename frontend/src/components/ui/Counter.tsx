import { useCountUp } from '../../hooks/useCountUp'
import { useReveal } from '../../hooks/useReveal'

interface CounterProps {
  to: number
  /** Decimal places to show while and after counting. */
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
}

/** Counts up from zero the first time it scrolls into view. */
export function Counter({
  to,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1700,
  className = '',
}: CounterProps) {
  const { ref, visible } = useReveal<HTMLSpanElement>({ threshold: 0.4 })
  const value = useCountUp(to, visible, duration)

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}
