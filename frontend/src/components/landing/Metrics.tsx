import { Reveal } from '../Reveal/Reveal'
import { Counter } from '../ui/Counter'

const METRICS = [
  { to: 1.2, decimals: 1, suffix: 'M', label: 'Pages per hour', note: 'sustained ingest on 4 workers' },
  { to: 96.3, decimals: 1, suffix: '%', label: 'Field-level F1', note: 'schema extraction, mixed corpus' },
  { to: 420, suffix: 'ms', label: 'Median query', note: 'graph traversal + synthesis' },
  { to: 99.98, decimals: 2, suffix: '%', label: 'Ingest success', note: 'trailing 90 days' },
]

export function Metrics() {
  return (
    <section className="metrics">
      <div className="container">
        <div className="metrics__grid">
          {METRICS.map((metric, i) => (
            <Reveal variant="up" delay={i * 110} key={metric.label} className="metric">
              <strong className="metric__value">
                <Counter to={metric.to} decimals={metric.decimals} suffix={metric.suffix} />
              </strong>
              <span className="metric__label">{metric.label}</span>
              <span className="metric__note">{metric.note}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
