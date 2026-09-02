'use client'

import { useMemo } from 'react'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import {
  deliveryUrgencyClass,
  formatDeliveryCountdown,
  isProductionPlanRemainderRow,
  isProductionPlanScheduleRow,
} from '@/lib/production-plan/utils'
import {
  PRODUCTION_PLAN_SCOPE_LABELS,
  type ProductionPlanBoardRow,
  type ProductionPlanScope,
} from '@/lib/production-plan/types'

type ProductionPlanOrderTimelineProps = {
  rows: ProductionPlanBoardRow[]
  search: string
  onSearchChange: (value: string) => void
  onSelectRow?: (row: ProductionPlanBoardRow) => void
}

type OrderTimelineGroup = {
  orderId: string
  orderNumber: string
  customer: string
  productName: string
  deliveryDate: string
  daysUntilDelivery: number | null
  orderQty: number
  remainingQty: number
  material: ProductionPlanBoardRow[]
  smt: ProductionPlanBoardRow[]
  post: ProductionPlanBoardRow[]
}

const SCOPE_STYLES: Record<
  ProductionPlanScope,
  { header: string; chip: string; border: string }
> = {
  material: {
    header: 'bg-amber-50 text-amber-900',
    chip: 'border-amber-200 bg-amber-50 text-amber-900',
    border: 'border-amber-200',
  },
  smt: {
    header: 'bg-sky-50 text-sky-900',
    chip: 'border-sky-200 bg-sky-50 text-sky-900',
    border: 'border-sky-200',
  },
  post: {
    header: 'bg-violet-50 text-violet-900',
    chip: 'border-violet-200 bg-violet-50 text-violet-900',
    border: 'border-violet-200',
  },
}

function scheduleLabel(row: ProductionPlanBoardRow) {
  if (isProductionPlanRemainderRow(row)) {
    return `추가 배정 · 미계획 ${(row.unplannedQty ?? row.remainingQty).toLocaleString('ko-KR')}`
  }
  const date = row.plannedDate.slice(0, 10) || '-'
  const qty = row.plannedQuantity?.toLocaleString('ko-KR') ?? '-'
  if (row.scope === 'smt' && row.lineNo) return `${date} · ${qty} · L${row.lineNo}`
  if (row.scope === 'post' && row.team) return `${date} · ${qty} · ${row.team}`
  return `${date} · ${qty}`
}

function buildOrderGroups(rows: ProductionPlanBoardRow[]): OrderTimelineGroup[] {
  const byOrder = new Map<string, OrderTimelineGroup>()

  for (const row of rows) {
    if (isProductionPlanRemainderRow(row) && row.status === 'waiting' && !row.plannedDate) {
      // 미계획 잔량만 있는 그룹도 표시
    }

    const existing = byOrder.get(row.orderId)
    if (!existing) {
      byOrder.set(row.orderId, {
        orderId: row.orderId,
        orderNumber: row.orderNumber,
        customer: row.customer,
        productName: row.productName,
        deliveryDate: row.deliveryDate,
        daysUntilDelivery: row.daysUntilDelivery,
        orderQty: row.orderQty,
        remainingQty: row.remainingQty,
        material: row.scope === 'material' ? [row] : [],
        smt: row.scope === 'smt' ? [row] : [],
        post: row.scope === 'post' ? [row] : [],
      })
      continue
    }

    if (row.scope === 'material') existing.material.push(row)
    if (row.scope === 'smt') existing.smt.push(row)
    if (row.scope === 'post') existing.post.push(row)
  }

  return Array.from(byOrder.values())
    .filter((group) => group.material.length || group.smt.length || group.post.length)
    .sort((a, b) => {
      const aDue = a.daysUntilDelivery ?? 9999
      const bDue = b.daysUntilDelivery ?? 9999
      if (aDue !== bDue) return aDue - bDue
      return a.orderNumber.localeCompare(b.orderNumber)
    })
}

