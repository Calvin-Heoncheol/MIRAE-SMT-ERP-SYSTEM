'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { StatusBadge } from '@/components/ui/status-badge'
import type { MaterialPurchaseNeedCard } from '@/lib/materials/purchase-orders/types'

type MaterialPurchaseNeedCardsProps = {
  cards: MaterialPurchaseNeedCard[]
  onSelectCard: (card: MaterialPurchaseNeedCard) => void
}

function PurchaseNeedCardItem({
  card,
  onSelect,
}: {
  card: MaterialPurchaseNeedCard
  onSelect: () => void
}) {
  const hasShortage = card.shortageCount > 0

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex flex-col rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md',
        hasShortage
          ? 'border-slate-200 border-l-4 border-l-rose-400'
          : 'border-slate-200 border-l-4 border-l-emerald-400',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold text-slate-900">{card.orderNumber}</p>
          <p className="mt-1 truncate text-sm text-slate-600">{card.customer || '—'}</p>
        </div>
        <StatusBadge
          label={hasShortage ? `부족 ${card.shortageCount}` : '재고 충분'}
          className={
            hasShortage ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
          }
        />
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-start justify-between gap-2">
          <span className="shrink-0 text-slate-500">품목</span>
          <span className="min-w-0 text-right font-medium text-slate-900" title={card.productLabel}>
            {card.productLabel}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">수량</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {card.productQuantity.toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">자재</span>
          <span className="tabular-nums text-slate-800">
            {card.materialCount.toLocaleString('ko-KR')}종
            <span className="text-slate-400"> · </span>
            <span className={hasShortage ? 'text-rose-700' : 'text-emerald-700'}>
              부족 {card.shortageCount}
            </span>
            <span className="text-slate-400"> / </span>
            <span className="text-emerald-700">충분 {card.sufficientCount}</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">생산 납기일</span>
          <span className="tabular-nums text-slate-800">{card.deliveryDate || '—'}</span>
        </div>
      </div>

      <p className="mt-4 text-xs font-medium text-slate-500">클릭하여 발주 필요 자재 확인</p>
    </button>
  )
}

export function MaterialPurchaseNeedCards({ cards, onSelectCard }: MaterialPurchaseNeedCardsProps) {
  if (!cards.length) {
    return (
      <EmptyListState
        message="발주 검토할 주문이 없습니다"
        hint="주문·BOM 기준으로 소요 자재가 있으면 여기에 표시됩니다."
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <h3 className="text-sm font-bold text-slate-800">주문서</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          카드를 클릭하면 현재고 기준 발주 필요(부족/충분) 자재를 확인할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <PurchaseNeedCardItem key={card.key} card={card} onSelect={() => onSelectCard(card)} />
        ))}
      </div>
    </div>
  )
}
