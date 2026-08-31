'use client'

import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import {
  emptyPostProcessLineForm,
  formatPostProcessBilledMinutes,
  getPostProcessTimeBuffer,
  parsePostProcessSeconds,
  sumPostProcessBilledMinutes,
  type PostProcessLineForm,
  type PostProcessProductionKind,
} from '@/lib/quotes/post-process-lines'
import { formatQuoteMoneyByDisplay } from '@/lib/quotes/format'
import type { QuoteDisplayCurrency, QuoteType } from '@/lib/quotes/types'

type PostProcessLinesEditorProps = {
  title: string
  ratePerMinute: number
  lines: PostProcessLineForm[]
  productionKind: PostProcessProductionKind
  quoteType: QuoteType
  displayCurrency: QuoteDisplayCurrency
  onChange: (lines: PostProcessLineForm[]) => void
}

export function PostProcessLinesEditor({
  title,
  ratePerMinute,
  lines,
  productionKind,
  quoteType,
  displayCurrency,
  onChange,
}: PostProcessLinesEditorProps) {
  const totalMinutes = sumPostProcessBilledMinutes(lines, productionKind)
  const bufferPercent = Math.round(getPostProcessTimeBuffer(productionKind) * 100)
  const rateLabel = formatQuoteMoneyByDisplay(ratePerMinute, quoteType, displayCurrency)

  function updateLine(index: number, patch: Partial<PostProcessLineForm>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function removeLine(index: number) {
    if (lines.length <= 1) {
      onChange([emptyPostProcessLineForm()])
      return
    }
    onChange(lines.filter((_, i) => i !== index))
  }

  function addLine() {
    onChange([...lines, emptyPostProcessLineForm()])
  }

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h5 className="text-xs font-bold text-slate-700">{title}</h5>
        <span className="text-[11px] text-slate-500">
          합계 {totalMinutes}분 · {rateLabel}/분 · {productionKind} 여유 {bufferPercent}%
        </span>
      </div>

      <div className="space-y-2">
        {lines.map((line, index) => {
          const seconds = parsePostProcessSeconds(line.seconds)
          const minutesLabel = formatPostProcessBilledMinutes(seconds, productionKind)
          return (
            <div key={index} className="flex items-center gap-1.5">
              <input
                value={line.name}
                onChange={(event) => updateLine(index, { name: event.target.value })}
                placeholder="공정명"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
              />
              <QuoteNumericInput
                min={0}
                step="1"
                value={line.seconds}
                onChange={(secondsValue) => updateLine(index, { seconds: secondsValue })}
                placeholder="초"
                className="w-20 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
              />
              <span
                className="w-16 shrink-0 text-right text-[11px] tabular-nums text-slate-500"
                title="여유율 반영 청구 분"
              >
                {minutesLabel === '—' ? '—' : `${minutesLabel}분`}
              </span>
              <button
                type="button"
                onClick={() => removeLine(index)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-600"
                aria-label={`${title} 행 삭제`}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <p className="mt-2 text-[10px] text-slate-400">
        초 입력 → 분 자동 계산 (샘플 +30%, 양산 +20%)
      </p>

      <ErpRowAddButton onClick={addLine} title={`${title} 행 추가`} className="mt-2" />
    </div>
  )
}
