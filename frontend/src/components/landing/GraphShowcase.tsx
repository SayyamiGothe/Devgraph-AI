import { KnowledgeGraph } from '../graph/KnowledgeGraph'
import { Reveal } from '../Reveal/Reveal'

export function GraphShowcase() {
  return (
    <section className="section knowledge-graph" id="graph">
      <div className="container">
        <div className="section-head">
          <Reveal variant="fade">
            <span className="eyebrow">The graph</span>
          </Reveal>
          <Reveal variant="up" delay={80}>
            <h2>
              Every document, <span className="text-gradient">in context</span>
            </h2>
          </Reveal>
          <Reveal variant="up" delay={160}>
            <p className="lead">
              Hover to trace a node's neighbourhood, click to inspect it. This is the same view your
              team gets over their own corpus.
            </p>
          </Reveal>
        </div>

        <Reveal variant="scale">
          <KnowledgeGraph />
        </Reveal>
      </div>
    </section>
  )
}
