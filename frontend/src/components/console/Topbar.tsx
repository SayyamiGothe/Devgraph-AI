import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { RECENT_QUERIES } from '../../lib/mock'

interface TopbarProps {
  title: string
  subtitle: string
  onMenu: () => void
}

export function Topbar({ title, subtitle, onMenu }: TopbarProps) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // ⌘K / Ctrl+K focuses search, Escape closes whatever is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape') {
        setMenuOpen(false)
        searchRef.current?.blur()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Dismiss the user menu on any outside click.
  useEffect(() => {
    if (!menuOpen) return

    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }

    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  const suggestions = query
    ? RECENT_QUERIES.filter((q) => q.toLowerCase().includes(query.toLowerCase()))
    : RECENT_QUERIES

  const initial = (user?.email ?? '?').charAt(0).toUpperCase()

  return (
    <header className="topbar">
      <button className="topbar__menu" onClick={onMenu} aria-label="Open navigation">
        <span />
        <span />
        <span />
      </button>

      <div className="topbar__titles">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className={`topbar__search ${focused ? 'is-focused' : ''}`}>
        <span className="topbar__search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          ref={searchRef}
          value={query}
          placeholder="Ask the graph…"
          aria-label="Ask the graph"
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          // Delay so a click on a suggestion still registers.
          onBlur={() => window.setTimeout(() => setFocused(false), 140)}
        />
        <kbd className="topbar__kbd">⌘K</kbd>

        {focused && (
          <div className="topbar__suggest">
            <span className="topbar__suggest-label">Recent queries</span>
            {suggestions.length === 0 && <p className="topbar__suggest-empty">No matches.</p>}
            {suggestions.map((suggestion, i) => (
              <button
                key={suggestion}
                className="topbar__suggest-item"
                style={{ animationDelay: `${i * 45}ms` }}
                onClick={() => setQuery(suggestion)}
              >
                <span aria-hidden="true">↩</span>
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="topbar__actions">
        <button className="topbar__bell" aria-label="Notifications">
          ◔
          <span className="topbar__bell-dot" aria-hidden="true" />
        </button>

        <div className="topbar__user" ref={menuRef}>
          <button
            className="topbar__user-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
          >
            <span className="topbar__avatar">{initial}</span>
            <span className="topbar__user-meta">
              <strong>{user?.email ?? 'Signed out'}</strong>
              <em>org #{user?.organisation_id ?? '—'}</em>
            </span>
            <span className={`topbar__caret ${menuOpen ? 'is-up' : ''}`} aria-hidden="true">
              ⌄
            </span>
          </button>

          {menuOpen && (
            <div className="topbar__menu-pop">
              <div className="topbar__menu-head">
                <span className="topbar__avatar">{initial}</span>
                <span>
                  <strong>{user?.email}</strong>
                  {/* /auth/me does not return a role today, so this falls back. */}
                  <em>{user?.role ?? 'USER'}</em>
                </span>
              </div>

              <button className="topbar__menu-item">Account settings</button>
              <button className="topbar__menu-item">API keys</button>
              <button className="topbar__menu-item">Billing</button>

              <div className="topbar__menu-foot">
                <Button variant="outline" size="sm" block onClick={logout}>
                  Sign out
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
