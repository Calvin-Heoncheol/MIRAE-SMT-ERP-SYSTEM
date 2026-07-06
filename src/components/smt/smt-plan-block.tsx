'use client'

import { formatInternalCodeLabel, todayYmdSeoul } from '@/lib/orders/utils'
import type { SmtPlanBlock, SmtPlanOrderCandidate } from '@/lib/smt/plan/types'
import {
  daysUntilYmd,
  formatDeliveryCountdown,
  getDeliveryUrgencyTone,
} from '@/lib/smt/plan/utils'

type SmtPlanBlockProps = {
  plan: SmtPlanBlock
  draggable?: boolean
  onClick?: () => void
  onDragStart?: (event: React.DragEvent) => void
  onDragEnd?: () => void
}

function urgencyClass(daysUntilDelivery: number | null) {
  const tone = getDeliveryUrgencyTone(daysUntilDelivery)
  if (tone === 'overdue') return 'border-rose-300 bg-rose-50'
  if (tone === 'urgent') return 'border-amber-300 bg-amber-50'
  return 'border-sky-200 bg-sky-50'
}

function urgencyBadgeClass(daysUntilDelivery: number | null) {
  const tone = getDeliveryUrgencyTone(daysUntilDelivery)
  if (tone === 'overdue') return 'bg-rose-100 text-rose-700'
  if (tone === 'urgent') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

export function SmtPlanBlockCard({
  plan,
  draggable = true,
  onClick,
  onDragStart,
  onDragEnd,
}: SmtPlanBlockProps) {
  const daysUntilDelivery = plan.deliveryDate
    ? daysUntilYmd(todayYmdSeoul(), plan.deliveryDate)
    : null
  const dueLabel = formatDeliveryCountdown(daysUntilDelivery)

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
      className={`w-full rounded-lg border px-2 py-1.5 text-left shadow-sm transition hover:shadow ${urgencyClass(daysUntilDelivery)} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="truncate font-mono text-[10px] font-bold text-slate-800" title={plan.orderNumber}>
          {formatInternalCodeLabel(plan.orderNumber)}
        </p>
        {dueLabel ? (
          <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${urgencyBadgeClass(daysUntilDelivery)}`}>
            {dueLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 truncate text-[10px] text-slate-600">{plan.customer || '—'}</p>
      <p className="truncate text-[10px] font-medium text-slate-700">{plan.productSummary}</p>
      <p className="mt-1 text-[10px] font-semibold tabular-nums text-sky-800">
        {plan.plannedQuantity.toLocaleString('ko-KR')}대
      </p>
    </button>
  )
}

type SmtPlanOrderCardProps = {
  order: SmtPlanOrderCandidate
}

export function SmtPlanOrderCard({ order }: SmtPlanOrderCardProps) {
  const dueLabel = formatDeliveryCountdown(order.daysUntilDelivery)

  return (
    <div
      className={`rounded-xl border bg-white px-3 py-2.5 shadow-sm transition hover:shadow-md ${getDeliveryUrgencyTone(order.daysUntilDelivery) === 'urgent' || getDeliveryUrgencyTone(order.daysUntilDelivery) === 'overdue' ? 'border-amber-300' : 'border-slate-200'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs font-bold text-slate-900" title={order.orderNumber}>
          {formatInternalCodeLabel(order.orderNumber)}
        </p>
        {dueLabel ? (
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${urgencyBadgeClass(order.daysUntilDelivery)}`}
          >
            {dueLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-slate-600">{order.customer || '—'}</p>
      <p className="mt-0.5 truncate text-xs font-medium text-slate-800">{order.productSummary}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] tabular-nums text-slate-500">
        <span>잔여 {order.unplannedRemaining.toLocaleString('ko-KR')}대</span>
        <span>
          SMT {order.smtProduced.toLocaleString('ko-KR')}/{order.smtTarget.toLocaleString('ko-KR')}
        </span>
      </div>
    </div>
  )
}
