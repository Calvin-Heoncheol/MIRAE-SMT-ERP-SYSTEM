'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import {
  ERP_DANGER_BUTTON_CLASS,
  ERP_PRIMARY_BUTTON_CLASS,
  ERP_SECONDARY_BUTTON_CLASS,
} from '@/lib/ui/tokens'

type ErpButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  /** true면 스피너 + disabled */
  loading?: boolean
  children: ReactNode
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V2C5.373 2 2 5.373 2 12h2zm2 5.291A7.962 7.962 0 014 12H2c0 3.042 1.135 5.824 3 7.938l1-1.647z"
      />
    </svg>
  )
}

export function ErpButton({
  variant = 'primary',
  loading = false,
  className = '',
  type = 'button',
  disabled,
  children,
  ...props
}: ErpButtonProps) {
  const base =
    variant === 'primary'
      ? ERP_PRIMARY_BUTTON_CLASS
      : variant === 'danger'
        ? ERP_DANGER_BUTTON_CLASS
        : ERP_SECONDARY_BUTTON_CLASS

  return (
    <button
      type={type}
      className={[base, 'inline-flex items-center justify-center gap-1.5', className]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}