function ScopeColumn({
  scope,
  rows,
  onSelectRow,
}: {
  scope: ProductionPlanScope
  rows: ProductionPlanBoardRow[]
  onSelectRow?: (row: ProductionPlanBoardRow) => void
}) {
  const styles = SCOPE_STYLES[scope]
  const sorted = [...rows].sort((a, b) => {
    if (isProductionPlanRemainderRow(a) && !isProductionPlanRemainderRow(b)) return 1
    if (!isProductionPlanRemainderRow(a) && isProductionPlanRemainderRow(b)) return -1
    return a.plannedDate.localeCompare(b.plannedDate)
  })

  return (
    <div className={`rounded-xl border ${styles.border} bg-white`}>
      <div className={`rounded-t-xl px-3 py-2 text-xs font-bold ${styles.header}`}>
        {PRODUCTION_PLAN_SCOPE_LABELS[scope]}
      </div>
      <div className="space-y-1.5 p-2">
        {!sorted.length ? (
          <p className="px-1 py-3 text-center text-[11px] text-slate-400">배정 없음</p>
        ) : (
          sorted.map((row) => {
            const remainder = isProductionPlanRemainderRow(row)
            const confirmed = isProductionPlanScheduleRow(row)
            const clickable = confirmed && onSelectRow

            return (
              <button
                key={row.key}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onSelectRow(row)}
                className={`w-full rounded-lg border px-2 py-1.5 text-left text-[11px] leading-snug ${
                  remainder
                    ? 'border-dashed border-sky-300 bg-sky-50/80 text-sky-900'
                    : `${styles.chip} ${clickable ? 'cursor-pointer hover:brightness-95' : ''}`
                }`}
              >
                <div className="flex items-center gap-1">
                  {remainder ? (
                    <span className="rounded bg-sky-600 px-1 py-0.5 text-[9px] font-bold text-white">
                      추가 배정
                    </span>
                  ) : (
                    <span className="rounded bg-slate-700 px-1 py-0.5 text-[9px] font-bold text-white">
                      확정
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-semibold tabular-nums">{scheduleLabel(row)}</p>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export function ProductionPlanOrderTimeline({
  rows,
  search,
  onSearchChange,
  onSelectRow,
}: ProductionPlanOrderTimelineProps) {
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? rows.filter((row) => {
          const haystack = [row.orderNumber, row.customer, row.productName, row.deliveryDate]
            .join(' ')
            .toLowerCase()
          return haystack.includes(q)
        })
      : rows
    return buildOrderGroups(filtered)
  }, [rows, search])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2.5">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="발주번호, 고객사, 제품명 검색…"
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
        <p className="text-xs text-slate-500">
          발주별로 자재 → SMT → 후공정 계획을 한눈에 확인합니다. 확정 항목을 클릭하면 수정·삭제할 수
          있습니다.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!groups.length ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            {search.trim() ? '검색 결과 없음' : '표시할 발주가 없습니다'}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const countdown = formatDeliveryCountdown(group.daysUntilDelivery)
              return (
                <article
                  key={group.orderId}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm"
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-slate-500">
                        {formatInternalCodeLabel(group.orderNumber)}
                      </p>
                      <h3 className="mt-0.5 text-sm font-bold text-slate-900">{group.productName}</h3>
                      <p className="text-xs text-slate-600">{group.customer}</p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <p>
                        수량 {group.orderQty.toLocaleString('ko-KR')} · 잔량{' '}
                        {group.remainingQty.toLocaleString('ko-KR')}
                      </p>
                      <p className="mt-0.5">
                        납기 {group.deliveryDate || '-'}
                        {countdown ? (
                          <span
                            className={`ml-1 font-semibold tabular-nums ${deliveryUrgencyClass(group.daysUntilDelivery)}`}
                          >
                            {countdown}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <ScopeColumn scope="material" rows={group.material} onSelectRow={onSelectRow} />
                    <ScopeColumn scope="smt" rows={group.smt} onSelectRow={onSelectRow} />
                    <ScopeColumn scope="post" rows={group.post} onSelectRow={onSelectRow} />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
