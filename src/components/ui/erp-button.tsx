'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import {
  ERP_DANGER_BUTTON_CLASS,
  ERP_PRIMARY_BUTTON_CLASS,
  ERP_SECONDARY_BUTTON_CLASS,
} from '@/lib/ui/tokens'

type ErpButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  children: ReactNode
}

export function ErpButton({
  variant = 'primary',
  className = '',
  type = 'button',
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
    <button type={type} className={[base, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </button>
  )
}
