import { GraphField } from '../components/GraphField/GraphField'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'
import { Link } from '../router'
import './NotFound.scss'

export function NotFound({ path }: { path: string }) {
  return (
    <div className="not-found">
      <GraphField density={30} />

      <div className="not-found__inner">
        <Link to="/" className="not-found__brand">
          <Logo size={34} />
        </Link>

        <span className="not-found__code">404</span>
        <h1>
          This node has no <span className="text-gradient">edges</span>
        </h1>
        <p className="lead">
          Nothing is routed at <code>#{path}</code>. It may have moved, or never existed.
        </p>

        <div className="not-found__actions">
          <Button size="lg" to="/">
            Back to home
          </Button>
          <Button size="lg" variant="outline" to="/app">
            Open console
          </Button>
        </div>
      </div>
    </div>
  )
}
