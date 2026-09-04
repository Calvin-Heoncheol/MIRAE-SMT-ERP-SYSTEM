'use client'

import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { ProductionInputConfig, ProductionOrderLine } from '@/lib/production-input/types'
import {
  formatProductionProductDisplay,
  getProductionOrderState,
  getStackedProgressWidths,
  resolveProductionSideCount,
} from '@/lib/production-input/utils'
import type { SmtPcbSide } from '@/lib/smt/types'
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

type ProductionInputClickSide = 'TOP' | 'BOT'

type ProductionInputTableProps = {
  orders: ProductionOrderLine[]
  counts: Record<string, number>
  defectCounts: Record<string, number>
  config: Pick<ProductionInputConfig, 'productionModule'>
  emptyMessage?: string
  onOrderClick?: (order: ProductionOrderLine, side?: ProductionInputClickSide) => void
}

function sideProgressDetail(
  produced: number,
  defected: number,
  target: number,
) {
  const base = `${produced.toLocaleString('ko-KR')} / ${target.toLocaleString('ko-KR')}`
  if (defected > 0) return `${base} · 불량 ${defected.toLocaleString('ko-KR')}`
  return base
}

function stateBadgeClass(state: ReturnType<typeof getProductionOrderState>) {
  if (state === 'full') return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
  if (state === 'progress') return 'bg-amber-50 text-amber-800 ring-amber-200'
  return 'bg-slate-100 text-slate-600 ring-slate-200'
}

function stateBadgeLabel(state: ReturnType<typeof getProductionOrderState>) {
  if (state === 'full') return '완료'
  if (state === 'progress') return '진행'
  return '대기'
}

function SideProgressCell({
  order,
  counts,
  defectCounts,
  pcbSide,
  tone,
  sideLabel,
  onClick,
}: {
  order: ProductionOrderLine
  counts: Record<string, number>
  defectCounts: Record<string, number>
  pcbSide: SmtPcbSide
  tone: 'sky' | 'emerald'
  sideLabel: string
  onClick?: () => void
}) {
  const target = Math.max(0, Math.floor(order.quantity))
  const produced = resolveProductionSideCount(order, counts, pcbSide)
  const defected = resolveProductionSideCount(order, defectCounts, pcbSide)
  const stacked = getStackedProgressWidths(produced, defected, target)
  const barClass = tone === 'sky' ? 'bg-sky-500' : 'bg-emerald-500'
  const detail = sideProgressDetail(produced, defected, target)

  const content = (
    <div className="min-w-[108px]">
      <p className="mb-1.5 text-xs font-semibold tabular-nums text-slate-700">{detail}</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        {stacked.goodPercent > 0 ? (
          <div className={`h-full shrink-0 ${barClass}`} style={{ width: `${stacked.goodPercent}%` }} />
        ) : null}
        {stacked.defectPercent > 0 ? (
          <div
            className="h-full shrink-0 bg-rose-500"
            style={{ width: `${stacked.defectPercent}%` }}
          />
        ) : null}
      </div>
    </div>
  )

  if (!onClick) {
    return <td className={`${ERP_TABLE_TD_CLASS} align-top`}>{content}</td>
  }

  return (
    <td className={`${ERP_TABLE_TD_CLASS} align-top`}>
      <button
        type="button"
        onClick={onClick}
        title={`${sideLabel} 클릭하여 생산 등록`}
        className="w-full rounded-lg px-1 py-0.5 text-left transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        {content}
      </button>
    </td>
  )
}

function EmptySideCell() {
  return (
    <td className={`${ERP_TABLE_TD_CLASS} align-top`}>
      <div className="min-w-[108px]">
        <p className="mb-1.5 text-xs font-semibold tabular-nums text-slate-300">—</p>
        <div className="h-2 rounded-full bg-slate-50" />
      </div>
    </td>
  )
}

