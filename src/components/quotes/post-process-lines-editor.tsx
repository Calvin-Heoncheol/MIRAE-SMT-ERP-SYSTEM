'use client'

import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import {
  POST_RATE_ADMIN,
  POST_RATE_CORPORATE_PROFIT,
  POST_RATE_DIRECT_LABOR,
  POST_RATE_OVERHEAD,
} from '@/lib/quotes/constants'
import {
  emptyPostProcessLineForm,
  formatPostProcessBilledMinutes,
  formatPostProcessMinutesDisplay,
  parsePostProcessBufferPercent,
  parsePostProcessSeconds,
  postProcessBufferSeconds,
  sumPostProcessBilledMinutes,
  type PostProcessLineForm,
} from '@/lib/quotes/post-process-lines'
import { formatQuoteMoneyByDisplay } from '@/lib/quotes/format'
import type { QuoteDisplayCurrency, QuoteType } from '@/lib/quotes/types'

type PostProcessLinesEditorProps = {
  title: string
  ratePerMinute: number
  lines: PostProcessLineForm[]
  boardQty: number | string
  /** 여유 % (수동 입력값) */
  bufferPercent: number | string
  quoteType: QuoteType
  displayCurrency: QuoteDisplayCurrency
  onChange: (lines: PostProcessLineForm[]) => void
  /** true면 헤더에 여유 % 입력 표시 (공통 값) */
  showBufferControl?: boolean
  onBufferPercentChange?: (value: string) => void
}

export function PostProcessLinesEditor({
  title,
  ratePerMinute,
  lines,
  boardQty,
  bufferPercent,
  quoteType,
  displayCurrency,
  onChange,
  showBufferControl = false,
  onBufferPercentChange,
}: PostProcessLinesEditorProps) {
  const totalMinutes = sumPostProcessBilledMinutes(lines, boardQty, bufferPercent)
  const resolvedBufferPercent =
    parsePostProcessBufferPercent(bufferPercent) ?? 0
  const rateLabel = formatQuoteMoneyByDisplay(ratePerMinute, quoteType, displayCurrency)
  const rateHint = `분당임률 구성: 직접노무비 ${POST_RATE_DIRECT_LABOR}원 + 제조간접비 ${POST_RATE_OVERHEAD}원 + 기업이윤 ${POST_RATE_CORPORATE_PROFIT}원 + 일반관리비 ${POST_RATE_ADMIN}원`
  const bufferHint =
    '기본: 1,000미만 30% · 1,000↑ 25% · 2,000↑ 20% · 5,000↑ 15% (수량 변경 시 기본값으로 다시 맞춰집니다)'

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
        <span className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] text-slate-500">
          총 시간 합계 {formatPostProcessMinutesDisplay(totalMinutes)}분 ·{' '}
          <span className="cursor-help underline decoration-dotted decoration-slate-300" title={rateHint}>
            {rateLabel}/분
          </span>
          {showBufferControl && onBufferPercentChange ? (
            <>
              {' · '}
              <span className="inline-flex items-center gap-1" title={bufferHint}>
                <span className="cursor-help underline decoration-dotted decoration-slate-300">
                  여유
                </span>
                <QuoteNumericInput
                  min={0}
                  step="1"
                  value={String(bufferPercent)}
                  onChange={onBufferPercentChange}
                  className="w-14 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-slate-700"
                  title={bufferHint}
                />
                <span>%</span>
              </span>
            </>
          ) : (
            <>
              {' · '}
              <span className="cursor-help underline decoration-dotted decoration-slate-300" title={bufferHint}>
                여유 {resolvedBufferPercent}%
              </span>
            </>
          )}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 px-0.5 text-[10px] font-semibold text-slate-500">
          <span className="min-w-0 flex-1">공정명</span>
          <span className="w-20 shrink-0 text-center">초</span>
          <span className="w-14 shrink-0 cursor-help text-center" title={bufferHint}>
            여유분
          </span>
          <span className="w-[4.5rem] shrink-0 text-right">총 시간(분)</span>
          <span className="w-8 shrink-0" aria-hidden />
        </div>

        {lines.map((line, index) => {
          const seconds = parsePostProcessSeconds(line.seconds)
          const bufferSeconds = postProcessBufferSeconds(seconds, boardQty, bufferPercent)
          const minutesLabel = formatPostProcessBilledMinutes(seconds, boardQty, bufferPercent)

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
                className="w-14 shrink-0 cursor-help text-center text-[11px] tabular-nums text-amber-700"
                title={
                  bufferSeconds > 0
                    ? `여유 ${resolvedBufferPercent}% (+${bufferSeconds}초)\n${bufferHint}`
                    : bufferHint
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
        초는 입력값 그대로 유지 · 여유분 +{resolvedBufferPercent}% · 총 시간(분) = (초 + 여유분) ÷ 60
      </p>

      <ErpRowAddButton onClick={addLine} title={`${title} 행 추가`} className="mt-2" />
    </div>
  )
}
