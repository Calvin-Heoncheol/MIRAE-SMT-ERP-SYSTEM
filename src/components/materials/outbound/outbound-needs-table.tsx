'use client'

import { useMemo, useState } from 'react'
import { createMaterialOutbound } from '@/lib/materials/outbound/repository'
import {
  buildOutboundLinesForProductQuantity,
  resolveMaterialBucket,
  type OutboundBucketFilter,
} from '@/lib/materials/outbound/utils'
import type {
  BomEdge,
  MaterialOutboundNeedCard,
  OutboundMaterialBucket,
} from '@/lib/materials/outbound/types'
import { OUTBOUND_MATERIAL_BUCKET_LABELS } from '@/lib/materials/outbound/types'
import type { Material } from '@/lib/materials/types'
import { todayYmdSeoul } from '@/lib/orders/utils'

type OutboundNeedsTableProps = {
  cards: MaterialOutboundNeedCard[]
  bomEdges: BomEdge[]
  materials: Material[]
  onIssued: () => void
}

const BUCKET_BADGE_CLASS: Record<OutboundMaterialBucket, string> = {
  SMD: 'bg-blue-100 text-blue-700',
  DIP: 'bg-emerald-100 text-emerald-700',
  ETC: 'bg-slate-100 text-slate-600',
}

const BUCKET_CARD_BORDER_CLASS: Record<OutboundMaterialBucket, string> = {
  SMD: 'border-l-blue-400',
  DIP: 'border-l-emerald-400',
  ETC: 'border-l-slate-300',
}

const BUCKET_TARGET_TEAM: Record<OutboundMaterialBucket, string> = {
  SMD: '생산1팀',
  DIP: '생산2·3·4팀',
  ETC: '구분 미지정',
}

function OutboundNeedCardItem({
  card,
  edgesByParent,
  bucketByMaterialId,
  onIssued,
}: {
  card: MaterialOutboundNeedCard
  edgesByParent: Map<string, BomEdge[]>
  bucketByMaterialId: Map<string, OutboundMaterialBucket>
  onIssued: () => void
}) {
  const defaultQty = Math.min(card.issuableQuantity, card.remainingProductQuantity)
  const [qty, setQty] = useState(defaultQty > 0 ? String(defaultQty) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [okMessage, setOkMessage] = useState('')

  const maxQty = Math.min(card.issuableQuantity, card.remainingProductQuantity)
  const bucketLabel = OUTBOUND_MATERIAL_BUCKET_LABELS[card.materialBucket]

  async function handleIssue() {
    const value = Math.floor(Number(qty) || 0)
    if (value < 1) {
      setError('불출 수량을 입력하세요.')
      setOkMessage('')
      return
    }
    if (value > card.remainingProductQuantity) {
      setError(`남은 주문 수량(${card.remainingProductQuantity.toLocaleString('ko-KR')})을 초과할 수 없습니다.`)
      setOkMessage('')
      return
    }
    if (value > card.issuableQuantity) {
      setError(`불출가능 수량(${card.issuableQuantity.toLocaleString('ko-KR')})을 초과할 수 없습니다.`)
      setOkMessage('')
      return
    }

    const filter: OutboundBucketFilter = {
      bucket: card.materialBucket,
      bucketByMaterialId,
    }
    const items = buildOutboundLinesForProductQuantity(card.productId, value, edgesByParent, filter)
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
      order_id: card.orderId,
      note: `${card.productName} ${value}대 ${bucketLabel}`,
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
    <article
      className={`flex flex-col rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${BUCKET_CARD_BORDER_CLASS[card.materialBucket]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold text-slate-900">{card.orderNumber}</p>
          <p className="mt-1 truncate text-sm text-slate-600">{card.customer || '—'}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${BUCKET_BADGE_CLASS[card.materialBucket]}`}
        >
          {bucketLabel}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-start justify-between gap-2">
          <span className="shrink-0 text-slate-500">품목</span>
          <span className="min-w-0 text-right font-medium text-slate-900" title={card.productName}>
            {card.productName}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">불출 대상</span>
          <span className="font-medium text-slate-800">{BUCKET_TARGET_TEAM[card.materialBucket]}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">수량</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {card.productQuantity.toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">불출가능</span>
          <span
            className={`font-semibold tabular-nums ${
              card.issuableQuantity > 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {card.issuableQuantity.toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">생산 납기일</span>
          <span className="tabular-nums text-slate-800">{card.deliveryDate || '—'}</span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
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
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-right text-sm font-semibold tabular-nums outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50"
        />
        <button
          type="button"
          disabled={saving || maxQty < 1}
          onClick={() => void handleIssue()}
          className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? '처리 중…' : bucketLabel}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
      {okMessage ? <p className="mt-2 text-xs font-medium text-emerald-700">{okMessage}</p> : null}
      {maxQty < 1 ? (
        <p className="mt-2 text-xs text-slate-500">현재고 부족 또는 미불출 잔량이 없습니다.</p>
      ) : null}
    </article>
  )
}

export function OutboundNeedsTable({ cards, bomEdges, materials, onIssued }: OutboundNeedsTableProps) {
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

  if (!cards.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center">
        <p className="text-base font-semibold text-slate-700">미불출 주문이 없습니다</p>
        <p className="mt-2 text-sm text-slate-500">
          주문·BOM 기준으로 아직 남은 자재 소요가 있으면 여기에 표시됩니다.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <h3 className="text-sm font-bold text-slate-800">미불출 주문</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          SMD 자재는 생산1팀, DIP 자재는 생산2·3·4팀 불출입니다. 불출가능은 현재고·BOM 기준이며 수량을
          입력하고 바로 불출하세요.
        </p>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <OutboundNeedCardItem
            key={card.key}
            card={card}
            edgesByParent={edgesByParent}
            bucketByMaterialId={bucketByMaterialId}
            onIssued={onIssued}
          />
        ))}
      </div>
    </div>
  )
}
