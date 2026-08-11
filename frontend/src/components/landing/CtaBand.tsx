import { GraphField } from '../GraphField/GraphField'
import { Reveal } from '../Reveal/Reveal'
import { Button } from '../ui/Button'

export function CtaBand() {
  return (
    <section className="cta">
      <div className="container">
        <Reveal variant="scale">
          <div className="cta__panel">
            <GraphField density={30} interactive={false} className="cta__field" />

            <div className="cta__content">
              <span className="eyebrow">Get started</span>
              <h2>
                Point it at your documents.
                <br />
                See the graph in <span className="text-gradient">ten minutes</span>.
              </h2>
              <p className="lead">
                Free to start, no card required. Bring a folder of PDFs and watch the first edges
                appear while the rest is still parsing.
              </p>

              <div className="cta__actions">
                <Button size="lg" to="/register" iconRight={<span aria-hidden="true">→</span>}>
                  Create your workspace
                </Button>
                <Button size="lg" variant="ghost" to="/login">
                  I already have an account
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
