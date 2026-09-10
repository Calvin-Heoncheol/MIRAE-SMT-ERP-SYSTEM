'use client'

import type { DragEvent } from 'react'
import { useMemo, useState } from 'react'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import {
  SHARED_PRODUCTION_PLAN_DRAG_MIME,
  type ProductionPlanDragPayload,
} from '@/lib/production-plan/config'
import { canPlanPost, canPlanSmt } from '@/lib/production-plan/pipeline'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import { computeSmtSideUnplannedQty } from '@/lib/production-plan/utils'
import {
  lineUnplannedQty,
  pickPlanningRowForLine,
  type UnifiedPlanSheetLine,
} from '@/lib/production-plan/unified-plan-lines'

type ScopeTab = 'smt' | 'post'

type SideUnplanned = { top: number; bot: number }

type ProductionPlanPendingSidebarProps = {
  pendingLines: UnifiedPlanSheetLine[]
  allRows: ProductionPlanBoardRow[]
  scope: ScopeTab
  search: string
  onSearchChange: (value: string) => void
}

function setDragPayload(event: DragEvent, payload: ProductionPlanDragPayload) {
  const raw = JSON.stringify(payload)
  event.dataTransfer.setData(SHARED_PRODUCTION_PLAN_DRAG_MIME, raw)
  event.dataTransfer.setData('text/plain', raw)
  event.dataTransfer.effectAllowed = 'copy'
}

function formatQty(value: number) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString('ko-KR')
}

function PendingCardBody({
  customer,
  orderLabel,
  productName,
  splitPcbSides = false,
  deliveryDate,
  remainingQty,
  sideUnplanned = null,
  muted = false,
}: {
  customer: string
  orderLabel: string
  productName: string
  splitPcbSides?: boolean
  deliveryDate: string
  remainingQty: number
  sideUnplanned?: SideUnplanned | null
  muted?: boolean
}) {
  const labelClass = muted ? 'text-slate-400' : 'text-slate-500'
  const valueClass = muted ? 'text-slate-600' : 'text-slate-900'
  const showSideRemaining = Boolean(splitPcbSides && sideUnplanned)

  return (
    <>
      <p className={`truncate text-xs font-semibold ${labelClass}`}>{customer || '—'}</p>
      <p className={`mt-0.5 truncate font-mono text-xs font-bold ${valueClass}`}>{orderLabel || '—'}</p>
      <p className={`mt-1 truncate text-sm font-bold ${valueClass}`}>{productName || '—'}</p>
      {showSideRemaining && sideUnplanned ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span
            className={`rounded-md px-2 py-1 text-xs font-bold tabular-nums ${
              muted ? 'bg-slate-200 text-slate-600' : 'bg-sky-100 text-sky-800'
            }`}
          >
            TOP {formatQty(sideUnplanned.top)}
          </span>
          <span
            className={`rounded-md px-2 py-1 text-xs font-bold tabular-nums ${
              muted ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-800'
            }`}
          >
            BOT {formatQty(sideUnplanned.bot)}
          </span>
        </div>
      ) : splitPcbSides ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span
            className={`rounded-md px-2 py-1 text-xs font-bold ${
              muted ? 'bg-slate-200 text-slate-600' : 'bg-sky-100 text-sky-800'
            }`}
          >
            TOP
          </span>
          <span
            className={`rounded-md px-2 py-1 text-xs font-bold ${
              muted ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-800'
            }`}
          >
            BOT
          </span>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span
            className={`rounded-md px-2 py-1 text-xs font-bold tabular-nums ${
              muted ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-700'
            }`}
          >
            SINGLE {formatQty(remainingQty)}
          </span>
        </div>
      )}
      <p className={`mt-1.5 text-right text-[11px] ${labelClass}`}>
        <span className="font-medium">납기일</span>{' '}
        <span className={`font-semibold tabular-nums ${valueClass}`}>{deliveryDate || '—'}</span>
      </p>
    </>
  )
}

