'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { CategoryBadge } from '@/components/ui/category-badge'
import { exportSummaryFromKrw, formatQuoteMoneyTotal, formatQuoteMoneyUnit } from '@/lib/quotes/format'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import {
  QUOTE_TYPE_BADGE_CLASS,
  QUOTE_TYPE_LABELS,
  type QuoteListItem,
} from '@/lib/quotes/types'
import {
  ERP_TABLE_TD_FIXED_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

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
      <EmptyListState message={emptyMessage} />
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
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_FIXED_CLASS}`}>
                  {quote.quoteDate || '-'}
                </td>
                <td
                  className={`px-3 py-2.5 font-mono text-xs text-slate-700 ${ERP_TABLE_TD_FIXED_CLASS}`}
                  title={quote.quoteNumber}
                >
                  {formatInternalCodeLabel(quote.quoteNumber)}
                </td>
                <td className={`px-3 py-2.5 text-center ${ERP_TABLE_TD_FIXED_CLASS}`}>
                  <CategoryBadge
                    label={QUOTE_TYPE_LABELS[quote.quoteType]}
                    className={QUOTE_TYPE_BADGE_CLASS[quote.quoteType]}
                  />
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  {quote.customer || '-'}
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  {quote.productName || '-'}
                </td>
                <td
                  className={`px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900 ${ERP_TABLE_TD_FIXED_CLASS}`}
                >
                  {quoteUnitPriceDisplay(quote)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right text-sm tabular-nums text-slate-700 ${ERP_TABLE_TD_FIXED_CLASS}`}
                >
                  {quote.boardQty.toLocaleString('ko-KR')}
                </td>
                <td
                  className={`px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900 ${ERP_TABLE_TD_FIXED_CLASS}`}
                >
                  {formatQuoteMoneyTotal(quote.totalAmount, quote.quoteType)}
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_FIXED_CLASS}`}>
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
