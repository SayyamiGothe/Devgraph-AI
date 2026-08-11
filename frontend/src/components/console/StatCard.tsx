import type { CSSProperties } from 'react'
import { Counter } from '../ui/Counter'
import type { MockStat } from '../../lib/mock'

const W = 120
const H = 40

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

export function StatCard({ stat, index }: { stat: MockStat; index: number }) {
  const points = toPoints(stat.series)
  const up = stat.delta >= 0
  // Latency going down is good; everything else going up is good.
  const good = stat.suffix === 'ms' ? !up : up

  return (
    <article
      className={`stat-card stat-card--${stat.tone} animate-in`}
      style={{ '--delay': `${index * 90}ms` } as CSSProperties}
    >
      <header className="stat-card__head">
        <span className="stat-card__label">{stat.label}</span>
        <span className={`stat-card__delta ${good ? 'is-good' : 'is-bad'}`}>
          <span aria-hidden="true">{up ? '↑' : '↓'}</span>
          {Math.abs(stat.delta).toFixed(1)}%
        </span>
      </header>

      <strong className="stat-card__value">
        <Counter to={stat.value} decimals={stat.decimals ?? 0} suffix={stat.suffix ?? ''} />
      </strong>

      <svg className="stat-card__spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {/* Filled area under the line */}
        <polygon className="stat-card__area" points={`0,${H} ${points} ${W},${H}`} />
        {/* pathLength=1 keeps the draw animation identical for every series */}
        <polyline className="stat-card__line" points={points} pathLength={1} />
      </svg>

      <span className="stat-card__foot">vs. previous 30 days</span>
    </article>
  )
}
