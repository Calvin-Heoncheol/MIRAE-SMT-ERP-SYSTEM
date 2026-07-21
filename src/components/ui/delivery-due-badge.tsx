import { todayYmdSeoul } from '@/lib/orders/utils'
import {
  daysUntilYmd,
  formatDeliveryCountdown,
  getDeliveryUrgencyTone,
} from '@/lib/smt/plan/utils'

type DeliveryDueBadgeProps = {
  deliveryDate: string
  /** 출하 완료 — 긴급 표시 없이 날짜만 */
  done?: boolean
}

/** 납기일 + D-day 뱃지 (3일 이내 주황 · 지연 빨강) */
export function DeliveryDueBadge({ deliveryDate, done = false }: DeliveryDueBadgeProps) {
  if (!deliveryDate) {
    return <span className="text-sm text-slate-400">—</span>
  }

  if (done) {
    return <span className="text-sm tabular-nums text-slate-400">{deliveryDate}</span>
  }

  const daysUntil = daysUntilYmd(todayYmdSeoul(), deliveryDate)
  const tone = getDeliveryUrgencyTone(daysUntil)

  if (tone === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-sm tabular-nums font-medium text-rose-700">{deliveryDate}</span>
        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
          {formatDeliveryCountdown(daysUntil)}
        </span>
      </span>
    )
  }

  if (tone === 'urgent') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-sm tabular-nums font-medium text-amber-800">{deliveryDate}</span>
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
          {formatDeliveryCountdown(daysUntil)}
        </span>
      </span>
    )
  }

  return <span className="text-sm tabular-nums text-slate-700">{deliveryDate}</span>
}
