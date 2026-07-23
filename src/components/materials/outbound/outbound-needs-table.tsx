'use client'

import { useMemo, useState } from 'react'
import { CategoryBadge } from '@/components/ui/category-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { createMaterialOutbound } from '@/lib/materials/outbound/repository'
import {
  buildOutboundLinesForProductQuantity,
  resolveMaterialBucket,
  type OutboundBucketFilter,
} from '@/lib/materials/outbound/utils'
import type {
  BomEdge,
  MaterialOutboundNeedCard,
  MaterialOutboundOrderCard,
  OutboundMaterialBucket,
} from '@/lib/materials/outbound/types'
import { OUTBOUND_MATERIAL_BUCKET_LABELS } from '@/lib/materials/outbound/types'
import type { Material } from '@/lib/materials/types'
import { todayYmdSeoul } from '@/lib/orders/utils'

type OutboundNeedsTableProps = {
  cards: MaterialOutboundOrderCard[]
  bomEdges: BomEdge[]
  materials: Material[]
  onIssued: () => void
}

const BUCKET_BADGE_CLASS: Record<OutboundMaterialBucket, string> = {
  SMD: 'bg-blue-100 text-blue-800',
  DIP: 'bg-emerald-100 text-emerald-800',
  ETC: 'bg-slate-100 text-slate-700',
}

function borderClass(card: MaterialOutboundOrderCard) {
  if (card.issuableActionCount > 0) return 'border-l-orange-400'
  return 'border-l-slate-300'
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
  }))
}

