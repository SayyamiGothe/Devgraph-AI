import type { CSSProperties } from 'react'
import { GraphField } from '../GraphField/GraphField'
import { Button } from '../ui/Button'
import { Counter } from '../ui/Counter'
import { TypingText } from '../ui/TypingText'
import { useTilt } from '../../hooks/useTilt'

const HEADLINE = ['Turn', 'scattered', 'documents', 'into', 'a', 'graph']

const QUERIES = [
  'Which contracts renew before Q4 and mention data residency?',
  'Show every spec that depends on the billing service.',
  'Who approved the SOC 2 exception, and where is it recorded?',
]

const CITATIONS = [
  { label: 'MSA-2026-014.pdf', page: 'p. 12' },
  { label: 'billing-spec.md', page: '§4.2' },
  { label: 'ADR-0031.md', page: 'p. 3' },
]

export function Hero() {
  const tilt = useTilt(5)

  return (
    <section className="hero">
      <GraphField density={46} />

      {/* Aurora blobs behind the copy */}
      <div className="hero__aurora hero__aurora--a" aria-hidden="true" />
      <div className="hero__aurora hero__aurora--b" aria-hidden="true" />

      <div className="container hero__inner">
        <div className="hero__copy">
          <span className="eyebrow animate-in">
            <span className="dot" />
            GenAI document intelligence
          </span>

          <h1 className="hero__title">
            {/* Each word rises independently for a staggered entrance. */}
            {HEADLINE.map((word, i) => (
              <span
                className="hero__word"
                key={word + i}
                style={{ '--delay': `${120 + i * 85}ms` } as CSSProperties}
              >
                {word}
              </span>
            ))}
            <span
              className="hero__word hero__word--accent"
              style={{ '--delay': `${120 + HEADLINE.length * 85}ms` } as CSSProperties}
            >
              you can query.
            </span>
          </h1>

          <p className="lead animate-in" style={{ '--delay': '760ms' } as CSSProperties}>
            DevGraph AI ingests contracts, specs, tickets and wikis, extracts the entities that
            matter, and links them into a single knowledge graph — every answer cited back to the
            exact source line.
          </p>

          <div className="hero__cta animate-in" style={{ '--delay': '880ms' } as CSSProperties}>
            <Button size="lg" to="/register" iconRight={<span aria-hidden="true">→</span>}>
              Start building free
            </Button>
            <Button size="lg" variant="outline" to="/login">
              Sign in to console
            </Button>
          </div>

          <dl className="hero__stats animate-in" style={{ '--delay': '1000ms' } as CSSProperties}>
            <div>
              <dt>Pages indexed</dt>
              <dd>
                <Counter to={12.4} decimals={1} suffix="M" />
              </dd>
            </div>
            <div>
              <dt>Extraction F1</dt>
              <dd>
                <Counter to={96.3} decimals={1} suffix="%" />
              </dd>
            </div>
            <div>
              <dt>Median query</dt>
              <dd>
                <Counter to={420} suffix="ms" />
              </dd>
            </div>
          </dl>
        </div>

        {/* Floating console preview */}
        <div
          className="hero__console animate-in"
          style={{ '--delay': '520ms' } as CSSProperties}
          ref={tilt.ref}
          onPointerMove={tilt.onPointerMove}
          onPointerLeave={tilt.onPointerLeave}
        >
          <div className="hero__console-inner">
            <header className="hero__console-bar">
              <span className="hero__lights" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="text-mono hero__console-path">devgraph · acme-platform</span>
              <span className="badge badge--mint">
                <span className="dot" />
                live
              </span>
            </header>

            <div className="hero__prompt">
              <span className="hero__prompt-icon" aria-hidden="true">
                ⌕
              </span>
              <TypingText phrases={QUERIES} className="hero__prompt-text text-mono" />
            </div>

            <div className="hero__answer">
              <div className="hero__answer-head">
                <span className="hero__spark" aria-hidden="true" />
                Synthesised from 3 sources
              </div>

              <div className="hero__lines" aria-hidden="true">
                {[92, 78, 96, 64].map((width, i) => (
                  <span
                    key={i}
                    style={{ width: `${width}%`, '--delay': `${1200 + i * 130}ms` } as CSSProperties}
                  />
                ))}
              </div>

              <div className="hero__citations">
                {CITATIONS.map((citation, i) => (
                  <span
                    className="hero__citation"
                    key={citation.label}
                    style={{ '--delay': `${1700 + i * 120}ms` } as CSSProperties}
                  >
                    <em>{citation.label}</em>
                    {citation.page}
                  </span>
                ))}
              </div>
            </div>

            <footer className="hero__console-foot">
              {[
                { label: 'Docs', value: '1,284' },
                { label: 'Entities', value: '18,902' },
                { label: 'Edges', value: '64,331' },
              ].map((metric) => (
                <div key={metric.label}>
                  <span>{metric.label}</span>
                  <strong className="text-mono">{metric.value}</strong>
                </div>
              ))}
            </footer>
          </div>

          {/* Detached chips that hover beside the console */}
          <div className="hero__chip hero__chip--one anim-float">
            <strong>PDF · 312 pages</strong>
            <span>parsed in 4.2s</span>
          </div>
          <div className="hero__chip hero__chip--two anim-float-slow">
            <strong>+1,204 edges</strong>
            <span>graph updated</span>
          </div>
        </div>
      </div>

      {/* The router owns the URL hash, so this scrolls in JS rather than linking. */}
      <button
        className="hero__scroll"
        aria-label="Scroll to platform"
        onClick={() =>
          document.getElementById('platform')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      >
        <span />
      </button>
    </section>
  )
}
