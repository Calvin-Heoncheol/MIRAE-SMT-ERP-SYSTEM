'use client'

import type { OrderPurchaseCard, OrderPurchaseStatus } from '@/lib/materials/purchase-orders/types'

type MaterialOrderPurchaseCardsProps = {
  cards: OrderPurchaseCard[]
  onPurchaseProduct: (card: OrderPurchaseCard, orderLineId: string) => void
}

function statusLabel(status: OrderPurchaseStatus) {
  if (status === 'done') return '발주완료'
  if (status === 'partial') return '부분발주'
  return '미발주'
}

function statusClass(status: OrderPurchaseStatus) {
  if (status === 'done') return 'bg-emerald-50 text-emerald-700'
  if (status === 'partial') return 'bg-amber-50 text-amber-800'
  return 'bg-rose-50 text-rose-700'
}

function borderClass(status: OrderPurchaseStatus) {
  if (status === 'done') return 'border-l-emerald-400'
  if (status === 'partial') return 'border-l-amber-400'
  return 'border-l-rose-400'
}

export function MaterialOrderPurchaseCards({
  cards,
  onPurchaseProduct,
}: MaterialOrderPurchaseCardsProps) {
  if (!cards.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center">
        <p className="text-base font-semibold text-slate-700">발주할 주문서가 없습니다</p>
        <p className="mt-2 text-sm text-slate-500">
          주문 제품이 있으면 여기에 표시됩니다. BOM이 없는 제품은 발주할 수 없습니다.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.key}
          className={[
            'flex flex-col rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm',
            borderClass(card.purchaseStatus),
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-sm font-bold text-slate-900">{card.orderNumber}</p>
              <p className="mt-1 truncate text-sm text-slate-600">{card.customer || '—'}</p>
            </div>
            <span
              className={[
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                statusClass(card.purchaseStatus),
              ].join(' ')}
            >
              {statusLabel(card.purchaseStatus)}
            </span>
          </div>

          <p className="mt-2 text-[11px] text-slate-400">납기 {card.deliveryDate || '—'}</p>

          <ul className="mt-3 flex flex-col gap-2">
            {card.products.map((product) => {
              const canPurchase = product.hasBom && product.remainingQuantity > 0

              return (
                <li
                  key={product.orderLineId}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold text-slate-900"
                        title={product.productName}
                      >
                        {product.productName}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                        {product.productCode}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {!product.hasBom ? (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          BOM 미등록
                        </span>
                      ) : (
                        <span
                          className={[
                            'rounded px-1.5 py-0.5 text-[10px] font-bold',
                            statusClass(product.purchaseStatus),
                          ].join(' ')}
                        >
                          {statusLabel(product.purchaseStatus)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
                    <div>
                      <p className="text-slate-400">주문</p>
                      <p className="font-semibold tabular-nums text-slate-800">
                        {product.orderQuantity.toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">기발주</p>
                      <p className="font-semibold tabular-nums text-sky-800">
                        {product.coveredQuantity.toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">잔량</p>
                      <p className="font-semibold tabular-nums text-violet-800">
                        {product.remainingQuantity.toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>

                  {!product.hasBom ? (
                    <button
                      type="button"
                      disabled
                      className="mt-2.5 w-full cursor-not-allowed rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500"
                    >
                      발주
                    </button>
                  ) : canPurchase ? (
                    <button
                      type="button"
                      onClick={() => onPurchaseProduct(card, product.orderLineId)}
                      className="mt-2.5 w-full rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                    >
                      발주
                    </button>
                  ) : (
                    <p className="mt-2.5 text-center text-[11px] font-medium text-emerald-700">
                      전량 발주 커버됨
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </article>
      ))}
    </div>
  )
}
