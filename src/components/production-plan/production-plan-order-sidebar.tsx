'use client'

import type { ReactNode } from 'react'
import { SHARED_PRODUCTION_PLAN_DRAG_MIME } from '@/lib/production-plan/config'
import {
  filterPipelineRows,
  materialStatusLabel,
  type ProductionPlanPipelineBuckets,
} from '@/lib/production-plan/pipeline'
import {
  deliveryUrgencyClass,
  formatDeliveryCountdown,
} from '@/lib/production-plan/utils'
import {
  PRODUCTION_PLAN_SCOPE_LABELS,
  type ProductionPlanBoardRow,
} from '@/lib/production-plan/types'
import { formatInternalCodeLabel } from '@/lib/orders/utils'

type ProductionPlanOrderSidebarProps = {
  buckets: ProductionPlanPipelineBuckets
  search: string
  onSearchChange: (value: string) => void
}

function OrderCard({
  row,
  draggable,
  muted = false,
  hint,
}: {
  row: ProductionPlanBoardRow
  draggable: boolean
  muted?: boolean
  hint?: string
}) {
  const countdown = formatDeliveryCountdown(row.daysUntilDelivery)

  return (
    <article
      draggable={draggable}
      onDragStart={
        draggable
          ? (event) => {
              event.dataTransfer.setData(
                SHARED_PRODUCTION_PLAN_DRAG_MIME,
                JSON.stringify({
                  kind: 'order',
                  key: row.key,
                  scope: row.scope,
                }),
              )
              event.dataTransfer.effectAllowed = 'move'
            }
          : undefined
      }
      className={`rounded-xl border bg-white p-3 shadow-sm transition ${
        draggable
          ? muted
            ? 'cursor-grab border-amber-200 border-l-4 border-l-amber-400 hover:border-amber-300 hover:shadow active:cursor-grabbing'
            : row.scope === 'smt'
              ? 'cursor-grab border-sky-200 border-l-4 border-l-sky-500 hover:border-sky-300 hover:shadow active:cursor-grabbing'
              : 'cursor-grab border-violet-200 border-l-4 border-l-violet-500 hover:border-violet-300 hover:shadow active:cursor-grabbing'
          : 'border-amber-200 border-l-4 border-l-amber-400 opacity-90'
      }`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
            row.scope === 'smt' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'
          }`}
        >
          {PRODUCTION_PLAN_SCOPE_LABELS[row.scope]}
        </span>
        {row.materialInboundStatus && materialStatusLabel(row.materialInboundStatus) ? (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
            {materialStatusLabel(row.materialInboundStatus)}
          </span>
        ) : null}
        {countdown ? (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${deliveryUrgencyClass(row.daysUntilDelivery)}`}
          >
            {countdown}
          </span>
        ) : null}
      </div>
      <p className="font-mono text-[11px] font-semibold text-slate-500">
        {formatInternalCodeLabel(row.orderNumber)}
      </p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">{row.productName || '-'}</p>
      <p className="mt-0.5 text-xs text-slate-600">{row.customer || '-'}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span>
          잔량{' '}
          <strong className="tabular-nums text-slate-800">
            {row.remainingQty.toLocaleString('ko-KR')}
          </strong>
        </span>
        {row.deliveryDate ? <span>납기 {row.deliveryDate}</span> : null}
      </div>
      {hint ? <p className="mt-1.5 text-[10px] font-semibold text-amber-700">{hint}</p> : null}
      {!hint && row.materialInboundStatus === 'scheduled' && (row.materialScheduledQty ?? 0) > 0 ? (
        <p className="mt-1.5 text-[10px] font-semibold text-emerald-700">
          입고예정 {row.materialScheduledQty?.toLocaleString('ko-KR')}대분
        </p>
      ) : null}
      {!hint && row.materialReadyQty > 0 ? (
        <p className="mt-1.5 text-[10px] font-semibold text-emerald-700">
          입고완료 {row.materialReadyQty.toLocaleString('ko-KR')}대분
        </p>
      ) : null}
    </article>
  )
}

