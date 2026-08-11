import type { CSSProperties } from 'react'
import { Link, useRoute } from '../../router'
import { Logo } from '../ui/Logo'
import { WORKSPACES } from '../../lib/mock'

const NAV = [
  { to: '/app', label: 'Overview', icon: '◈' },
  { to: '/app/workspaces', label: 'Workspaces', icon: '⧉' },
  { to: '/app/documents', label: 'Documents', icon: '❐' },
  { to: '/app/graph', label: 'Graph', icon: '⁂' },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const path = useRoute()

  return (
    <>
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar__top">
          <Link to="/" className="sidebar__brand">
            <Logo size={30} />
          </Link>
        </div>

        <nav className="sidebar__nav" aria-label="Console">
          <span className="sidebar__label">Console</span>

          {NAV.map((item, i) => {
            const active = path === item.to

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`sidebar__item ${active ? 'is-active' : ''}`}
                style={{ '--delay': `${i * 60}ms` } as CSSProperties}
                onClick={onClose}
              >
                {/* Gradient rail marking the active route. */}
                <span className="sidebar__rail" aria-hidden="true" />
                <span className="sidebar__icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            )
          })}

          <span className="sidebar__label">Workspaces</span>

          <ul className="sidebar__tree">
            {WORKSPACES.map((workspace) => (
              <li key={workspace.id}>
                <span className="sidebar__tree-head">
                  <i aria-hidden="true" />
                  {workspace.name}
                  <em>{workspace.projects.length}</em>
                </span>

                <ul>
                  {workspace.projects.map((project) => (
                    <li key={project.id}>
                      <Link to="/app/workspaces" className="sidebar__tree-item" onClick={onClose}>
                        {project.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar__foot">
          <div className="sidebar__usage">
            <div className="flex-between">
              <span>Pages this month</span>
              <strong className="text-mono">64%</strong>
            </div>
            <span className="sidebar__usage-track">
              <span className="sidebar__usage-fill" style={{ '--fill': '64%' } as CSSProperties} />
            </span>
            <span className="sidebar__usage-note">160k of 250k on the Team plan</span>
          </div>
        </div>
      </aside>

      {/* Scrim for the mobile drawer */}
      <button
        className={`sidebar__scrim ${open ? 'is-on' : ''}`}
        onClick={onClose}
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
      />
    </>
  )
}
