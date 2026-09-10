'use client'

import type { DragEvent } from 'react'
import {
  SHARED_PRODUCTION_PLAN_DRAG_MIME,
  type ProductionPlanDragPayload,
} from '@/lib/production-plan/config'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { ProductionPlanBoardRow, ProductionPlanPcbSide } from '@/lib/production-plan/types'
import { ERP_BOARD_CHIP_CLASS } from '@/lib/ui/tokens'

function pcbSideBadge(pcbSide: ProductionPlanPcbSide | undefined) {
  if (pcbSide === 'TOP' || pcbSide === 'BOT') return pcbSide
  if (pcbSide === 'BOTH') return 'TOP·BOT'
  return 'SINGLE'
}

type ProductionPlanBoardCardProps = {
  row: ProductionPlanBoardRow
  tone: 'smt' | 'post'
  onSelect?: (row: ProductionPlanBoardRow) => void
  draggable?: boolean
}

function setDragPayload(event: DragEvent, payload: ProductionPlanDragPayload) {
  const raw = JSON.stringify(payload)
  event.dataTransfer.setData(SHARED_PRODUCTION_PLAN_DRAG_MIME, raw)
  event.dataTransfer.setData('text/plain', raw)
  event.dataTransfer.effectAllowed = 'copy'
}

/** 주간 보드에 올라간 확정(배정) 카드 */
export function ProductionPlanBoardCard({
  row,
  tone,
  onSelect,
  draggable = true,
}: ProductionPlanBoardCardProps) {
  const orderLabel =
    displayOrderPoNumber(row.customerPoNumber, row.orderNumber) || row.orderNumber || '—'
  const isSmt = tone === 'smt'
  const sideLabel = pcbSideBadge(row.pcbSide)
  const showSideBadge = isSmt || sideLabel === 'TOP' || sideLabel === 'BOT' || sideLabel === 'TOP·BOT'
  const deliveryShort = row.deliveryDate?.trim()
    ? row.deliveryDate.trim().slice(5).replace('-', '/')
    : ''
  const planned = Math.max(0, Math.round(Number(row.plannedQuantity) || 0))

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return
        setDragPayload(event, {
          kind: 'order',
          key: row.key,
          scope: row.scope,
        })
      }}
      onClick={() => onSelect?.(row)}
      className={`w-full rounded-md border px-1.5 py-1.5 text-left text-[11px] leading-snug shadow-sm transition hover:brightness-95 ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${
        isSmt
          ? 'border-sky-200 bg-sky-50 text-sky-900'
          : 'border-violet-200 bg-violet-50 text-violet-900'
      }`}
    >
      <p className="truncate font-mono text-[11px] font-semibold opacity-80">{orderLabel}</p>
      <div className="mt-0.5 flex min-w-0 items-center gap-1">
        <p className="min-w-0 flex-1 truncate font-semibold">{row.productName || '—'}</p>
        {showSideBadge ? (
          <span
            className={`${ERP_BOARD_CHIP_CLASS} ${
              isSmt ? 'bg-white/80 text-sky-800' : 'bg-white/80 text-violet-800'
            }`}
          >
            {sideLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-1 tabular-nums opacity-90">
        <span>
          계획 <strong>{planned.toLocaleString('ko-KR')}</strong>
        </span>
        {deliveryShort ? <span className="truncate text-[11px] opacity-80">납기 {deliveryShort}</span> : null}
      </div>
    </button>
  )
}
