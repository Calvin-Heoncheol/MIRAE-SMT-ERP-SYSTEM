'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

import { CategoryBadge } from '@/components/ui/category-badge'
import { exportSummaryFromKrw, formatQuoteMoneyTotal, formatQuoteMoneyUnit } from '@/lib/quotes/format'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import {
  QUOTE_TYPE_BADGE_CLASS,
  QUOTE_TYPE_LABELS,
  type QuoteListItem,
} from '@/lib/quotes/types'

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
  return formatQuoteMoneyUnit(quote.totalAmount / qty, quote.quoteType)
}

export function QuoteListTable({ quotes, emptyMessage, onSelectQuote }: QuoteListTableProps) {
  if (!quotes.length) {
    return (
      <EmptyListState message={emptyMessage} hint="새 견적서 버튼에서 해외용 또는 국내용 견적서를 선택해 등록하세요." />
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table className="min-w-[1120px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                견적일
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                견적코드
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                유형
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                고객사
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                제품명
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                대당단가
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                수량
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                총 견적금액
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                등록자
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
                <td className="px-3 py-2.5 text-sm text-slate-700">{quote.quoteDate || '-'}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-700" title={quote.quoteNumber}>
                  {formatInternalCodeLabel(quote.quoteNumber)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <CategoryBadge
                    label={QUOTE_TYPE_LABELS[quote.quoteType]}
                    className={QUOTE_TYPE_BADGE_CLASS[quote.quoteType]}
                  />
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{quote.customer || '-'}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{quote.productName || '-'}</td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {quoteUnitPriceDisplay(quote)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700">
                  {quote.boardQty.toLocaleString('ko-KR')}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {formatQuoteMoneyTotal(quote.totalAmount, quote.quoteType)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                  {quote.createdByName || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
