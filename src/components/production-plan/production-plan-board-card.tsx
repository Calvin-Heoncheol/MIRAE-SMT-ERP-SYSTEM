'use client'

import { displayOrderPoNumber, todayYmdSeoul } from '@/lib/orders/utils'
import { formatPlanPcbSideBadge, pcbSideChipClass } from '@/lib/products/utils'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import { ERP_BOARD_CHIP_CLASS } from '@/lib/ui/tokens'

type ProductionPlanBoardCardProps = {
  row: ProductionPlanBoardRow
  tone: 'smt' | 'post'
  onSelect?: (row: ProductionPlanBoardRow) => void
  /** 다일 계획에서 오늘 칸이 시작일이 아닐 때 */
  spanDay?: boolean
  /** 이동 중인 카드 강조 */
  highlighted?: boolean
  onStartMove?: (row: ProductionPlanBoardRow) => void
}

/** 주간 보드에 올라간 확정(배정) 카드 */
export function ProductionPlanBoardCard({
  row,
  tone,
  onSelect,
  spanDay = false,
  highlighted = false,
  onStartMove,
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
  const planned = Math.max(0, Math.round(Number(row.plannedQuantity) || 0))
  const produced = Math.max(0, Math.round(Number(row.planProducedQty) || 0))
  const endDate = (row.plannedEndDate || row.plannedDate).slice(0, 10)
  const today = todayYmdSeoul()
  const isLate = Boolean(endDate) && endDate < today && produced < planned
  const multiDay =
    Boolean(row.plannedEndDate) &&
    row.plannedEndDate!.slice(0, 10) !== row.plannedDate.slice(0, 10)
  const tooltip = [
    `발주 ${orderLabel}`,
    row.customer ? `고객사 ${row.customer}` : '',
    `모델 ${row.productName || '—'}`,
    `계획 ${planned.toLocaleString('ko-KR')}EA`,
    multiDay
      ? `기간 ${row.plannedDate.slice(5, 10).replace('-', '/')}–${endDate.slice(5).replace('-', '/')}`
      : '',
    row.deliveryDate?.trim() ? `납기 ${row.deliveryDate.trim().slice(0, 10)}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div
      role="button"
      tabIndex={0}
      title={tooltip}
      onClick={(event) => {
        event.stopPropagation()
        onSelect?.(row)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        event.stopPropagation()
        onSelect?.(row)
      }}
      className={`group/card relative w-full min-w-0 cursor-pointer rounded-md border border-l-4 py-1.5 pl-2 pr-1.5 text-left leading-tight text-slate-900 shadow-sm transition hover:shadow ${
        highlighted ? 'animate-pulse ring-2 ring-amber-400 ring-offset-1' : ''
      } ${isLate ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white hover:bg-slate-50'} ${
        isLate
          ? 'border-l-rose-500'
          : sideLabel === 'TOP'
            ? 'border-l-sky-500'
            : sideLabel === 'BOT'
              ? 'border-l-indigo-500'
              : sideLabel === 'DOUBLE'
                ? 'border-l-amber-500'
                : isSmt
                  ? 'border-l-sky-400'
                  : 'border-l-violet-400'
      }`}
    >
      {onStartMove ? (
        <button
          type="button"
          title="다른 날짜·라인으로 이동"
          onClick={(event) => {
            event.stopPropagation()
            onStartMove(row)
          }}
          className="absolute right-1 top-1 rounded border border-current/20 bg-white px-1 text-[10px] font-semibold opacity-0 shadow-sm transition hover:bg-slate-50 group-hover/card:opacity-100 focus:opacity-100"
        >
          이동
        </button>
      ) : null}
      <p className="truncate text-xs font-bold tracking-tight">{row.productName || '—'}</p>
      <div className="mt-1 flex min-w-0 items-center gap-1.5 tabular-nums">
        {sideLabel ? (
          <span
            className={`${ERP_BOARD_CHIP_CLASS} shrink-0 ${
              sideLabel === 'DOUBLE'
                ? 'bg-amber-100 text-amber-800'
                : pcbSideChipClass(sideLabel)
            }`}
          >
            {sideLabel}
          </span>
        ) : null}
        <span className="truncate">
          <span className="text-sm font-extrabold">{planned.toLocaleString('ko-KR')}</span>
          <span className="ml-0.5 text-[10px] font-medium text-slate-500">EA</span>
          {spanDay ? <span className="ml-1 text-[10px] text-slate-400">연속</span> : null}
        </span>
      </div>
    </div>
  )
}
