'use client'

import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { MaterialManualOrderMetrics } from '@/lib/materials/manual/types'
import {
  getMaterialInboundState,
  materialInboundFilterLabel,
  materialInboundProgressPercent,
  materialOutboundProgressPercent,
  type MaterialInboundState,
} from '@/lib/materials/manual/utils'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductDisplay } from '@/lib/production-input/utils'
import {
  ERP_BADGE_COMPACT_CLASS,
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_ROW_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TD_FIXED_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

type MaterialManualTableProps = {
  orders: ProductionOrderLine[]
  metricsByLineId: Record<string, MaterialManualOrderMetrics>
  emptyMessage?: string
  onOrderClick?: (order: ProductionOrderLine) => void
}

function MiniProgress({
  percent,
  tone,
  detail,
}: {
  percent: number
  tone: 'amber' | 'sky'
  detail: string
}) {
  const barClass = tone === 'amber' ? 'bg-amber-500' : 'bg-sky-500'
  const width = Math.max(0, Math.min(100, percent))

  return (
    <div className="min-w-[108px]">
      <p className="mb-1.5 text-xs font-semibold tabular-nums text-slate-700">{detail}</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        {width > 0 ? (
          <div className={`h-full shrink-0 ${barClass}`} style={{ width: `${width}%` }} />
        ) : null}
      </div>
    </div>
  )
}

function materialStateBadgeClass(state: MaterialInboundState) {
  if (state === 'full') return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
  if (state === 'partial') return 'bg-amber-50 text-amber-800 ring-amber-200'
  return 'bg-slate-100 text-slate-600 ring-slate-200'
}

function ProgressCell({
  percent,
  tone,
  detail,
  label,
  onClick,
}: {
  percent: number
  tone: 'amber' | 'sky'
  detail: string
  label: string
  onClick?: () => void
}) {
  const content = <MiniProgress percent={percent} tone={tone} detail={detail} />

  if (!onClick) {
    return <td className={`${ERP_TABLE_TD_CLASS} align-top`}>{content}</td>
  }

  return (
    <td className={`${ERP_TABLE_TD_CLASS} align-top`}>
      <button
        type="button"
        onClick={onClick}
        title={`${label} 클릭하여 입고·불출 등록`}
        className="w-full rounded-lg px-1 py-0.5 text-left transition hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        {content}
      </button>
    </td>
  )
}

export function MaterialManualTable({
  orders,
  metricsByLineId,
  emptyMessage,
  onOrderClick,
}: MaterialManualTableProps) {
  if (!orders.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage ?? '표시할 발주가 없습니다'} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className={`${ERP_TABLE_CLASS} min-w-[960px]`}>
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>발주서</th>
              <th className={ERP_TABLE_TH_CLASS}>고객사</th>
              <th className={ERP_TABLE_TH_CLASS}>제품</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>버전</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>납기</th>
              <th className={ERP_TABLE_TH_CLASS}>입고</th>
              <th className={ERP_TABLE_TH_CLASS}>불출</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>상태</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const metrics = metricsByLineId[order.orderLineId] ?? {
                inboundSets: 0,
                outboundSets: 0,
              }
              const target = Math.max(0, Math.floor(order.quantity))
              const inboundSets = Math.max(0, Math.floor(metrics.inboundSets))
              const outboundSets = Math.max(0, Math.floor(metrics.outboundSets))
              const inboundState = getMaterialInboundState(order, inboundSets)
              const inboundComplete = target > 0 && inboundSets >= target
              const inboundPercent = materialInboundProgressPercent(order, inboundSets)
              const outboundPercent = materialOutboundProgressPercent(inboundSets, outboundSets)
              const inboundDetail = `${inboundSets.toLocaleString('ko-KR')} / ${target.toLocaleString('ko-KR')}`
              const outboundDetail =
                inboundSets > 0
                  ? `${outboundSets.toLocaleString('ko-KR')} / ${inboundSets.toLocaleString('ko-KR')}`
                  : `${outboundSets.toLocaleString('ko-KR')} / —`
              const { name, version } = formatProductionProductDisplay(order)
              const openModal = onOrderClick ? () => onOrderClick(order) : undefined

              return (
                <tr key={order.uiKey} className={ERP_TABLE_ROW_CLASS}>
                  <td
                    className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-mono text-sm font-bold text-slate-900`}
                    title={displayOrderPoNumber(order.customerPoNumber, order.orderNumber)}
                  >
                    {displayOrderPoNumber(order.customerPoNumber, order.orderNumber) || '—'}
                  </td>
                  <td
                    className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_WRAP_CLASS} font-semibold text-slate-800`}
                  >
                    {order.customer || '—'}
                  </td>
                  <td
                    className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_WRAP_CLASS} font-medium text-slate-900`}
                  >
                    {name || '—'}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-center`}>
                    {version ? (
                      <span className="text-xs font-semibold text-sky-700">{version}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
                    <DeliveryDueBadge deliveryDate={order.deliveryDate} done={inboundComplete} />
                  </td>
                  <ProgressCell
                    percent={inboundPercent}
                    tone="amber"
                    detail={inboundDetail}
                    label="입고"
                    onClick={openModal}
                  />
                  <ProgressCell
                    percent={outboundPercent}
                    tone="sky"
                    detail={outboundDetail}
                    label="불출"
                    onClick={openModal}
                  />
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
                    <span
                      className={`${ERP_BADGE_COMPACT_CLASS} ${materialStateBadgeClass(inboundState)}`}
                    >
                      {materialInboundFilterLabel(inboundState)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
