'use client'

import { formatInternalCodeLabel, todayYmdSeoul } from '@/lib/orders/utils'
import type { SmtPlanBlock } from '@/lib/smt/plan/types'
import {
  daysUntilYmd,
  formatDeliveryCountdown,
  getDeliveryUrgencyTone,
  resolveSmtPlanExecutionStatus,
  type SmtPlanExecutionStatus,
} from '@/lib/smt/plan/utils'

type SmtPlanBlockProps = {
  plan: SmtPlanBlock
  producedQuantity?: number
  draggable?: boolean
  onClick?: () => void
  onDragStart?: (event: React.DragEvent) => void
  onDragEnd?: () => void
}

function executionClass(status: SmtPlanExecutionStatus, daysUntilDelivery: number | null) {
  if (status === 'done') return 'border-emerald-300 bg-emerald-50'
  if (status === 'progress') return 'border-amber-300 bg-amber-50'
  const tone = getDeliveryUrgencyTone(daysUntilDelivery)
  if (tone === 'overdue') return 'border-rose-300 bg-rose-50'
  if (tone === 'urgent') return 'border-amber-300 bg-amber-50'
  return 'border-sky-200 bg-sky-50'
}

function executionBadgeClass(status: SmtPlanExecutionStatus) {
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

function progressBarClass(status: SmtPlanExecutionStatus) {
  if (status === 'done') return 'bg-emerald-500'
  if (status === 'progress') return 'bg-amber-500'
  return 'bg-sky-500'
}

export function SmtPlanBlockCard({
  plan,
  producedQuantity = 0,
  draggable = true,
  onClick,
  onDragStart,
  onDragEnd,
}: SmtPlanBlockProps) {
  const daysUntilDelivery = plan.deliveryDate
    ? daysUntilYmd(todayYmdSeoul(), plan.deliveryDate)
    : null
  const dueLabel = formatDeliveryCountdown(daysUntilDelivery)
  const status = resolveSmtPlanExecutionStatus(plan.plannedQuantity, producedQuantity)
  const produced = Math.max(0, Math.floor(producedQuantity))
  const planned = Math.max(0, Math.floor(plan.plannedQuantity))
  const progressPct =
    planned > 0 ? Math.min(100, Math.round((produced / planned) * 100)) : produced > 0 ? 100 : 0

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
      <div className="mt-0.5 flex min-w-0 items-center gap-1">
        <p className="min-w-0 truncate text-[11px] font-bold text-slate-900">{plan.productSummary}</p>
        {plan.pcbSide === 'TOP' || plan.pcbSide === 'BOT' ? (
          <span className="shrink-0 rounded bg-white/80 px-1 py-0.5 text-[9px] font-bold text-slate-700">
            {plan.pcbSide}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 space-y-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/70 ring-1 ring-black/5">
          <div
            className={`h-full rounded-full transition-[width] ${progressBarClass(status)}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[10px] font-semibold tabular-nums text-sky-800">
          {produced.toLocaleString('ko-KR')}/{planned.toLocaleString('ko-KR')}대
        </p>
      </div>
    </button>
  )
}
