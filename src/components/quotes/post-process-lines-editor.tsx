'use client'

import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import {
  emptyPostProcessLineForm,
  formatPostProcessBilledMinutes,
  formatPostProcessMinutesDisplay,
  getPostProcessTimeBuffer,
  parsePostProcessSeconds,
  postProcessBufferSeconds,
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
          총 시간 합계 {formatPostProcessMinutesDisplay(totalMinutes)}분 · {rateLabel}/분 · {productionKind} 여유 {bufferPercent}%
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 px-0.5 text-[10px] font-semibold text-slate-500">
          <span className="min-w-0 flex-1">공정명</span>
          <span className="w-20 shrink-0 text-center">초</span>
          <span className="w-14 shrink-0 text-center">여유분</span>
          <span className="w-[4.5rem] shrink-0 text-right">총 시간(분)</span>
          <span className="w-8 shrink-0" aria-hidden />
        </div>

        {lines.map((line, index) => {
          const seconds = parsePostProcessSeconds(line.seconds)
          const bufferSeconds = postProcessBufferSeconds(seconds, productionKind)
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
                placeholder="0"
                className="w-20 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm"
                title="작업 시간(초) — 입력값 그대로 저장"
              />
              <span
                className="w-14 shrink-0 text-center text-[11px] tabular-nums text-amber-700"
                title={
                  bufferSeconds > 0
                    ? `${productionKind} 여유 ${bufferPercent}% (+${bufferSeconds}초)`
                    : undefined
                }
              >
                {bufferSeconds > 0 ? `+${bufferSeconds}초` : '—'}
              </span>
              <span
                className="w-[4.5rem] shrink-0 text-right text-[11px] tabular-nums text-slate-600"
                title="입력 초 + 여유분 → 청구 분"
              >
                {minutesLabel === '—' ? '—' : minutesLabel}
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
        초는 입력값 그대로 유지 · 여유분 자동 계산 (+30%) · 총 시간(분) = (초 + 여유분) ÷ 60
      </p>

      <ErpRowAddButton onClick={addLine} title={`${title} 행 추가`} className="mt-2" />
    </div>
  )
}