export function ProductionPlanPendingSidebar({
  pendingLines,
  allRows,
  scope,
  search,
  onSearchChange,
}: ProductionPlanPendingSidebarProps) {
  const [draggingKey, setDraggingKey] = useState<string | null>(null)

  const items = useMemo(() => {
    return pendingLines
      .map((line) => {
        const planRow = pickPlanningRowForLine(line, scope)
        if (!planRow) return null
        const unplanned = lineUnplannedQty(line)
        const sideUnplanned =
          scope === 'smt' && line.rep.splitPcbSides
            ? computeSmtSideUnplannedQty(allRows, line.targetId, line.rep.orderQty)
            : null
        if (sideUnplanned) {
          if (sideUnplanned.top <= 0 && sideUnplanned.bot <= 0) return null
        } else if (unplanned <= 0) {
          return null
        }
        const blocked =
          (scope === 'post' && !canPlanPost(planRow, allRows)) ||
          (scope === 'smt' && !canPlanSmt(planRow))
        return {
          line,
          planRow,
          blocked,
          unplanned,
          sideUnplanned,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
  }, [pendingLines, scope, allRows])

  const ready = items.filter((item) => !item.blocked)
  const blocked = items.filter((item) => item.blocked)

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-slate-50 lg:w-[20rem] lg:border-b-0 lg:border-r xl:w-[22rem]">
      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="발주·PO·고객·제품 검색…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {!items.length ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {search.trim() ? '검색 결과 없음' : '배정할 발주가 없습니다'}
          </p>
        ) : (
          <div className="space-y-2 p-2.5">
            {ready.map(({ line, planRow, unplanned, sideUnplanned }) => {
              const isDragging = draggingKey === planRow.key
              const orderLabel =
                displayOrderPoNumber(line.rep.customerPoNumber, line.rep.orderNumber) ||
                line.rep.orderNumber
              return (
                <article
                  key={line.key}
                  draggable
                  onDragStart={(event) => {
                    setDragPayload(event, {
                      kind: 'order',
                      key: planRow.key,
                      scope: planRow.scope,
                    })
                    setDraggingKey(planRow.key)
                  }}
                  onDragEnd={() => setDraggingKey(null)}
                  className={`cursor-grab rounded-xl border border-l-4 bg-white p-2.5 shadow-sm transition active:cursor-grabbing ${
                    scope === 'post'
                      ? 'border-violet-200 border-l-violet-500'
                      : 'border-sky-200 border-l-sky-500'
                  } ${isDragging ? 'opacity-50' : 'hover:shadow'}`}
                >
                  <PendingCardBody
                    customer={line.rep.customer}
                    orderLabel={orderLabel}
                    productName={line.rep.productName}
                    splitPcbSides={line.rep.splitPcbSides}
                    deliveryDate={line.rep.deliveryDate}
                    remainingQty={unplanned}
                    sideUnplanned={sideUnplanned}
                  />
                </article>
              )
            })}
            {blocked.map(({ line, unplanned, sideUnplanned }) => {
              const orderLabel =
                displayOrderPoNumber(line.rep.customerPoNumber, line.rep.orderNumber) ||
                line.rep.orderNumber
              return (
                <article
                  key={line.key}
                  className="rounded-xl border border-l-4 border-slate-200 border-l-slate-300 bg-slate-50 p-2.5 opacity-80"
                >
                  <PendingCardBody
                    customer={line.rep.customer}
                    orderLabel={orderLabel}
                    productName={line.rep.productName}
                    splitPcbSides={line.rep.splitPcbSides}
                    deliveryDate={line.rep.deliveryDate}
                    remainingQty={unplanned}
                    sideUnplanned={sideUnplanned}
                    muted
                  />
                  <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
                    {scope === 'smt'
                      ? '자재 준비 후 SMT 배정 가능'
                      : 'SMD 생산계획 확정 후 배정 가능'}
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
