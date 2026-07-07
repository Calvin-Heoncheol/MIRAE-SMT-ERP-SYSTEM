'use client'

import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { DIP_UNIT } from '@/lib/quotes/constants'
import { formatQuoteKrw } from '@/lib/quotes/format'
import type { DipBoardForm } from '@/lib/quotes/form-state'
import type { QuoteType } from '@/lib/quotes/types'

type DipPcbBoardFormProps = {
  board: DipBoardForm
  quoteType: QuoteType
  onChange: (board: DipBoardForm) => void
}

function UnitPreview({ krw }: { krw: number; quoteType: QuoteType }) {
  return <span className="mt-1 block text-[11px] text-slate-400">{formatQuoteKrw(krw)}</span>
}

export function DipPcbBoardForm({ board, quoteType, onChange }: DipPcbBoardFormProps) {
  function patch(patch: Partial<DipBoardForm>) {
    onChange({ ...board, ...patch })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-800">■ {board.pcbName}</p>

      <p className="mb-2 text-xs font-semibold text-slate-600">수납땜</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          ['dipGeneral', '소형(1~3PIN)', DIP_UNIT.dipGeneral],
          ['dipConnector', '중형(4~10PIN)', DIP_UNIT.dipConnector],
          ['dipWire', '대형(10PIN+)', DIP_UNIT.dipWire],
        ].map(([key, label, unit]) => (
          <label key={key} className="text-xs font-medium text-slate-600">
            {label}
            <QuoteNumericInput
              min={0}
              value={board[key as keyof DipBoardForm]}
              onChange={(value) => patch({ [key]: value } as Partial<DipBoardForm>)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
            />
            <UnitPreview krw={unit as number} quoteType={quoteType} />
          </label>
        ))}
      </div>

      <p className="mb-2 mt-4 text-xs font-semibold text-slate-600">WAVE</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          ['waveGeneral', '일반(1~3PIN)', DIP_UNIT.waveGeneral],
          ['waveConnector', '중형(4~10PIN)', DIP_UNIT.waveConnector],
          ['waveWire', '대형(10PIN+)', DIP_UNIT.waveWire],
        ].map(([key, label, unit]) => (
          <label key={key} className="text-xs font-medium text-slate-600">
            {label}
            <QuoteNumericInput
              min={0}
              value={board[key as keyof DipBoardForm]}
              onChange={(value) => patch({ [key]: value } as Partial<DipBoardForm>)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
            />
            <UnitPreview krw={unit as number} quoteType={quoteType} />
          </label>
        ))}
      </div>
    </div>
  )
}
