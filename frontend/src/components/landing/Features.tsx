import type { CSSProperties } from 'react'
import { Reveal } from '../Reveal/Reveal'
import { useTilt } from '../../hooks/useTilt'

interface Feature {
  icon: string
  title: string
  body: string
  tone: 'violet' | 'cyan' | 'pink' | 'mint'
  tag: string
}

const FEATURES: Feature[] = [
  {
    icon: '◈',
    title: 'Graph-native retrieval',
    body: 'Chunks are linked, not just embedded. Traverse from a clause to the spec it constrains to the ticket that changed it.',
    tone: 'violet',
    tag: 'retrieval',
  },
  {
    icon: '⌘',
    title: 'Structured extraction',
    body: 'Define a schema once and pull typed fields — parties, dates, thresholds, owners — out of every document that arrives.',
    tone: 'cyan',
    tag: 'extraction',
  },
  {
    icon: '❋',
    title: 'Grounded answers',
    body: 'Every sentence carries a citation to a page and line. If the graph cannot support a claim, the model says so.',
    tone: 'pink',
    tag: 'rag',
  },
  {
    icon: '⧉',
    title: 'Workspaces & projects',
    body: 'Organisations hold workspaces, workspaces hold projects. Access follows the same tree, so scoping is never ambiguous.',
    tone: 'mint',
    tag: 'tenancy',
  },
  {
    icon: '⟳',
    title: 'Incremental re-index',
    body: 'A changed page re-embeds only its own subtree. Graph edges are patched in place instead of rebuilt overnight.',
    tone: 'violet',
    tag: 'pipeline',
  },
  {
    icon: '⛨',
    title: 'Role-aware by default',
    body: 'JWT auth with roles enforced at the dependency layer, so an endpoint cannot accidentally ship without a guard.',
    tone: 'cyan',
    tag: 'security',
  },
]

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const tilt = useTilt(6)

  return (
    <Reveal variant="up" delay={index * 90} className="feature-card-wrap">
      <article
        className={`feature-card feature-card--${feature.tone}`}
        ref={tilt.ref}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
      >
        {/* Cursor-following spotlight, positioned from --mouse-x/--mouse-y. */}
        <span className="feature-card__spot" aria-hidden="true" />

        <span className="feature-card__icon" aria-hidden="true">
          {feature.icon}
        </span>

        <h3>{feature.title}</h3>
        <p>{feature.body}</p>

        <span className="feature-card__tag text-mono">{feature.tag}</span>
      </article>
    </Reveal>
  )
}

export function Features() {
  return (
    <section className="section features" id="platform">
      <div className="container">
        <div className="section-head">
          <Reveal variant="fade">
            <span className="eyebrow">The platform</span>
          </Reveal>
          <Reveal variant="up" delay={80}>
            <h2>
              Retrieval that understands <span className="text-gradient">structure</span>
            </h2>
          </Reveal>
          <Reveal variant="up" delay={160}>
            <p className="lead">
              Flat vector search forgets that documents reference each other. DevGraph keeps those
              references as first-class edges, so answers can walk the same path a reviewer would.
            </p>
          </Reveal>
        </div>

        <div className="features__grid">
          {FEATURES.map((feature, i) => (
            <FeatureCard feature={feature} index={i} key={feature.title} />
          ))}
        </div>

        {/* Wide callout under the grid */}
        <Reveal variant="scale" delay={120}>
          <div className="callout">
            <div className="callout__copy">
              <span className="badge badge--violet">Benchmark</span>
              <h3>
                34% fewer unsupported claims than flat RAG on the same corpus
              </h3>
              <p>
                Measured across 4,200 questions over a 1.2M page mixed corpus of contracts, specs
                and incident reports.
              </p>
            </div>

            <div className="callout__bars" aria-hidden="true">
              {[
                { label: 'DevGraph', value: 96, tone: 'grad' },
                { label: 'Hybrid', value: 78, tone: 'cyan' },
                { label: 'Flat RAG', value: 62, tone: 'dim' },
              ].map((bar, i) => (
                <div className="callout__bar" key={bar.label}>
                  <span className="callout__bar-label">{bar.label}</span>
                  <span className="callout__bar-track">
                    <span
                      className={`callout__bar-fill is-${bar.tone}`}
                      style={{ '--fill': `${bar.value}%`, '--delay': `${i * 160}ms` } as CSSProperties}
                    />
                  </span>
                  <span className="callout__bar-value text-mono">{bar.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
