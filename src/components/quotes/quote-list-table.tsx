'use client'

import { OrderCategoryBadge } from '@/components/orders/order-category-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpTableHead, ErpTableShell, ErpTableTd, ErpTableTh } from '@/components/ui/erp-table'
import { formatQuoteMoneyTotal, formatQuoteMoneyUnit } from '@/lib/quotes/format'
import { resolveSavedQuoteAmounts } from '@/lib/quotes/saved-quote-amounts'
import { getQuoteProductionFlags } from '@/lib/quotes/production-flags'
import { buildItemPriceBreakdownFromQuote } from '@/lib/quotes/quote-to-item'
import { splitAmountByProcess } from '@/lib/items/process-billing'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import { QUOTE_STATUS_LABELS, type QuoteListItem, type QuoteStatus } from '@/lib/quotes/types'
import { quoteRegistrantLabel } from '@/lib/quotes/utils'
import { ERP_CODE_TEXT_CLASS, ERP_TABLE_ROW_CLASS } from '@/lib/ui/tokens'

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

/** 공정별 대당단가 — 후공정 = 후공정 단가, SMD = 나머지 (거래명세서 공정분리와 같은 기준) */
function quoteProcessUnitPrices(quote: QuoteListItem): { smd: number | null; post: number | null } {
  const unitPrice = resolveSavedQuoteAmounts(quote).unitPrice
  const { hasSmd, hasPost } = getQuoteProductionFlags(quote)
  if (hasSmd && hasPost) {
    const split = splitAmountByProcess({
      qty: 1,
      unitPrice,
      postUnitPrice: buildItemPriceBreakdownFromQuote(quote).dipUnitPrice,
    })
    return { smd: split.smd.unitPrice, post: split.post.unitPrice }
  }
  if (hasPost) return { smd: null, post: unitPrice }
  return { smd: unitPrice, post: null }
}

function UnitPriceCell({ value, quoteType }: { value: number | null; quoteType: QuoteListItem['quoteType'] }) {
  return (
    <ErpTableTd align="right" className="font-semibold tabular-nums text-slate-900">
      {value == null ? <span className="font-normal text-slate-300">—</span> : formatQuoteMoneyUnit(value, quoteType)}
    </ErpTableTd>
  )
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
    <ErpTableShell tableClassName="min-w-[1240px]">
      <ErpTableHead>
        <tr>
          <ErpTableTh>견적일</ErpTableTh>
          <ErpTableTh>견적코드</ErpTableTh>
          <ErpTableTh align="center">구분</ErpTableTh>
          <ErpTableTh>고객사</ErpTableTh>
          <ErpTableTh>제품명</ErpTableTh>
          <ErpTableTh align="right">SMD</ErpTableTh>
          <ErpTableTh align="right">후공정</ErpTableTh>
          <ErpTableTh align="right">수량</ErpTableTh>
          <ErpTableTh align="right">총 견적금액</ErpTableTh>
          <ErpTableTh>등록자</ErpTableTh>
          <ErpTableTh align="center">상태</ErpTableTh>
        </tr>
      </ErpTableHead>
      <tbody>
        {quotes.map((quote) => {
          const unitPrices = quoteProcessUnitPrices(quote)
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
              <UnitPriceCell value={unitPrices.smd} quoteType={quote.quoteType} />
              <UnitPriceCell value={unitPrices.post} quoteType={quote.quoteType} />
              <ErpTableTd align="right" className="tabular-nums text-slate-700">
                {quote.boardQty.toLocaleString('ko-KR')}
              </ErpTableTd>
              <ErpTableTd align="right" className="font-semibold tabular-nums text-slate-900">
                {formatQuoteMoneyTotal(resolveSavedQuoteAmounts(quote).totalAmount, quote.quoteType)}
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
            </tr>
          )
        })}
      </tbody>
    </ErpTableShell>
  )
}
