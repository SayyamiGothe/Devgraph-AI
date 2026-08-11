import { Reveal } from '../Reveal/Reveal'
import { useReveal } from '../../hooks/useReveal'

const STEPS = [
  {
    n: '01',
    title: 'Ingest',
    body: 'Drop a folder, connect a bucket, or POST to the API. Layout-aware parsing keeps tables, headings and footnotes intact.',
    meta: 'PDF · DOCX · MD · HTML',
  },
  {
    n: '02',
    title: 'Extract',
    body: 'Entities, dates, obligations and owners are pulled into typed records against your schema, with a confidence per field.',
    meta: 'schema-guided',
  },
  {
    n: '03',
    title: 'Link',
    body: 'References, versions and contradictions become edges. The graph is where "this clause overrides that one" actually lives.',
    meta: '64k edges/min',
  },
  {
    n: '04',
    title: 'Query',
    body: 'Ask in plain language. DevGraph plans a traversal, gathers evidence, and answers with citations you can click.',
    meta: 'p50 420ms',
  },
]

export function Pipeline() {
  // The connector line draws itself once the rail scrolls into view.
  const rail = useReveal<HTMLDivElement>({ threshold: 0.25 })

  return (
    <section className="section pipeline" id="pipeline">
      <div className="container">
        <div className="section-head">
          <Reveal variant="fade">
            <span className="eyebrow">Pipeline</span>
          </Reveal>
          <Reveal variant="up" delay={80}>
            <h2>
              Four stages, <span className="text-gradient">fully observable</span>
            </h2>
          </Reveal>
          <Reveal variant="up" delay={160}>
            <p className="lead">
              Each stage emits events, so you can watch a document move through the system instead of
              guessing why an answer came out thin.
            </p>
          </Reveal>
        </div>

        <div className={`pipeline__rail ${rail.visible ? 'is-visible' : ''}`} ref={rail.ref}>
          {/* The line behind the cards */}
          <span className="pipeline__line" aria-hidden="true">
            <span className="pipeline__line-fill" />
            <span className="pipeline__line-pulse" />
          </span>

          {STEPS.map((step, i) => (
            <Reveal variant="up" delay={i * 130} className="pipeline__cell" key={step.n}>
              <article className="step">
                <span className="step__marker" aria-hidden="true">
                  <span className="step__marker-core" />
                </span>

                <span className="step__n text-mono">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <span className="step__meta text-mono">{step.meta}</span>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
