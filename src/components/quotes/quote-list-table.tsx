'use client'

import { OrderCategoryBadge } from '@/components/orders/order-category-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { exportSummaryFromKrw, formatQuoteMoneyTotal, formatQuoteMoneyUnit } from '@/lib/quotes/format'
import { formatQuoteProcessLabel } from '@/lib/quotes/production-flags'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import { QUOTE_STATUS_LABELS, type QuoteListItem, type QuoteStatus } from '@/lib/quotes/types'
import { quoteRegistrantLabel } from '@/lib/quotes/utils'
import {
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_FIXED_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

type QuoteListTableProps = {
  quotes: QuoteListItem[]
  emptyMessage: string
  onSelectQuote?: (quote: QuoteListItem) => void
  onToggleStatus?: (quote: QuoteListItem) => void
  statusBusyId?: string | null
}

function quoteProductionKind(quote: QuoteListItem): '샘플' | '양산' {
  return quote.detailInfo.settings?.productionKind === '샘플' ? '샘플' : '양산'
}

function quoteUnitPriceDisplay(quote: QuoteListItem) {
  const qty = quote.boardQty || 1
  if (quote.quoteType === 'export') {
    return exportSummaryFromKrw(quote.totalAmount, qty).unitFormatted
  }
  return formatQuoteMoneyUnit(quote.totalAmount / qty, quote.quoteType)
}

function statusButtonClass(status: QuoteStatus) {
  if (status === 'confirmed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
  }
  return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
}

export function QuoteListTable({
  quotes,
  emptyMessage,
  onSelectQuote,
  onToggleStatus,
  statusBusyId,
}: QuoteListTableProps) {
  if (!quotes.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className="erp-data-table min-w-[1280px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                견적일
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                견적코드
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500">
                구분
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                고객사
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                제품명
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500">
                공정
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                대당단가
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                수량
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                총 견적금액
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                등록자
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500">
                상태
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
                  <OrderCategoryBadge category={quoteProductionKind(quote)} />
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  {quote.customer || '-'}
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  {quote.productName || '-'}
                </td>
                <td className={`px-3 py-2.5 text-center text-sm text-slate-700 ${ERP_TABLE_TD_FIXED_CLASS}`}>
                  {formatQuoteProcessLabel(quote)}
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
                  {quoteRegistrantLabel(quote) || '-'}
                </td>
                <td className={`px-3 py-2.5 text-center ${ERP_TABLE_TD_FIXED_CLASS}`}>
                  <button
                    type="button"
                    disabled={statusBusyId === quote.quoteNumber}
                    title={
                      quote.quoteStatus === 'confirmed' ? '클릭하면 미확정으로 변경' : '클릭하면 확정으로 변경'
                    }
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleStatus?.(quote)
                    }}
                    className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${statusButtonClass(quote.quoteStatus)}`}
                  >
                    {QUOTE_STATUS_LABELS[quote.quoteStatus]}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
