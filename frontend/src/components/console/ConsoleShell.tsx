import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import './console.scss'

interface ConsoleShellProps {
  title: string
  subtitle: string
  children: ReactNode
}

/** Sidebar + topbar frame shared by every console route. */
export function ConsoleShell({ title, subtitle, children }: ConsoleShellProps) {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="console">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="console__main">
        <Topbar title={title} subtitle={subtitle} onMenu={() => setNavOpen(true)} />

        {/* Keyed on the title so switching routes replays the entrance. */}
        <div className="console__body" key={title}>
          {children}
        </div>
      </div>
    </div>
  )
}
