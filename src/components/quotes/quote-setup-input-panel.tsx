'use client'

import { SmtPcbBoardForm } from '@/components/quotes/smt-pcb-board-form'
import type { SmtBoardForm } from '@/lib/quotes/form-state'
import {
  METAL_MASK_COST_DOUBLE,
  METAL_MASK_COST_SINGLE,
  SAMPLE_COST_DOUBLE,
  SAMPLE_COST_SINGLE,
  SAMPLE_QTY_THRESHOLD,
} from '@/lib/quotes/constants'
import {
  buildQuoteSetupDetailRows,
  formatPreviewRowDescription,
  formatPreviewRowUnit,
  type PreviewFormFields,
} from '@/lib/quotes/preview-rows'
import type { EstimateResult, QuoteDisplayCurrency, QuoteType } from '@/lib/quotes/types'
import { ERP_TABLE_TD_WRAP_CLASS } from '@/lib/ui/tokens'

type QuoteSetupInputPanelProps = {
  result: EstimateResult | null
  form: Pick<PreviewFormFields, 'includeMetalMask'>
  quoteType: QuoteType
  displayCurrency: QuoteDisplayCurrency
  smtForms: SmtBoardForm[]
  qty: number
  setupSectionTotal: number
  metalMaskTotal: number
  sampleSectionTotal: number
  samplePreview: number
  orderLevelTotal: number
  onSmtBoardChange: (index: number, board: SmtBoardForm) => void
  onIncludeMetalMaskChange: (checked: boolean) => void
  formatAmount: (krw: number) => string
}

export function QuoteSetupInputPanel({
  result,
  form,
  quoteType,
  displayCurrency,
  smtForms,
  qty,
  setupSectionTotal,
  metalMaskTotal,
  sampleSectionTotal,
  samplePreview,
  orderLevelTotal,
  onSmtBoardChange,
  onIncludeMetalMaskChange,
  formatAmount,
}: QuoteSetupInputPanelProps) {
  const setupRows = result ? buildQuoteSetupDetailRows(result, quoteType) : []
  const isDomestic = quoteType === 'domestic'

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center gap-3 bg-sky-50/80 px-3 py-2.5">
        <h4 className="min-w-0 flex-1 text-xs font-bold tracking-wide text-sky-950">SET-UP</h4>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium text-sky-800/80">{isDomestic ? '합계' : 'Total'}</p>
          <p className="text-sm font-semibold tabular-nums text-sky-950">
            {formatAmount(orderLevelTotal)}
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-100 px-3 py-3">
        {smtForms.map((board, index) => (
          <SmtPcbBoardForm
            key={`setup-${index}`}
            board={board}
            mode="setup"
            boardIndex={index}
            boardCount={smtForms.length}
            quoteType={quoteType}
            displayCurrency={displayCurrency}
            onChange={(next) => onSmtBoardChange(index, next)}
          />
        ))}

        {setupRows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="erp-data-table erp-data-table--compact min-w-[520px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left">{isDomestic ? '항목' : 'Item'}</th>
                  <th className="w-[100px] px-2 py-2 text-right">
                    {isDomestic ? '대당 단가' : 'Per-Unit'}
                  </th>
                  <th className="w-[72px] px-2 py-2 text-center">
                    {isDomestic ? '시간(분)' : 'Min'}
                  </th>
                  <th className="w-[108px] px-2 py-2 text-right">
                    {isDomestic ? '합계' : 'Total'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {setupRows.map((row, index) => {
                  const perUnit = row.amount ?? 0
                  const lineTotal = perUnit * qty
                  return (
                    <tr key={`${row.label}-${index}`} className="border-t border-slate-100">
                      <td className={`px-2 py-2 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                        <span className="block text-sm font-medium text-slate-900">{row.label}</span>
                        {row.boardName ? (
                          <span className="mt-0.5 block text-[11px] text-slate-500">{row.boardName}</span>
                        ) : null}
                        {formatPreviewRowDescription(row) ? (
                          <span className="mt-0.5 block text-[11px] text-slate-500">
                            {formatPreviewRowDescription(row)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right text-xs tabular-nums text-slate-700">
                        {formatPreviewRowUnit(row, quoteType, displayCurrency)}
                      </td>
                      <td className="px-2 py-2 text-center text-xs tabular-nums text-slate-600">
                        {row.count != null ? String(row.count) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">
                        {formatAmount(lineTotal)}
                      </td>
                    </tr>
                  )
                })}
                <tr className="border-t border-slate-200 bg-slate-50/80">
                  <td className="px-2 py-2 text-sm font-semibold text-slate-800" colSpan={3}>
                    SET-UP {isDomestic ? '소계' : 'Subtotal'}
                  </td>
                  <td className="px-2 py-2 text-right text-sm font-semibold tabular-nums text-slate-900">
                    {formatAmount(setupSectionTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        <label className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-xs">
          <span className="inline-flex items-center gap-2 font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.includeMetalMask}
              onChange={(event) => onIncludeMetalMaskChange(event.target.checked)}
              className="rounded border-slate-300"
            />
            {isDomestic ? '메탈마스크 비용 (일회성)' : 'Metal Mask (one-time)'}
            <span className="font-normal text-slate-500">
              (단면 {METAL_MASK_COST_SINGLE.toLocaleString('ko-KR')} / 양면{' '}
              {METAL_MASK_COST_DOUBLE.toLocaleString('ko-KR')})
            </span>
          </span>
          <span className="font-semibold tabular-nums text-slate-900">
            {formatAmount(form.includeMetalMask ? metalMaskTotal : 0)}
          </span>
        </label>

        {samplePreview > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-xs">
            <div>
              <span className="font-medium text-slate-700">
                {isDomestic ? '샘플 비용' : 'Sample Fee'}
              </span>
              <p className="mt-0.5 text-[11px] text-slate-500">
                일회성 · 생산수량 {SAMPLE_QTY_THRESHOLD.toLocaleString('ko-KR')}대 미만 · 단면{' '}
                {SAMPLE_COST_SINGLE.toLocaleString('ko-KR')} / 양면·듀얼{' '}
                {SAMPLE_COST_DOUBLE.toLocaleString('ko-KR')}
              </p>
            </div>
            <span className="font-semibold tabular-nums text-slate-900">
              {formatAmount(sampleSectionTotal)}
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50/60 px-2.5 py-2 text-xs">
          <span className="font-semibold text-sky-950">{isDomestic ? '합계' : 'Total'}</span>
          <span className="text-sm font-bold tabular-nums text-sky-950">
            {formatAmount(orderLevelTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}