function Section({
  title,
  count,
  description,
  children,
}: {
  title: string
  count: number
  description?: string
  children: ReactNode
}) {
  return (
    <section className="border-b border-slate-200 last:border-b-0">
      <div className="sticky top-0 z-[1] border-b border-slate-100 bg-slate-50/95 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-xs font-bold text-slate-800">{title}</h5>
          <span className="text-[10px] font-semibold text-slate-400 tabular-nums">{count}건</span>
        </div>
        {description ? <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{description}</p> : null}
      </div>
      <div className="space-y-2 px-2.5 py-2.5">{children}</div>
    </section>
  )
}

export function ProductionPlanOrderSidebar({
  buckets,
  search,
  onSearchChange,
}: ProductionPlanOrderSidebarProps) {
  const materialRows = filterPipelineRows(buckets.materialWaiting, search)
  const smtRows = filterPipelineRows(buckets.smtWaiting, search)
  const postReadyRows = filterPipelineRows(buckets.postWaitingReady, search)
  const postBlockedRows = filterPipelineRows(buckets.postWaitingBlocked, search)
  const total =
    materialRows.length + smtRows.length + postReadyRows.length + postBlockedRows.length

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-slate-50 lg:w-96 lg:border-b-0 lg:border-r">
      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2.5">
        <h4 className="text-sm font-bold text-slate-900">생산계획 대기함</h4>
        <p className="mt-0.5 text-[10px] text-slate-500">자재 → SMD → 후공정 순서로 배정합니다</p>
      </div>

      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="발주번호, 고객사, 제품명 검색…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {!total ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {search.trim() ? '검색 결과 없음' : '대기 중인 발주서가 없습니다'}
          </p>
        ) : (
          <>
            <Section
              title="① 자재 대기"
              count={materialRows.length}
              description="자재 입고 전에도 캘린더에 SMD 일정 미리 배정 가능"
            >
              {materialRows.length ? (
                materialRows.map((row) => (
                  <OrderCard
                    key={row.key}
                    row={row}
                    draggable
                    muted
                    hint={
                      row.materialInboundStatus === 'missing'
                        ? '구매발주·입고 필요 · 미리 배정 가능'
                        : row.materialInboundStatus === 'scheduled'
                          ? '입고예정 · 미리 배정 가능'
                          : '자재 입고 대기 · 미리 배정 가능'
                    }
                  />
                ))
              ) : (
                <p className="py-2 text-center text-[11px] text-slate-400">해당 없음</p>
              )}
            </Section>

            <Section
              title="② SMD 계획 대기"
              count={smtRows.length}
              description="캘린더로 끌어다 SMD 일정 배정"
            >
              {smtRows.length ? (
                smtRows.map((row) => <OrderCard key={row.key} row={row} draggable />)
              ) : (
                <p className="py-2 text-center text-[11px] text-slate-400">해당 없음</p>
              )}
            </Section>

            <Section
              title="③ 후공정 계획 대기"
              count={postReadyRows.length + postBlockedRows.length}
              description="SMD 계획 확정 후 후공정 배정"
            >
              {postReadyRows.map((row) => (
                <OrderCard
                  key={row.key}
                  row={row}
                  draggable
                  hint={
                    row.smtPlannedEndDate ? `SMD 종료 ${row.smtPlannedEndDate} 이후` : undefined
                  }
                />
              ))}
              {postBlockedRows.map((row) => (
                <OrderCard
                  key={row.key}
                  row={row}
                  draggable={false}
                  muted
                  hint="SMD 생산계획 확정 후 배정 가능"
                />
              ))}
              {!postReadyRows.length && !postBlockedRows.length ? (
                <p className="py-2 text-center text-[11px] text-slate-400">해당 없음</p>
              ) : null}
            </Section>
          </>
        )}
      </div>
    </aside>
  )
}
