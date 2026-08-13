import { useEffect, type ReactNode } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ConsoleDataProvider } from './context/ConsoleDataContext'
import { Logo } from './components/ui/Logo'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { NotFound } from './pages/NotFound'
import { Register } from './pages/Register'
import { Ask } from './pages/console/Ask'
import { Documents } from './pages/console/Documents'
import { GraphView } from './pages/console/GraphView'
import { Overview } from './pages/console/Overview'
import { Workspaces } from './pages/console/Workspaces'
import { RouterProvider, useNavigate, useRoute, useScrollReset } from './router'
import './App.scss'

function Splash({ label = 'Restoring session' }: { label?: string }) {
  return (
    <div className="splash">
      <div className="splash__inner">
        <Logo size={40} />
        <span className="splash__bar" />
        <span className="splash__text">{label}</span>
      </div>
    </div>
  )
}

/**
 * Console routes: wait for the session to resolve, require a user, then load
 * the organisation's workspace tree once for every page below.
 */
function Protected({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'anonymous') navigate('/login', { replace: true })
  }, [status, navigate])

  if (status === 'loading') return <Splash />
  if (status === 'anonymous') return <Splash label="Redirecting to sign in" />

  return <ConsoleDataProvider>{children}</ConsoleDataProvider>
}

/** Auth routes: a signed-in user has no business here. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'authenticated') navigate('/app', { replace: true })
  }, [status, navigate])

  if (status === 'authenticated') return <Splash label="Opening console" />

  return <>{children}</>
}

function Routes() {
  const path = useRoute()
  useScrollReset(path)

  const view = (() => {
    switch (path) {
      case '/':
        return <Landing />

      case '/login':
        return (
          <GuestOnly>
            <Login />
          </GuestOnly>
        )

      case '/register':
        return (
          <GuestOnly>
            <Register />
          </GuestOnly>
        )

      case '/app':
        return (
          <Protected>
            <Overview />
          </Protected>
        )

      case '/app/workspaces':
        return (
          <Protected>
            <Workspaces />
          </Protected>
        )

      case '/app/documents':
        return (
          <Protected>
            <Documents />
          </Protected>
        )

      case '/app/ask':
        return (
          <Protected>
            <Ask />
          </Protected>
        )

      case '/app/graph':
        return (
          <Protected>
            <GraphView />
          </Protected>
        )

      default:
        return <NotFound path={path} />
    }
  })()

  // Keyed on the path so every route change replays the entrance animation.
  return (
    <div className="route" key={path}>
      {view}
    </div>
  )
}

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </RouterProvider>
  )
}
