import { Link } from '../../router'
import { Logo } from '../ui/Logo'
import './Footer.scss'

const COLUMNS = [
  {
    title: 'Product',
    links: ['Knowledge graph', 'Semantic search', 'Extraction', 'Workspaces', 'Projects'],
  },
  {
    title: 'Developers',
    links: ['REST API', 'Python SDK', 'Webhooks', 'Self-hosting', 'Status'],
  },
  {
    title: 'Company',
    links: ['About', 'Careers', 'Security', 'Privacy', 'Contact'],
  },
]

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <Logo size={36} />
          <p>
            Document intelligence for engineering teams. Ingest anything, get a graph you can
            actually query.
          </p>

          <div className="site-footer__status">
            <span className="dot" />
            All systems operational
          </div>
        </div>

        {COLUMNS.map((column) => (
          <nav className="site-footer__col" key={column.title} aria-label={column.title}>
            <h4>{column.title}</h4>
            <ul>
              {column.links.map((link) => (
                <li key={link}>
                  <a href="#/">{link}</a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="container site-footer__bottom">
        <span>© {new Date().getFullYear()} DevGraph AI. Built with FastAPI + React.</span>
        <div className="site-footer__bottom-links">
          <Link to="/login">Sign in</Link>
          <Link to="/register">Create account</Link>
        </div>
      </div>
    </footer>
  )
}
