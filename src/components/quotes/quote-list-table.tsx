'use client'

import { OrderCategoryBadge } from '@/components/orders/order-category-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpTableHead, ErpTableShell, ErpTableTd, ErpTableTh } from '@/components/ui/erp-table'
import { exportSummaryFromKrw, formatQuoteMoneyTotal, formatQuoteMoneyUnit } from '@/lib/quotes/format'
import { formatQuoteProcessLabel } from '@/lib/quotes/production-flags'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import { QUOTE_STATUS_LABELS, type QuoteListItem, type QuoteStatus } from '@/lib/quotes/types'
import { isLegacyQuoteDetail, quoteRegistrantLabel } from '@/lib/quotes/utils'
import { ERP_CODE_TEXT_CLASS, ERP_TABLE_ROW_CLASS } from '@/lib/ui/tokens'

type QuoteListTableProps = {
  quotes: QuoteListItem[]
  emptyMessage: string
  onSelectQuote?: (quote: QuoteListItem) => void
  onCopyQuote?: (quote: QuoteListItem) => void
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
  return 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
}

export function QuoteListTable({
  quotes,
  emptyMessage,
  onSelectQuote,
  onCopyQuote,
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
    <ErpTableShell tableClassName="min-w-[1340px]">
      <ErpTableHead>
        <tr>
          <ErpTableTh>견적일</ErpTableTh>
          <ErpTableTh>견적코드</ErpTableTh>
          <ErpTableTh align="center">구분</ErpTableTh>
          <ErpTableTh>고객사</ErpTableTh>
          <ErpTableTh>제품명</ErpTableTh>
          <ErpTableTh align="center">공정</ErpTableTh>
          <ErpTableTh align="right">대당단가</ErpTableTh>
          <ErpTableTh align="right">수량</ErpTableTh>
          <ErpTableTh align="right">총 견적금액</ErpTableTh>
          <ErpTableTh>등록자</ErpTableTh>
          <ErpTableTh align="center">상태</ErpTableTh>
          <ErpTableTh align="center">복사</ErpTableTh>
        </tr>
      </ErpTableHead>
      <tbody>
        {quotes.map((quote) => {
          const canCopy = !isLegacyQuoteDetail(quote.detailInfo)
          return (
            <tr
              key={quote.quoteNumber}
              className={`${ERP_TABLE_ROW_CLASS} cursor-pointer`}
              onClick={() => onSelectQuote?.(quote)}
            >
              <ErpTableTd className="text-slate-700">{quote.quoteDate || '-'}</ErpTableTd>
              <ErpTableTd className={ERP_CODE_TEXT_CLASS} title={quote.quoteNumber}>
                {formatInternalCodeLabel(quote.quoteNumber)}
              </ErpTableTd>
              <ErpTableTd align="center">
                <OrderCategoryBadge category={quoteProductionKind(quote)} />
              </ErpTableTd>
              <ErpTableTd text="wrap" className="max-w-[160px] text-slate-700">
                {quote.customer || '-'}
              </ErpTableTd>
              <ErpTableTd text="wrap" className="max-w-[200px] text-slate-700">
                {quote.productName || '-'}
              </ErpTableTd>
              <ErpTableTd align="center" className="text-slate-700">
                {formatQuoteProcessLabel(quote)}
              </ErpTableTd>
              <ErpTableTd align="right" className="font-semibold tabular-nums text-slate-900">
                {quoteUnitPriceDisplay(quote)}
              </ErpTableTd>
              <ErpTableTd align="right" className="tabular-nums text-slate-700">
                {quote.boardQty.toLocaleString('ko-KR')}
              </ErpTableTd>
              <ErpTableTd align="right" className="font-semibold tabular-nums text-slate-900">
                {formatQuoteMoneyTotal(quote.totalAmount, quote.quoteType)}
              </ErpTableTd>
              <ErpTableTd className="text-slate-700">
                {quoteRegistrantLabel(quote) || '-'}
              </ErpTableTd>
              <ErpTableTd align="center">
                <button
                  type="button"
                  disabled={statusBusyId === quote.quoteNumber}
                  title={
                    quote.quoteStatus === 'confirmed'
                      ? '클릭하면 미확정으로 변경'
                      : '클릭하면 확정으로 변경'
                  }
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleStatus?.(quote)
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${statusButtonClass(quote.quoteStatus)}`}
                >
                  {QUOTE_STATUS_LABELS[quote.quoteStatus]}
                </button>
              </ErpTableTd>
              <ErpTableTd align="center">
                {canCopy ? (
                  <button
                    type="button"
                    title="이 견적으로 새 견적 작성"
                    onClick={(event) => {
                      event.stopPropagation()
                      onCopyQuote?.(quote)
                    }}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    복사
                  </button>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </ErpTableTd>
            </tr>
          )
        })}
      </tbody>
    </ErpTableShell>
  )
}
