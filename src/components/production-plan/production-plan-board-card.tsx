'use client'

import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { ProductionPlanBoardRow, ProductionPlanPcbSide } from '@/lib/production-plan/types'

function pcbSideBadge(pcbSide: ProductionPlanPcbSide | undefined) {
  if (pcbSide === 'TOP' || pcbSide === 'BOT') return pcbSide
  if (pcbSide === 'BOTH') return 'TOP·BOT'
  return 'SINGLE'
}

type ProductionPlanBoardCardProps = {
  row: ProductionPlanBoardRow
  tone: 'smt' | 'post'
  onSelect?: (row: ProductionPlanBoardRow) => void
}

/** 주간 보드에 올라간 확정(배정) 카드 */
export function ProductionPlanBoardCard({ row, tone, onSelect }: ProductionPlanBoardCardProps) {
  const orderLabel =
    displayOrderPoNumber(row.customerPoNumber, row.orderNumber) || row.orderNumber || '—'
  const isSmt = tone === 'smt'
  const sideLabel = pcbSideBadge(row.pcbSide)
  const showSideBadge = isSmt || sideLabel === 'TOP' || sideLabel === 'BOT' || sideLabel === 'TOP·BOT'
  const deliveryShort = row.deliveryDate?.trim()
    ? row.deliveryDate.trim().slice(5).replace('-', '/')
    : ''

  return (
    <button
      type="button"
      onClick={() => onSelect?.(row)}
      className={`w-full rounded-md border px-1.5 py-1.5 text-left text-[10px] leading-snug shadow-sm transition hover:brightness-95 ${
        isSmt
          ? 'border-sky-200 bg-sky-50 text-sky-900'
          : 'border-violet-200 bg-violet-50 text-violet-900'
      }`}
    >
      <p className="truncate font-mono text-[9px] font-semibold opacity-80">{orderLabel}</p>
      <div className="mt-0.5 flex min-w-0 items-center gap-1">
        <p className="min-w-0 flex-1 truncate font-semibold">{row.productName || '—'}</p>
        {showSideBadge ? (
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${
              isSmt ? 'bg-white/80 text-sky-800' : 'bg-white/80 text-violet-800'
            }`}
          >
            {sideLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-1 tabular-nums opacity-90">
        <span>
          계획 <strong>{(row.plannedQuantity ?? 0).toLocaleString('ko-KR')}</strong>대
        </span>
        {deliveryShort ? <span className="truncate text-[9px] opacity-80">납기 {deliveryShort}</span> : null}
      </div>
    </button>
  )
}
