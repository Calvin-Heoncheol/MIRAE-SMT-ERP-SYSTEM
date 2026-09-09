'use client'

import {
  forwardRef,
  useEffect,
  useState,
  type InputHTMLAttributes,
} from 'react'

/** 앞에 붙은 0 제거 (020 → 20). 빈 값·소수·단독 0은 유지 */
export function stripLeadingZeros(value: string): string {
  if (value === '' || value === '-' || value === '.' || value === '-.') return value
  return value.replace(/^(-?)0+(?=\d)/, '$1')
}

export function sanitizeNumericInput(value: string, integer = false): string {
  let next = value.replace(integer ? /[^\d-]/g : /[^\d.-]/g, '')
  const negative = next.startsWith('-')
  next = next.replace(/-/g, '')
  if (!integer) {
    const dot = next.indexOf('.')
    if (dot !== -1) {
      next = `${next.slice(0, dot + 1)}${next.slice(dot + 1).replace(/\./g, '')}`
    }
  }
  if (negative) next = `-${next}`
  return stripLeadingZeros(next)
}

export function parseNumericInput(value: string, integer = false): number | null {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  return integer ? Math.trunc(parsed) : parsed
}

type ErpNumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'min' | 'max'
> & {
  /** 확정된 숫자 값 (부모 state) */
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  /** true면 정수만 (기본 true) */
  integer?: boolean
  /** 포커스 시 0이면 비움 (기본 true) */
  clearZeroOnFocus?: boolean
}

/**
 * 숫자 입력 — 입력 중 빈 칸/부분 입력을 허용하고, blur 때 min/max로 확정.
 * `Math.max(1, Number(value)||1)` 패턴의 백스페이스 버그를 막기 위한 공용 컴포넌트.
 */
export const ErpNumericInput = forwardRef<HTMLInputElement, ErpNumericInputProps>(
  function ErpNumericInput(
    {
      value,
      onValueChange,
      min = 0,
      max,
      integer = true,
      clearZeroOnFocus = true,
      onBlur,
      onFocus,
      onKeyDown,
      inputMode,
      ...props
    },
    ref,
  ) {
    const [text, setText] = useState(() => String(value))

    useEffect(() => {
      setText(String(value))
    }, [value])

    function commit(raw: string = text) {
      const parsed = parseNumericInput(raw, integer)
      let next = parsed == null ? min : parsed
      next = Math.max(min, next)
      if (max != null && Number.isFinite(max)) next = Math.min(max, next)
      if (integer) next = Math.trunc(next)
      setText(String(next))
      if (next !== value) onValueChange(next)
      else setText(String(next))
    }

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode={inputMode ?? (integer ? 'numeric' : 'decimal')}
        value={text}
        onChange={(event) => {
          const next = sanitizeNumericInput(event.target.value, integer)
          setText(next)
          const parsed = parseNumericInput(next, integer)
          if (parsed == null) return
          let live = parsed
          if (max != null && Number.isFinite(max)) live = Math.min(max, live)
          // 입력 중에는 min으로 끌어올리지 않음 (마지막 자리 삭제 허용)
          if (live !== value) onValueChange(live)
        }}
        onFocus={(event) => {
          if (clearZeroOnFocus && event.target.value === '0') {
            setText('')
          }
          requestAnimationFrame(() => event.target.select())
          onFocus?.(event)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget.value)
          onKeyDown?.(event)
        }}
        onBlur={(event) => {
          commit(event.target.value)
          onBlur?.(event)
        }}
      />
    )
  },
)

type ErpNumericTextInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value: string
  onChange: (value: string) => void
  integer?: boolean
  /** blur 시 빈 값이면 채울 값 (기본 '0') */
  emptyValue?: string
}

/** 문자열 state용 숫자 입력 (견적·발주 라인 등) */
export const ErpNumericTextInput = forwardRef<HTMLInputElement, ErpNumericTextInputProps>(
  function ErpNumericTextInput(
    { value, onChange, onBlur, onFocus, inputMode, integer = false, emptyValue = '0', ...props },
    ref,
  ) {
    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode={inputMode ?? (integer ? 'numeric' : 'decimal')}
        value={value}
        onChange={(event) => onChange(sanitizeNumericInput(event.target.value, integer))}
        onFocus={(event) => {
          if (event.target.value === '0') onChange('')
          requestAnimationFrame(() => event.target.select())
          onFocus?.(event)
        }}
        onBlur={(event) => {
          if (event.target.value === '' || event.target.value === '-' || event.target.value === '.') {
            onChange(emptyValue)
          }
          onBlur?.(event)
        }}
      />
    )
  },
)
