import type { CSSProperties, ReactNode } from 'react'
import { GraphField } from '../components/GraphField/GraphField'
import { Logo } from '../components/ui/Logo'
import { Link } from '../router'
import './Auth.scss'

const POINTS = [
  'Graph-native retrieval over your whole corpus',
  'Every answer cited to a page and a line',
  'Workspaces, projects and roles out of the box',
]

interface AuthLayoutProps {
  title: ReactNode
  subtitle: ReactNode
  children: ReactNode
  /** Link shown under the form. */
  footer: ReactNode
}

/** Split-screen shell shared by the sign-in and sign-up screens. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth">
      {/* ---- Brand side ---- */}
      <aside className="auth__aside">
        <GraphField density={34} />
        <div className="auth__aside-glow" aria-hidden="true" />

        <div className="auth__aside-inner">
          <Link to="/" className="auth__brand">
            <Logo size={36} />
          </Link>

          <div className="auth__pitch">
            <h2>
              The graph behind
              <br />
              your <span className="text-gradient">documents</span>.
            </h2>

            <ul className="auth__points">
              {POINTS.map((point, i) => (
                <li key={point} style={{ '--delay': `${240 + i * 130}ms` } as CSSProperties}>
                  <span className="auth__tick" aria-hidden="true">
                    ✓
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <figure className="auth__quote">
            <blockquote>
              “We replaced three weeks of manual contract review with a query. The citations are what
              made legal sign off.”
            </blockquote>
            <figcaption>
              <span className="auth__avatar">A</span>
              <span>
                <strong>Aparna Iyer</strong>
                Head of Platform, Northwind
              </span>
            </figcaption>
          </figure>
        </div>
      </aside>

      {/* ---- Form side ---- */}
      <main className="auth__main">
        <div className="auth__card">
          <Link to="/" className="auth__brand auth__brand--mobile">
            <Logo size={32} />
          </Link>

          <header className="auth__head">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </header>

          {children}

          <footer className="auth__foot">{footer}</footer>
        </div>
      </main>
    </div>
  )
}
