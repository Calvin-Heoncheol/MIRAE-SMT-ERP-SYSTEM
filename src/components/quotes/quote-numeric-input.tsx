'use client'

import type { InputHTMLAttributes } from 'react'

type QuoteNumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

export function QuoteNumericInput({ value, onChange, onBlur, onFocus, ...props }: QuoteNumericInputProps) {
  return (
    <input
      {...props}
      type="number"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={(event) => {
        if (event.target.value === '0') onChange('')
        onFocus?.(event)
      }}
      onBlur={(event) => {
        if (event.target.value === '' || event.target.value === '-') onChange('0')
        onBlur?.(event)
      }}
    />
  )
}
