'use client'

import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { getDipUnitRates } from '@/lib/quotes/constants'
import { formatQuoteMoneyRateByDisplay } from '@/lib/quotes/format'
import type { DipBoardForm } from '@/lib/quotes/form-state'
import type { QuoteDisplayCurrency, QuoteType } from '@/lib/quotes/types'

type DipPcbBoardFormProps = {
  board: DipBoardForm
  quoteType: QuoteType
  displayCurrency?: QuoteDisplayCurrency
  boardIndex?: number
  boardCount?: number
  onChange: (board: DipBoardForm) => void
}

function UnitPreview({
  krw,
  quoteType,
  displayCurrency = 'krw',
}: {
  krw: number
  quoteType: QuoteType
  displayCurrency?: QuoteDisplayCurrency
}) {
  return (
    <span className="mt-1 block text-[11px] text-slate-400">
      {formatQuoteMoneyRateByDisplay(krw, quoteType, displayCurrency)}
    </span>
  )
}

export function DipPcbBoardForm({
  board,
  quoteType,
  displayCurrency = 'krw',
  boardIndex = 0,
  boardCount = 1,
  onChange,
}: DipPcbBoardFormProps) {
  const dipRates = getDipUnitRates(quoteType)

  function patch(patch: Partial<DipBoardForm>) {
    onChange({ ...board, ...patch })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      {boardCount > 1 ? (
        <p className="mb-3 text-sm font-semibold text-slate-800">보드 {boardIndex + 1}</p>
      ) : null}

      <p className="mb-2 text-xs font-semibold text-slate-600">수납땜</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['dipGeneral', '소형(1~3PIN)', dipRates.dipGeneral],
          ['dipConnector', '중형(4~10PIN)', dipRates.dipConnector],
          ['dipWire', '대형(11~19PIN)', dipRates.dipWire],
          ['dipXLarge', '초대형(20PIN+)', dipRates.dipXLarge],
        ].map(([key, label, unit]) => (
          <label key={key} className="text-xs font-medium text-slate-600">
            {label}
            <QuoteNumericInput
              min={0}
              value={board[key as keyof DipBoardForm]}
              onChange={(value) => patch({ [key]: value } as Partial<DipBoardForm>)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
            />
            <UnitPreview krw={unit as number} quoteType={quoteType} displayCurrency={displayCurrency} />
          </label>
        ))}
      </div>
    </div>
  )
}
