'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { ErpNumericTextInput } from '@/components/ui/erp-numeric-input'

type QuoteNumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string
  onChange: (value: string) => void
}

/** @deprecated Prefer ErpNumericTextInput — 견적/발주 호환용 래퍼 */
export const QuoteNumericInput = forwardRef<HTMLInputElement, QuoteNumericInputProps>(
  function QuoteNumericInput(props, ref) {
    return <ErpNumericTextInput ref={ref} integer={false} {...props} />
  },
)
