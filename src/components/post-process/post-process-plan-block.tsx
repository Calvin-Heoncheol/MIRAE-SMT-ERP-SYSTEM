'use client'

import { formatInternalCodeLabel, todayYmdSeoul } from '@/lib/orders/utils'
import type { PostProcessPlanBlock } from '@/lib/post-process/plan/types'
import {
  daysUntilYmd,
  formatDeliveryCountdown,
  getDeliveryUrgencyTone,
  resolveSmtPlanExecutionStatus,
  type PostProcessPlanExecutionStatus,
} from '@/lib/post-process/plan/utils'

type PostProcessPlanBlockProps = {
  plan: PostProcessPlanBlock
  producedQuantity?: number
  draggable?: boolean
  onClick?: () => void
  onDragStart?: (event: React.DragEvent) => void
  onDragEnd?: () => void
}

function executionClass(status: PostProcessPlanExecutionStatus, daysUntilDelivery: number | null) {
  if (status === 'done') return 'border-emerald-300 bg-emerald-50'
  if (status === 'progress') return 'border-amber-300 bg-amber-50'
  const tone = getDeliveryUrgencyTone(daysUntilDelivery)
  if (tone === 'overdue') return 'border-rose-300 bg-rose-50'
  if (tone === 'urgent') return 'border-amber-300 bg-amber-50'
  return 'border-sky-200 bg-sky-50'
}

function executionBadgeClass(status: PostProcessPlanExecutionStatus) {
  if (status === 'done') return 'bg-emerald-100 text-emerald-800'
  if (status === 'progress') return 'bg-amber-100 text-amber-800'
  return 'bg-sky-100 text-sky-800'
}

function urgencyBadgeClass(daysUntilDelivery: number | null) {
  const tone = getDeliveryUrgencyTone(daysUntilDelivery)
  if (tone === 'overdue') return 'bg-rose-100 text-rose-700'
  if (tone === 'urgent') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

export function PostProcessPlanBlockCard({
  plan,
  producedQuantity = 0,
  draggable = true,
  onClick,
  onDragStart,
  onDragEnd,
}: PostProcessPlanBlockProps) {
  const daysUntilDelivery = plan.deliveryDate
    ? daysUntilYmd(todayYmdSeoul(), plan.deliveryDate)
    : null
  const dueLabel = formatDeliveryCountdown(daysUntilDelivery)
  const status = resolveSmtPlanExecutionStatus(plan.plannedQuantity, producedQuantity)
  const produced = Math.max(0, Math.floor(producedQuantity))
  const planned = Math.max(0, Math.floor(plan.plannedQuantity))

  return (
    <button
      type="button"
      draggable={draggable}
      onClick={onClick}
      onDragStart={(event) => {
        event.stopPropagation()
        onDragStart?.(event)
      }}
      onDragEnd={onDragEnd}
      className={`w-full rounded-lg border px-2 py-1.5 text-left shadow-sm transition hover:shadow ${executionClass(status, daysUntilDelivery)} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="min-w-0 truncate text-[10px] text-slate-500">
          {plan.customer || '—'} · {formatInternalCodeLabel(plan.orderNumber)}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${executionBadgeClass(status)}`}>
            {status === 'done' ? '완료' : status === 'progress' ? '진행' : '예정'}
          </span>
          {dueLabel ? (
            <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${urgencyBadgeClass(daysUntilDelivery)}`}>
              {dueLabel}
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-0.5 truncate text-[11px] font-bold text-slate-900">{plan.productSummary}</p>
      <p className="mt-1 text-[10px] font-semibold tabular-nums text-sky-800">
        {produced.toLocaleString('ko-KR')}/{planned.toLocaleString('ko-KR')}대
      </p>
    </button>
  )
}
