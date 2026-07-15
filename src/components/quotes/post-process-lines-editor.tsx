'use client'

import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import {
  emptyPostProcessLineForm,
  sumPostProcessLineMinutes,
  type PostProcessLineForm,
} from '@/lib/quotes/post-process-lines'
import { formatQuoteMoneyByDisplay } from '@/lib/quotes/format'
import type { QuoteDisplayCurrency, QuoteType } from '@/lib/quotes/types'

type PostProcessLinesEditorProps = {
  title: string
  ratePerMinute: number
  lines: PostProcessLineForm[]
  quoteType: QuoteType
  displayCurrency: QuoteDisplayCurrency
  onChange: (lines: PostProcessLineForm[]) => void
}

export function PostProcessLinesEditor({
  title,
  ratePerMinute,
  lines,
  quoteType,
  displayCurrency,
  onChange,
}: PostProcessLinesEditorProps) {
  const totalMinutes = sumPostProcessLineMinutes(lines)
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
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h5 className="text-xs font-bold text-slate-700">{title}</h5>
        <span className="text-[11px] text-slate-500">
          합계 {totalMinutes}분 · {rateLabel}/분
        </span>
      </div>

      <div className="space-y-2">
        {lines.map((line, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <input
              value={line.name}
              onChange={(event) => updateLine(index, { name: event.target.value })}
              placeholder="공정명"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
            />
            <QuoteNumericInput
              min={0}
              step="0.01"
              value={line.minutes}
              onChange={(minutes) => updateLine(index, { minutes })}
              placeholder="분"
              className="w-20 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => removeLine(index)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-600"
              aria-label={`${title} 행 삭제`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addLine}
        className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
      >
        + 행 추가
      </button>
    </div>
  )
}
