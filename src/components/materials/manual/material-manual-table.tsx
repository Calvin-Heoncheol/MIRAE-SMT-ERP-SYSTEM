'use client'

import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { displayOrderPoNumber, todayYmdSeoul } from '@/lib/orders/utils'
import type {
  MaterialManualHistoryKind,
  MaterialManualOrderMetrics,
} from '@/lib/materials/manual/types'
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
  onOrderClick?: (order: ProductionOrderLine, kind: MaterialManualHistoryKind) => void
  expectedInboundByLineId?: Record<string, string>
  /** 저장 중인 order_line_id */
  savingExpectedLineIds?: Set<string>
  onExpectedInboundChange?: (order: ProductionOrderLine, expectedDate: string) => void
}

function ExpectedInboundCell({
  order,
  value,
  inboundComplete,
  saving,
  onChange,
}: {
  order: ProductionOrderLine
  value: string
  inboundComplete: boolean
  saving: boolean
  onChange?: (order: ProductionOrderLine, expectedDate: string) => void
}) {
  const deliveryYmd = String(order.deliveryDate || '').slice(0, 10)
  const lateForDelivery = Boolean(value && deliveryYmd && value > deliveryYmd)
  const overdue = Boolean(value && !inboundComplete && value < todayYmdSeoul())

  if (inboundComplete && !value) {
    return (
      <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-center`}>
        <span className="text-xs text-slate-300">—</span>
      </td>
    )
  }

  const toneClass = lateForDelivery
    ? 'border-rose-300 bg-rose-50 text-rose-800'
    : overdue
      ? 'border-amber-300 bg-amber-50 text-amber-800'
      : value
        ? 'border-slate-200 bg-white text-slate-800'
        : 'border-dashed border-slate-300 bg-white text-slate-400'
  const title = lateForDelivery
    ? `예상입고일이 납기(${deliveryYmd})보다 늦습니다`
    : overdue
      ? '예상입고일이 지났는데 입고가 완료되지 않았습니다'
      : '자재 예상입고일 — 선택하면 바로 저장됩니다'

  return (
    <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
      <input
        type="date"
        value={value}
        disabled={!onChange || saving}
        onChange={(event) => onChange?.(order, event.target.value)}
        title={title}
        aria-label="예상입고일"
        className={`w-[8.5rem] rounded-md border px-1.5 py-1 text-xs tabular-nums outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-60 ${toneClass}`}
      />
    </td>
  )
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

  const hoverClass =
    tone === 'amber'
      ? 'hover:bg-amber-50 focus-visible:ring-amber-300'
      : 'hover:bg-sky-50 focus-visible:ring-sky-300'

  return (
    <td className={`${ERP_TABLE_TD_CLASS} align-top`}>
      <button
        type="button"
        onClick={onClick}
        title={`${label} 클릭하여 등록`}
        className={`w-full rounded-lg px-1 py-0.5 text-left transition focus:outline-none focus-visible:ring-2 ${hoverClass}`}
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
  expectedInboundByLineId = {},
  savingExpectedLineIds,
  onExpectedInboundChange,
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
        <table className={`${ERP_TABLE_CLASS} min-w-[1080px]`}>
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>발주서</th>
              <th className={ERP_TABLE_TH_CLASS}>고객사</th>
              <th className={ERP_TABLE_TH_CLASS}>제품</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>버전</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>납기</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>예상입고일</th>
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
              const shippedSets = Math.max(0, Math.floor(metrics.shippedSets ?? 0))
              const inboundState = getMaterialInboundState(order, inboundSets)
              const inboundComplete = target > 0 && inboundSets >= target
              const inboundPercent = materialInboundProgressPercent(order, inboundSets)
              const inboundDetail = `${inboundSets.toLocaleString('ko-KR')} / ${target.toLocaleString('ko-KR')}`
              const outboundSets = Math.max(0, Math.floor(metrics.outboundSets))
              const outboundPercent = materialOutboundProgressPercent(inboundSets, outboundSets)
              const outboundDetail = `${outboundSets.toLocaleString('ko-KR')} / ${inboundSets.toLocaleString('ko-KR')}`
              const { name, version } = formatProductionProductDisplay(order)
              const openInbound = onOrderClick ? () => onOrderClick(order, 'inbound') : undefined
              const openOutbound = onOrderClick ? () => onOrderClick(order, 'outbound') : undefined

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
                  <ExpectedInboundCell
                    order={order}
                    value={expectedInboundByLineId[order.orderLineId] ?? ''}
                    inboundComplete={inboundComplete}
                    saving={savingExpectedLineIds?.has(order.orderLineId) ?? false}
                    onChange={onExpectedInboundChange}
                  />
                  <ProgressCell
                    percent={inboundPercent}
                    tone="amber"
                    detail={inboundDetail}
                    label="입고"
                    onClick={openInbound}
                  />
                  <ProgressCell
                    percent={outboundPercent}
                    tone="sky"
                    detail={outboundDetail}
                    label="불출"
                    onClick={openOutbound}
                  />
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
                    <span
                      className={`${ERP_BADGE_COMPACT_CLASS} ${materialStateBadgeClass(inboundState)}`}
                    >
                      {materialInboundFilterLabel(inboundState)}
                    </span>
                    {shippedSets > 0 ? (
                      <p
                        className="mt-1 text-[11px] font-medium text-slate-500"
                        title="출하 수량만큼 입고 완료로 간주합니다"
                      >
                        출하 {shippedSets.toLocaleString('ko-KR')} 반영
                      </p>
                    ) : null}
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
