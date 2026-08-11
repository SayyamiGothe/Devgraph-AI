import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Link, useNavigate } from '../router'
import { AuthLayout } from './AuthLayout'

const STRENGTH_LABEL = ['Too short', 'Weak', 'Fair', 'Strong', 'Excellent']

/** Cheap local heuristic — the backend is the real authority on validity. */
function scorePassword(value: string): number {
  if (value.length < 8) return 0
  let score = 1
  if (value.length >= 12) score += 1
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1
  return Math.min(score, 4)
}

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [org, setOrg] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)

  const strength = useMemo(() => scorePassword(password), [password])
  const mismatch = confirm.length > 0 && confirm !== password

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return

    const organisationId = Number(org)
    if (!Number.isInteger(organisationId) || organisationId <= 0) {
      setError('Organisation ID must be a positive whole number.')
      setShake((n) => n + 1)
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      setShake((n) => n + 1)
      return
    }

    setError(null)
    setBusy(true)

    try {
      await register(email.trim(), password, organisationId)
      navigate('/app')
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 400 || err.status === 409
            ? err.message
            : err.status === 422
              ? `Validation failed — ${err.message}`
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
          Create your <span className="text-gradient">workspace</span>
        </>
      }
      subtitle="Register a user against an existing organisation."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="auth__form" onSubmit={onSubmit} noValidate>
        {error && (
          <div className="alert anim-shake" key={shake}>
            <span aria-hidden="true">⚠</span>
            <span>
              <strong>Could not register. </strong>
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
          label="Organisation ID"
          type="number"
          name="organisation_id"
          min={1}
          required
          value={org}
          icon={<span aria-hidden="true">#</span>}
          hint="The numeric ID of an organisation that already exists in the database."
          onChange={(event) => setOrg(event.target.value)}
        />

        <div className="auth__password">
          <Field
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            revealable
            value={password}
            icon={<span aria-hidden="true">•••</span>}
            onChange={(event) => setPassword(event.target.value)}
          />

          {/* Four segments that fill as the password gets stronger. */}
          <div className="password-strength" aria-hidden="true">
            <div className="password-strength__bars">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`password-strength__bar ${i < strength ? 'is-on' : ''}`}
                  style={{ '--delay': `${i * 60}ms` } as CSSProperties}
                />
              ))}
            </div>
            <span className={`password-strength__label is-${strength}`}>
              {password.length === 0 ? '' : STRENGTH_LABEL[strength]}
            </span>
          </div>
        </div>

        <Field
          label="Confirm password"
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          revealable
          value={confirm}
          icon={<span aria-hidden="true">•••</span>}
          error={mismatch ? 'Passwords do not match' : null}
          onChange={(event) => setConfirm(event.target.value)}
        />

        <Button type="submit" size="lg" block loading={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>

        <p className="auth__note">
          By continuing you agree to the terms of service. Registration hits{' '}
          <code>POST /auth/register</code>, then signs you in automatically.
        </p>
      </form>
    </AuthLayout>
  )
}
