'use client'

import { exportSummaryFromKrw, formatQuoteMoneyTotal, formatQuoteMoneyUnit } from '@/lib/quotes/format'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import type { QuoteListItem } from '@/lib/quotes/types'

type QuoteListTableProps = {
  quotes: QuoteListItem[]
  emptyMessage: string
  onSelectQuote?: (quote: QuoteListItem) => void
}

function quoteUnitPriceDisplay(quote: QuoteListItem) {
  const qty = quote.boardQty || 1
  if (quote.quoteType === 'export') {
    return exportSummaryFromKrw(quote.totalAmount, qty).unitFormatted
  }
  return formatQuoteMoneyUnit(Math.floor(quote.totalAmount / qty), quote.quoteType)
}

export function QuoteListTable({ quotes, emptyMessage, onSelectQuote }: QuoteListTableProps) {
  if (!quotes.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">새 견적서 버튼에서 해외용 또는 국내용을 선택해 등록하세요.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full border-collapse">
          <thead className="bg-blue-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                견적일
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                견적코드
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                고객사
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                제품명
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-blue-800 uppercase">
                대당단가
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-blue-800 uppercase">
                수량
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-blue-800 uppercase">
                총 견적금액
              </th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr
                key={quote.quoteNumber}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/80"
                onClick={() => onSelectQuote?.(quote)}
              >
                <td className="px-4 py-3 text-sm text-slate-700">{quote.quoteDate || '-'}</td>
                <td className="px-4 py-3 font-mono text-xs text-blue-700" title={quote.quoteNumber}>
                  {formatInternalCodeLabel(quote.quoteNumber)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{quote.customer || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{quote.productName || '-'}</td>
                <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {quoteUnitPriceDisplay(quote)}
                </td>
                <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                  {quote.boardQty.toLocaleString('ko-KR')}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {formatQuoteMoneyTotal(quote.totalAmount, quote.quoteType)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
