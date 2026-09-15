'use client'

import type { DragEvent } from 'react'
import {
  SHARED_PRODUCTION_PLAN_DRAG_MIME,
  type ProductionPlanDragPayload,
} from '@/lib/production-plan/config'
import { displayOrderPoNumber, todayYmdSeoul } from '@/lib/orders/utils'
import { formatPlanPcbSideBadge, pcbSideChipClass } from '@/lib/products/utils'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import { ERP_BOARD_CHIP_CLASS } from '@/lib/ui/tokens'

type ProductionPlanBoardCardProps = {
  row: ProductionPlanBoardRow
  tone: 'smt' | 'post'
  onSelect?: (row: ProductionPlanBoardRow) => void
  draggable?: boolean
  /** 다일 계획에서 오늘 칸이 시작일이 아닐 때 */
  spanDay?: boolean
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
  spanDay = false,
}: ProductionPlanBoardCardProps) {
  const orderLabel =
    displayOrderPoNumber(row.customerPoNumber, row.orderNumber) || row.orderNumber || '—'
  const isSmt = tone === 'smt'
  const sideLabel = isSmt
    ? formatPlanPcbSideBadge({
        pcbSideMode: row.pcbSideMode,
        pcbSide: row.pcbSide,
        splitPcbSides: row.splitPcbSides,
      })
    : null
  const deliveryShort = row.deliveryDate?.trim()
    ? row.deliveryDate.trim().slice(5).replace('-', '/')
    : ''
  const planned = Math.max(0, Math.round(Number(row.plannedQuantity) || 0))
  const produced = Math.max(0, Math.round(Number(row.planProducedQty) || 0))
  const endDate = (row.plannedEndDate || row.plannedDate).slice(0, 10)
  const today = todayYmdSeoul()
  const isLate = Boolean(endDate) && endDate < today && produced < planned
  const multiDay =
    Boolean(row.plannedEndDate) &&
    row.plannedEndDate!.slice(0, 10) !== row.plannedDate.slice(0, 10)

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
        isLate
          ? 'border-rose-300 bg-rose-50 text-rose-950'
          : sideLabel === 'TOP'
            ? 'border-sky-300 bg-sky-50 text-sky-950'
            : sideLabel === 'BOT'
              ? 'border-indigo-300 bg-indigo-50 text-indigo-950'
              : sideLabel === 'DOUBLE'
                ? 'border-amber-300 bg-amber-50 text-amber-950'
                : isSmt
                  ? 'border-sky-200 bg-sky-50 text-sky-900'
                  : 'border-violet-200 bg-violet-50 text-violet-900'
      }`}
    >
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 truncate font-mono text-[11px] font-semibold opacity-80">
          {orderLabel}
        </p>
        {sideLabel ? (
          <span
            className={`${ERP_BOARD_CHIP_CLASS} ${
              sideLabel === 'DOUBLE'
                ? 'bg-amber-100 text-amber-800'
                : pcbSideChipClass(sideLabel)
            }`}
          >
            {sideLabel}
          </span>
        ) : null}
        {isLate ? (
          <span className={`${ERP_BOARD_CHIP_CLASS} bg-rose-100 text-rose-800`}>지연</span>
        ) : null}
      </div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1">
        <p className="min-w-0 flex-1 truncate font-semibold">{row.productName || '—'}</p>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-1 tabular-nums opacity-90">
        <span>
          계획 <strong>{planned.toLocaleString('ko-KR')}</strong>
          {planned > 0 ? (
            <span className="opacity-80">
              {' '}
              · 실적 {produced.toLocaleString('ko-KR')}
            </span>
          ) : null}
        </span>
        {deliveryShort ? <span className="truncate text-[11px] opacity-80">납기 {deliveryShort}</span> : null}
      </div>
      {multiDay ? (
        <p className="mt-0.5 truncate text-[10px] opacity-70">
          {row.plannedDate.slice(5).replace('-', '/')}–{endDate.slice(5).replace('-', '/')}
          {spanDay ? ' · 연속' : ''}
        </p>
      ) : null}
    </button>
  )
}
