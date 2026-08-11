import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Link, useNavigate } from '../router'
import { AuthLayout } from './AuthLayout'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Bumped on each failure to re-key (and therefore replay) the shake.
  const [shake, setShake] = useState(0)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return

    setError(null)
    setBusy(true)

    try {
      await login(email.trim(), password)
      navigate('/app')
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? 'That email and password combination did not match.'
            : err.message
          : 'Something went wrong. Please try again.'
      setError(message)
      setShake((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={
        <>
          Welcome <span className="text-gradient">back</span>
        </>
      }
      subtitle="Sign in to your DevGraph console."
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className="auth__form" onSubmit={onSubmit} noValidate>
        {error && (
          <div className="alert anim-shake" key={shake}>
            <span aria-hidden="true">⚠</span>
            <span>
              <strong>Could not sign in. </strong>
              {error}
            </span>
          </div>
        )}

        <Field
          label="Work email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          icon={<span aria-hidden="true">@</span>}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Field
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          revealable
          value={password}
          icon={<span aria-hidden="true">•••</span>}
          onChange={(event) => setPassword(event.target.value)}
        />

        <div className="auth__row">
          <label className="auth__check">
            <input type="checkbox" defaultChecked />
            <span className="auth__box" aria-hidden="true" />
            Keep me signed in
          </label>
          <a href="#/login" className="auth__link">
            Forgot password?
          </a>
        </div>

        <Button type="submit" size="lg" block loading={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>

        <p className="auth__note">
          Needs the FastAPI server running on <code>:8000</code> — the dev server proxies{' '}
          <code>/api</code> to it.
        </p>
      </form>
    </AuthLayout>
  )
}