export function ProductionInputTable({
  orders,
  counts,
  defectCounts,
  config,
  emptyMessage,
  onOrderClick,
}: ProductionInputTableProps) {
  const isSmt = config.productionModule === 'smt'
  const progressTone = config.productionModule === 'post_process' ? 'emerald' : 'sky'

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
        <table className={`${ERP_TABLE_CLASS} ${isSmt ? 'min-w-[1080px]' : 'min-w-[880px]'}`}>
          <thead className={ERP_TABLE_HEAD_CLASS}>
            {isSmt ? (
              <>
                <tr>
                  <th
                    rowSpan={2}
                    className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} align-middle`}
                  >
                    발주서
                  </th>
                  <th rowSpan={2} className={`${ERP_TABLE_TH_CLASS} align-middle`}>
                    고객사
                  </th>
                  <th rowSpan={2} className={`${ERP_TABLE_TH_CLASS} align-middle`}>
                    제품
                  </th>
                  <th
                    rowSpan={2}
                    className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} align-middle`}
                  >
                    버전
                  </th>
                  <th
                    rowSpan={2}
                    className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} align-middle`}
                  >
                    납기
                  </th>
                  <th
                    colSpan={3}
                    className={`${ERP_TABLE_TH_CLASS} !border-0 !p-0 !leading-[0]`}
                    aria-hidden
                  />
                  <th
                    rowSpan={2}
                    className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} align-middle`}
                  >
                    상태
                  </th>
                </tr>
                <tr>
                  <th className={`${ERP_TABLE_TH_CLASS} text-center text-xs font-semibold text-slate-600`}>
                    SINGLE
                  </th>
                  <th className={`${ERP_TABLE_TH_CLASS} text-center text-xs font-semibold text-slate-600`}>
                    TOP
                  </th>
                  <th className={`${ERP_TABLE_TH_CLASS} text-center text-xs font-semibold text-slate-600`}>
                    BOT
                  </th>
                </tr>
              </>
            ) : (
              <tr>
                <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>발주서</th>
                <th className={ERP_TABLE_TH_CLASS}>고객사</th>
                <th className={ERP_TABLE_TH_CLASS}>제품</th>
                <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>버전</th>
                <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>납기</th>
                <th className={ERP_TABLE_TH_CLASS}>후공정</th>
                <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>상태</th>
              </tr>
            )}
          </thead>
          <tbody>
            {orders.map((order) => {
              const state = getProductionOrderState(order, counts)
              const complete = state === 'full'
              const { name, version } = formatProductionProductDisplay(order)

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
                    <DeliveryDueBadge deliveryDate={order.deliveryDate} done={complete} />
                  </td>
                  {isSmt ? (
                    order.splitPcbSides ? (
                      <>
                        <EmptySideCell />
                        <SideProgressCell
                          order={order}
                          counts={counts}
                          defectCounts={defectCounts}
                          pcbSide="TOP"
                          tone={progressTone}
                          sideLabel="TOP"
                          onClick={
                            onOrderClick ? () => onOrderClick(order, 'TOP') : undefined
                          }
                        />
                        <SideProgressCell
                          order={order}
                          counts={counts}
                          defectCounts={defectCounts}
                          pcbSide="BOT"
                          tone={progressTone}
                          sideLabel="BOT"
                          onClick={
                            onOrderClick ? () => onOrderClick(order, 'BOT') : undefined
                          }
                        />
                      </>
                    ) : (
                      <>
                        <SideProgressCell
                          order={order}
                          counts={counts}
                          defectCounts={defectCounts}
                          pcbSide="SINGLE"
                          tone={progressTone}
                          sideLabel="SINGLE"
                          onClick={onOrderClick ? () => onOrderClick(order) : undefined}
                        />
                        <EmptySideCell />
                        <EmptySideCell />
                      </>
                    )
                  ) : (
                    <SideProgressCell
                      order={order}
                      counts={counts}
                      defectCounts={defectCounts}
                      pcbSide="SINGLE"
                      tone={progressTone}
                      sideLabel="후공정"
                      onClick={onOrderClick ? () => onOrderClick(order) : undefined}
                    />
                  )}
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
                    <span className={`${ERP_BADGE_COMPACT_CLASS} ${stateBadgeClass(state)}`}>
                      {stateBadgeLabel(state)}
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
