'use client'

import { useState } from 'react'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { StatusBadge } from '@/components/ui/status-badge'
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
  if (status === 'done') return 'bg-emerald-100 text-emerald-800'
  if (status === 'partial') return 'bg-amber-100 text-amber-800'
  return 'bg-rose-100 text-rose-800'
}

function borderClass(status: OrderPurchaseStatus) {
  if (status === 'done') return 'border-l-emerald-400'
  if (status === 'partial') return 'border-l-amber-400'
  return 'border-l-rose-400'
}

function cardSummary(card: OrderPurchaseCard) {
  const openCount = card.products.filter((p) => p.hasBom && p.remainingQuantity > 0).length
  const noBomCount = card.products.filter((p) => !p.hasBom).length
  const firstName = card.products[0]?.productName?.trim() || '—'
  return { openCount, noBomCount, firstName, productCount: card.products.length }
}

export function MaterialOrderPurchaseCards({
  cards,
  onPurchaseProduct,
}: MaterialOrderPurchaseCardsProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set())

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!cards.length) {
    return (
      <EmptyListState
        message="발주할 주문서가 없습니다"
        hint="주문 제품이 있으면 여기에 표시됩니다. BOM이 없는 제품은 발주할 수 없습니다."
      />
    )
  }

  return (
    <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const expanded = expandedKeys.has(card.key)
        const { openCount, firstName, productCount } = cardSummary(card)

        return (
          <article
            key={card.key}
            className={[
              'flex flex-col rounded-xl border border-slate-200 border-l-4 bg-white shadow-sm',
              borderClass(card.purchaseStatus),
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => toggleExpanded(card.key)}
              aria-expanded={expanded}
              className="flex w-full flex-col px-4 py-3.5 text-left transition hover:bg-slate-50/80"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-slate-900">{card.orderNumber}</p>
                  <p className="mt-1 truncate text-sm text-slate-600">{card.customer || '—'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge
                    label={statusLabel(card.purchaseStatus)}
                    className={statusClass(card.purchaseStatus)}
                  />
                  <span
                    className={[
                      'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition',
                      expanded ? 'rotate-180 bg-slate-100 text-slate-700' : '',
                    ].join(' ')}
                    aria-hidden
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </div>
              </div>

              <p className="mt-2 text-[11px] text-slate-400">납기 {card.deliveryDate || '—'}</p>

              <div className="mt-2.5 min-h-[2.75rem]">
                <p className="truncate text-sm font-medium text-slate-800" title={firstName}>
                  {firstName}
                  {productCount > 1 ? (
                    <span className="font-normal text-slate-500"> 외 {productCount - 1}건</span>
                  ) : null}
                </p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  품목 {productCount.toLocaleString('ko-KR')} · 발주가능{' '}
                  <span className="tabular-nums text-slate-700">
                    {openCount.toLocaleString('ko-KR')}
                  </span>
                  {expanded ? ' · 접기' : ' · 펼치기'}
                </p>
              </div>
            </button>

            {expanded ? (
              <ul className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3">
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
                            <StatusBadge
                              label="BOM 미등록"
                              className="bg-slate-100 text-slate-700"
                            />
                          ) : (
                            <StatusBadge
                              label={statusLabel(product.purchaseStatus)}
                              className={statusClass(product.purchaseStatus)}
                            />
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
                          <p className="text-slate-400">발주</p>
                          <p className="font-semibold tabular-nums text-sky-800">
                            {product.coveredQuantity.toLocaleString('ko-KR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">잔량</p>
                          <p className="font-semibold tabular-nums text-slate-800">
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
                          className="mt-2.5 w-full rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
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
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
