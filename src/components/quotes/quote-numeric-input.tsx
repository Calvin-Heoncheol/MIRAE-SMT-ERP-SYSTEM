'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'

type QuoteNumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string
  onChange: (value: string) => void
}

/** 앞에 붙은 0 제거 (020 → 20). 빈 값·소수·단독 0은 유지 */
function stripLeadingZeros(value: string): string {
  if (value === '' || value === '-' || value === '.' || value === '-.') return value
  return value.replace(/^(-?)0+(?=\d)/, '$1')
}

function sanitizeNumericInput(value: string): string {
  // 숫자·소수점·맨 앞 마이너스만 허용
  let next = value.replace(/[^\d.-]/g, '')
  const negative = next.startsWith('-')
  next = next.replace(/-/g, '')
  const dot = next.indexOf('.')
  if (dot !== -1) {
    next = `${next.slice(0, dot + 1)}${next.slice(dot + 1).replace(/\./g, '')}`
  }
  if (negative) next = `-${next}`
  return stripLeadingZeros(next)
}

export const QuoteNumericInput = forwardRef<HTMLInputElement, QuoteNumericInputProps>(
  function QuoteNumericInput({ value, onChange, onBlur, onFocus, inputMode, ...props }, ref) {
    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode={inputMode ?? 'decimal'}
        value={value}
        onChange={(event) => onChange(sanitizeNumericInput(event.target.value))}
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
  },
)
