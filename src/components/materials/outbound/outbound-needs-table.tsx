'use client'

import { useEffect, useMemo, useState } from 'react'
import { OutboundRestockModal } from '@/components/materials/outbound/outbound-restock-modal'
import { OutboundScanModal } from '@/components/materials/outbound/outbound-scan-modal'
import { CategoryBadge } from '@/components/ui/category-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { StatusBadge } from '@/components/ui/status-badge'
import type {
  BomEdge,
  MaterialOutboundNeedCard,
  MaterialOutboundOrderCard,
  OutboundMaterialBucket,
} from '@/lib/materials/outbound/types'
import { OUTBOUND_MATERIAL_BUCKET_LABELS } from '@/lib/materials/outbound/types'
import type { Material } from '@/lib/materials/types'
import { ERP_PRIMARY_BUTTON_CLASS, ERP_SECONDARY_BUTTON_CLASS, ERP_TABLE_TD_WRAP_CLASS } from '@/lib/ui/tokens'

type OutboundNeedsTableProps = {
  cards: MaterialOutboundOrderCard[]
  bomEdges?: BomEdge[]
  materials?: Material[]
  emptyMessage?: string
  onIssued: () => void
}

const BUCKET_BADGE_CLASS: Record<OutboundMaterialBucket, string> = {
  SMD: 'bg-blue-100 text-blue-800',
  DIP: 'bg-emerald-100 text-emerald-800',
  ETC: 'bg-slate-100 text-slate-700',
}

function countMaterials(actions: MaterialOutboundNeedCard[]) {
  const ids = new Set<string>()
  for (const action of actions) {
    for (const line of action.lines) {
      if (!line.materialId) continue
      ids.add(line.materialId)
    }
  }
  return { materialCount: ids.size }
}

function groupActionsByProduct(actions: MaterialOutboundNeedCard[]) {
  const map = new Map<string, MaterialOutboundNeedCard[]>()
  for (const action of actions) {
    const list = map.get(action.productId) || []
    list.push(action)
    map.set(action.productId, list)
  }
  return [...map.entries()].map(([productId, items]) => ({
    productId,
    productName: items[0]?.productName || productId,
    productQuantity: items[0]?.productQuantity ?? 0,
    actions: items,
    ...countMaterials(items),
  }))
}

export function OutboundNeedsTable({ cards, emptyMessage, onIssued }: OutboundNeedsTableProps) {
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [scanActionKey, setScanActionKey] = useState<string | null>(null)
  const [cachedScanAction, setCachedScanAction] = useState<MaterialOutboundNeedCard | null>(null)
  const [restockOpen, setRestockOpen] = useState(false)

  const selectedCard = cards.find((card) => card.orderId === selectedOrderId) ?? cards[0] ?? null
  const productGroups = useMemo(
    () => (selectedCard ? groupActionsByProduct(selectedCard.actions) : []),
    [selectedCard],
  )
  const liveScanAction =
    cards.flatMap((card) => card.actions).find((action) => action.key === scanActionKey) ?? null
  const scanAction = liveScanAction ?? (scanActionKey ? cachedScanAction : null)

  useEffect(() => {
    if (liveScanAction) setCachedScanAction(liveScanAction)
  }, [liveScanAction])

  useEffect(() => {
    if (!cards.length) {
      setSelectedOrderId('')
      return
    }
    if (!cards.some((card) => card.orderId === selectedOrderId)) {
      setSelectedOrderId(cards[0].orderId)
    }
  }, [cards, selectedOrderId])

  if (!cards.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage ?? '미불출 주문이 없습니다'} />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
      <aside className="flex w-[19rem] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        <p className="shrink-0 border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
          미불출 발주 {cards.length.toLocaleString('ko-KR')}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <ul className="flex flex-col gap-1.5">
            {cards.map((card) => {
              const active = card.orderId === selectedCard?.orderId
              return (
                <li key={card.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderId(card.orderId)
                      setRestockOpen(false)
                    }}
                    className={[
                      'w-full rounded-lg border px-3 py-2.5 text-left transition',
                      active
                        ? 'border-slate-800 bg-slate-800 text-white'
                        : 'border-slate-200 bg-white hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-sm font-bold">{card.orderNumber}</p>
                      <StatusBadge
                        label={card.issuableActionCount > 0 ? '창고릴' : '대기'}
                        className={
                          active
                            ? 'bg-white/15 text-white'
                            : card.issuableActionCount > 0
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-slate-100 text-slate-600'
                        }
                      />
                    </div>
                    <p
                      className={`mt-1 text-xs ${active ? 'text-slate-200' : 'text-slate-600'} ${ERP_TABLE_TD_WRAP_CLASS}`}
                    >
                      {card.customer || '—'}
                    </p>
                    <p className={`mt-1 text-[11px] ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                      {card.productLabel} · 납기 {card.deliveryDate || '—'}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        {!selectedCard ? (
          <EmptyListState message="왼쪽에서 발주를 선택하세요" />
        ) : (
          <>
            <div className="shrink-0 border-b border-slate-100 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-lg font-bold text-slate-900">{selectedCard.orderNumber}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{selectedCard.customer || '—'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-slate-400">납기 {selectedCard.deliveryDate || '—'}</p>
                  <button
                    type="button"
                    onClick={() => setRestockOpen(true)}
                    className={`${ERP_SECONDARY_BUTTON_CLASS} py-2 text-xs`}
                  >
                    잔량반납
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ul className="grid grid-cols-2 gap-3">
                {productGroups.map((group) => (
                  <li
                    key={group.productId}
                    className="flex min-h-0 flex-col rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className={`text-sm font-semibold text-slate-900 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                        {group.productName}
                      </p>
                      <p className="shrink-0 text-xs font-medium text-slate-500">
                        주문 {group.productQuantity.toLocaleString('ko-KR')}대
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      자재{' '}
                      <span className="font-semibold tabular-nums text-slate-900">
                        {group.materialCount.toLocaleString('ko-KR')}종
                      </span>
                    </p>
                    <ul className="mt-3 flex flex-1 flex-col gap-2">
                      {group.actions.map((action) => {
                        const stats = countMaterials([action])
                        return (
                        <li
                          key={action.key}
                          className="flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-2.5"
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <CategoryBadge
                              label={OUTBOUND_MATERIAL_BUCKET_LABELS[action.materialBucket]}
                              className={BUCKET_BADGE_CLASS[action.materialBucket]}
                            />
                            <p className="text-xs text-slate-500">
                              자재 {stats.materialCount.toLocaleString('ko-KR')}종
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCachedScanAction(action)
                              setScanActionKey(action.key)
                            }}
                            className={`${ERP_PRIMARY_BUTTON_CLASS} w-full px-3 py-2`}
                          >
                            릴 스캔
                          </button>
                        </li>
                        )
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      <OutboundScanModal
        open={Boolean(scanAction)}
        action={scanAction}
        onClose={() => {
          setScanActionKey(null)
          setCachedScanAction(null)
        }}
        onIssued={onIssued}
      />
      <OutboundRestockModal
        open={restockOpen && Boolean(selectedCard)}
        orderId={selectedCard?.orderId ?? ''}
        orderNumber={selectedCard?.orderNumber ?? ''}
        customer={selectedCard?.customer ?? ''}
        allowedMaterialIds={[
          ...new Set(
            (selectedCard?.actions ?? []).flatMap((action) =>
              action.lines.map((line) => line.materialId).filter(Boolean),
            ),
          ),
        ]}
        productName={selectedCard?.productLabel}
        onClose={() => setRestockOpen(false)}
        onRestocked={onIssued}
      />
    </div>
  )
}
