import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useNavigate } from '../../router'
import { Spinner } from './Spinner'
import './ui.scss'

type Variant = 'primary' | 'ghost' | 'outline' | 'subtle' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Renders a spinner and blocks interaction. */
  loading?: boolean
  /** Navigate on click instead of firing a handler. */
  to?: string
  iconRight?: ReactNode
  iconLeft?: ReactNode
  block?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  to,
  iconLeft,
  iconRight,
  block = false,
  className = '',
  children,
  disabled,
  onClick,
  ...rest
}: ButtonProps) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      className={[
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        block ? 'btn--block' : '',
        loading ? 'is-loading' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented && to) navigate(to)
      }}
      {...rest}
    >
      {/* Sheen sweeps across on hover — purely decorative. */}
      <span className="btn__sheen" aria-hidden="true" />

      {loading ? <Spinner size={16} /> : iconLeft}
      <span className="btn__label">{children}</span>
      {iconRight && !loading && <span className="btn__icon">{iconRight}</span>}
    </button>
  )
}
