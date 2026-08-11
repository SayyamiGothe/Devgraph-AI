import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import './ui.scss'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: ReactNode
  error?: string | null
  icon?: ReactNode
  /** Shows a show/hide toggle and manages the input type. */
  revealable?: boolean
}

/**
 * Text input with a label that floats into the border once the field is focused
 * or filled.
 */
export function Field({
  label,
  hint,
  error,
  icon,
  revealable = false,
  className = '',
  value,
  type = 'text',
  ...rest
}: FieldProps) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const filled = value !== undefined && value !== null && String(value).length > 0

  return (
    <div
      className={[
        'form-field',
        filled ? 'is-filled' : '',
        error ? 'is-invalid' : '',
        icon ? 'has-icon' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="form-field__box">
        {icon && (
          <span className="form-field__icon" aria-hidden="true">
            {icon}
          </span>
        )}

        <input
          id={id}
          className="form-field__input"
          type={revealable && revealed ? 'text' : type}
          value={value}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...rest}
        />

        <label className="form-field__label" htmlFor={id}>
          {label}
        </label>

        {revealable && (
          <button
            type="button"
            className="form-field__reveal"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        )}

        <span className="form-field__underline" aria-hidden="true" />
      </div>

      {error ? (
        <p className="form-field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p className="form-field__hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  )
}
