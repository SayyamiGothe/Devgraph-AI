import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useRoute } from '../../router'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { Logo } from '../ui/Logo'
import './Navbar.scss'

const LINKS = [
  { label: 'Platform', target: 'platform' },
  { label: 'Pipeline', target: 'pipeline' },
  { label: 'Graph', target: 'graph' },
  { label: 'Pricing', target: 'pricing' },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { status, user, logout } = useAuth()
  const navigate = useNavigate()
  const path = useRoute()

  // Condense the bar into a glass pill once the hero starts scrolling away.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Never leave the mobile sheet open behind a locked body.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  /**
   * The router owns `location.hash`, so section links cannot be plain anchors.
   * Scroll manually, hopping back to the landing page first when needed.
   */
  const goToSection = useCallback(
    (id: string) => {
      setOpen(false)
      const scroll = () =>
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

      if (path !== '/') {
        navigate('/')
        // Wait for the landing page to mount before looking for the section.
        requestAnimationFrame(() => requestAnimationFrame(scroll))
      } else {
        scroll()
      }
    },
    [navigate, path],
  )

  const authed = status === 'authenticated'

  return (
    <header className={`navbar ${scrolled ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`}>
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand" onClick={() => setOpen(false)}>
          <Logo size={34} />
        </Link>

        <nav className="navbar__links" aria-label="Sections">
          {LINKS.map((link) => (
            <button key={link.label} className="navbar__link" onClick={() => goToSection(link.target)}>
              <span>{link.label}</span>
            </button>
          ))}
        </nav>

        <div className="navbar__actions">
          {authed ? (
            <>
              <button className="navbar__user" onClick={() => navigate('/app')}>
                <span className="navbar__avatar">{(user?.email ?? '?').charAt(0).toUpperCase()}</span>
                <span className="navbar__email">{user?.email}</span>
              </button>
              <Button variant="ghost" size="sm" onClick={logout}>
                Sign out
              </Button>
              <Button size="sm" to="/app" iconRight={<span aria-hidden="true">→</span>}>
                Open console
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" to="/login">
                Sign in
              </Button>
              <Button size="sm" to="/register" iconRight={<span aria-hidden="true">→</span>}>
                Start free
              </Button>
            </>
          )}
        </div>

        <button
          className="navbar__burger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
        </button>
      </div>

      {/* Mobile sheet */}
      <div className="navbar__sheet" hidden={!open}>
        {LINKS.map((link, i) => (
          <button
            key={link.label}
            className="navbar__sheet-link"
            style={{ '--delay': `${i * 60}ms` } as CSSProperties}
            onClick={() => goToSection(link.target)}
          >
            {link.label}
          </button>
        ))}

        <div className="navbar__sheet-actions">
          {authed ? (
            <>
              <Button block to="/app" onClick={() => setOpen(false)}>
                Open console
              </Button>
              <Button
                block
                variant="outline"
                onClick={() => {
                  logout()
                  setOpen(false)
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button block variant="outline" to="/login" onClick={() => setOpen(false)}>
                Sign in
              </Button>
              <Button block to="/register" onClick={() => setOpen(false)}>
                Start free
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