function OutboundBucketAction({
  action,
  edgesByParent,
  bucketByMaterialId,
  onIssued,
}: {
  action: MaterialOutboundNeedCard
  edgesByParent: Map<string, BomEdge[]>
  bucketByMaterialId: Map<string, OutboundMaterialBucket>
  onIssued: () => void
}) {
  const defaultQty = Math.min(action.issuableQuantity, action.remainingProductQuantity)
  const [qty, setQty] = useState(defaultQty > 0 ? String(defaultQty) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [okMessage, setOkMessage] = useState('')

  const maxQty = Math.min(action.issuableQuantity, action.remainingProductQuantity)
  const bucketLabel = OUTBOUND_MATERIAL_BUCKET_LABELS[action.materialBucket]

  async function handleIssue() {
    const value = Math.floor(Number(qty) || 0)
    if (value < 1) {
      setError('불출 수량을 입력하세요.')
      setOkMessage('')
      return
    }
    if (value > action.remainingProductQuantity) {
      setError(
        `남은 주문 수량(${action.remainingProductQuantity.toLocaleString('ko-KR')})을 초과할 수 없습니다.`,
      )
      setOkMessage('')
      return
    }
    if (value > action.issuableQuantity) {
      setError(
        `불출가능 수량(${action.issuableQuantity.toLocaleString('ko-KR')})을 초과할 수 없습니다.`,
      )
      setOkMessage('')
      return
    }

    const filter: OutboundBucketFilter = {
      bucket: action.materialBucket,
      bucketByMaterialId,
    }
    const items = buildOutboundLinesForProductQuantity(
      action.productId,
      value,
      edgesByParent,
      filter,
    )
    if (!items.length) {
      setError('BOM 구성이 없어 불출할 자재가 없습니다.')
      setOkMessage('')
      return
    }

    setSaving(true)
    setError('')
    setOkMessage('')

    const result = await createMaterialOutbound({
      outbound_date: todayYmdSeoul(),
      outbound_type: 'production',
      order_id: action.orderId,
      note: `${action.productName} ${value}대 ${bucketLabel}`,
      items,
    })

    setSaving(false)

    if (!result.ok) {
      setError(result.detail)
      return
    }

    setOkMessage(`${result.outboundNumber} 등록 · ${value.toLocaleString('ko-KR')}대`)
    setQty('')
    onIssued()
  }

  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge
              label={bucketLabel}
              className={BUCKET_BADGE_CLASS[action.materialBucket]}
            />
          </div>
        </div>
        {maxQty < 1 ? (
          <StatusBadge label="재고부족" className="bg-rose-100 text-rose-800" />
        ) : (
          <StatusBadge label="불출가능" className="bg-emerald-100 text-emerald-800" />
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
        <div>
          <p className="text-slate-400">주문잔량</p>
          <p className="font-semibold tabular-nums text-slate-800">
            {action.remainingProductQuantity.toLocaleString('ko-KR')}
          </p>
        </div>
        <div>
          <p className="text-slate-400">불출가능</p>
          <p
            className={`font-semibold tabular-nums ${
              action.issuableQuantity > 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {action.issuableQuantity.toLocaleString('ko-KR')}
          </p>
        </div>
        <div>
          <p className="text-slate-400">주문</p>
          <p className="font-semibold tabular-nums text-slate-800">
            {action.productQuantity.toLocaleString('ko-KR')}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-col gap-1.5">
        <input
          type="number"
          min={1}
          max={maxQty || undefined}
          step={1}
          value={qty}
          disabled={saving || maxQty < 1}
          onChange={(event) => {
            setQty(event.target.value)
            setError('')
            setOkMessage('')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleIssue()
          }}
          placeholder="불출수량"
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-xs font-semibold tabular-nums outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100"
        />
        <button
          type="button"
          disabled={saving || maxQty < 1}
          onClick={() => void handleIssue()}
          className="w-full rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? '처리 중…' : bucketLabel}
        </button>
      </div>

      {error ? <p className="mt-2 text-[11px] font-medium text-rose-600">{error}</p> : null}
      {okMessage ? <p className="mt-2 text-[11px] font-medium text-emerald-700">{okMessage}</p> : null}
      {maxQty < 1 ? (
        <p className="mt-2 text-[11px] text-slate-500">현재고 부족 또는 미불출 잔량이 없습니다.</p>
      ) : null}
    </li>
  )
}

export function OutboundNeedsTable({ cards, bomEdges, materials, onIssued }: OutboundNeedsTableProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set())

  const edgesByParent = useMemo(() => {
    const map = new Map<string, BomEdge[]>()
    for (const edge of bomEdges) {
      if (!edge.parentProductId || !edge.childProductId) continue
      const list = map.get(edge.parentProductId) || []
      list.push(edge)
      map.set(edge.parentProductId, list)
    }
    return map
  }, [bomEdges])

  const bucketByMaterialId = useMemo(
    () =>
      new Map<string, OutboundMaterialBucket>(
        materials.map((material) => [material.id, resolveMaterialBucket(material.type)]),
      ),
    [materials],
  )

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
        message="미불출 주문이 없습니다"
        hint="주문·BOM 기준으로 아직 남은 자재 소요가 있으면 여기에 표시됩니다."
      />
    )
  }

  return (
    <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const expanded = expandedKeys.has(card.key)
        const productGroups = groupActionsByProduct(card.actions)

        return (
          <article
            key={card.key}
            className={[
              'flex flex-col rounded-xl border border-slate-200 border-l-4 bg-white shadow-sm',
              borderClass(card),
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
                    label={
                      card.issuableActionCount > 0
                        ? `불출가능 ${card.issuableActionCount}`
                        : '대기'
                    }
                    className={
                      card.issuableActionCount > 0
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-slate-100 text-slate-600'
                    }
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
                <p className="truncate text-sm font-medium text-slate-800" title={card.productLabel}>
                  {card.productLabel}
                </p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  품목 {card.productCount.toLocaleString('ko-KR')} · 액션{' '}
                  <span className="tabular-nums text-slate-700">
                    {card.actions.length.toLocaleString('ko-KR')}
                  </span>
                  {expanded ? ' · 접기' : ' · 펼치기'}
                </p>
              </div>
            </button>

            {expanded ? (
              <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3">
                {productGroups.map((group) => (
                  <div key={group.productId} className="space-y-2">
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold text-slate-900"
                        title={group.productName}
                      >
                        {group.productName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        주문수량 {group.productQuantity.toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <ul className="grid grid-cols-2 gap-2">
                      {group.actions.map((action) => (
                        <OutboundBucketAction
                          key={action.key}
                          action={action}
                          edgesByParent={edgesByParent}
                          bucketByMaterialId={bucketByMaterialId}
                          onIssued={onIssued}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
