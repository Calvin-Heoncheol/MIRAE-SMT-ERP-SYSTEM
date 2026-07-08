'use client'

import type { QuoteDisplayCurrency } from '@/lib/quotes/types'

type QuoteCurrencyToggleProps = {
  value: QuoteDisplayCurrency
  onChange: (value: QuoteDisplayCurrency) => void
}

export function QuoteCurrencyToggle({ value, onChange }: QuoteCurrencyToggleProps) {
  return (
    <div
      className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
      role="group"
      aria-label="표시 통화"
    >
      <button
        type="button"
        onClick={() => onChange('usd')}
        className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
          value === 'usd'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        USD
      </button>
      <button
        type="button"
        onClick={() => onChange('krw')}
        className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
          value === 'krw'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        KRW
      </button>
    </div>
  )
}
