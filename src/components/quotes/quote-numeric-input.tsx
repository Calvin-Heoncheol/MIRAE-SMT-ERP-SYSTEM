'use client'

import type { InputHTMLAttributes } from 'react'

type QuoteNumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

/** 앞에 붙은 0 제거 (020 → 20). 빈 값·소수·단독 0은 유지 */
function stripLeadingZeros(value: string): string {
  if (value === '' || value === '-' || value === '.' || value === '-.') return value
  if (/^-?0\d/.test(value)) return String(Number(value))
  return value
}

export function QuoteNumericInput({ value, onChange, onBlur, onFocus, ...props }: QuoteNumericInputProps) {
  return (
    <input
      {...props}
      type="number"
      value={value}
      onChange={(event) => onChange(stripLeadingZeros(event.target.value))}
      onFocus={(event) => {
        if (event.target.value === '0') onChange('')
        requestAnimationFrame(() => event.target.select())
        onFocus?.(event)
      }}
      onBlur={(event) => {
        if (event.target.value === '' || event.target.value === '-') onChange('0')
        onBlur?.(event)
      }}
    />
  )
}
