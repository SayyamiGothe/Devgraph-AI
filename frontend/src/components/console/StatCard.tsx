import type { CSSProperties } from 'react'
import { Counter } from '../ui/Counter'

const W = 120
const H = 40

export interface Stat {
  label: string
  value: number
  decimals?: number
  suffix?: string
  /** Percentage change vs. the previous period, when the API can tell us. */
  delta?: number
  /** Sparkline series, arbitrary units. Omitted when there is no history. */
  series?: number[]
  tone: 'violet' | 'cyan' | 'mint' | 'amber'
  /** Caption under the value. */
  foot?: string
}

/** Series -> smooth-ish polyline in a 120x40 box. */
function toPoints(series: number[]): string {
  const max = Math.max(...series)
  const min = Math.min(...series)
  const span = max - min || 1

  return series
    .map((value, i) => {
      const x = (i / (series.length - 1)) * W
      const y = H - ((value - min) / span) * (H - 6) - 3
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function StatCard({ stat, index }: { stat: Stat; index: number }) {
  const points = stat.series && stat.series.length > 1 ? toPoints(stat.series) : null
  const up = (stat.delta ?? 0) >= 0
  // Latency going down is good; everything else going up is good.
  const good = stat.suffix === 'ms' ? !up : up

  return (
    <article
      className={`stat-card stat-card--${stat.tone} animate-in`}
      style={{ '--delay': `${index * 90}ms` } as CSSProperties}
    >
      <header className="stat-card__head">
        <span className="stat-card__label">{stat.label}</span>
        {stat.delta !== undefined && (
          <span className={`stat-card__delta ${good ? 'is-good' : 'is-bad'}`}>
            <span aria-hidden="true">{up ? '↑' : '↓'}</span>
            {Math.abs(stat.delta).toFixed(1)}%
          </span>
        )}
      </header>

      <strong className="stat-card__value">
        <Counter to={stat.value} decimals={stat.decimals ?? 0} suffix={stat.suffix ?? ''} />
      </strong>

      {points && (
        <svg
          className="stat-card__spark"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Filled area under the line */}
          <polygon className="stat-card__area" points={`0,${H} ${points} ${W},${H}`} />
          {/* pathLength=1 keeps the draw animation identical for every series */}
          <polyline className="stat-card__line" points={points} pathLength={1} />
        </svg>
      )}

      <span className="stat-card__foot">{stat.foot ?? 'live from your organisation'}</span>
    </article>
  )
}
