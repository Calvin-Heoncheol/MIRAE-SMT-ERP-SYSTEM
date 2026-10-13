'use client'

import { useMemo, useState } from 'react'
import { ErpModal } from '@/components/ui/erp-modal'
import { displayOrderPoNumber, todayYmdSeoul } from '@/lib/orders/utils'
import { formatPlanPcbSideBadge } from '@/lib/products/utils'
import { canPlanPost, canPlanSmt } from '@/lib/production-plan/pipeline'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import {
  computeSmtSideUnplannedQty,
  isProductionPlanScheduleRow,
} from '@/lib/production-plan/utils'
import {
  lineUnplannedQty,
  pickPlanningRowForLine,
  type UnifiedPlanSheetLine,
} from '@/lib/production-plan/unified-plan-lines'
import { formatCalendarDayLabel, formatWeekdayLabel } from '@/lib/smt/plan/utils'
import { ERP_TABLE_HEAD_CLASS } from '@/lib/ui/tokens'

export type ProductionPlanPickerTarget =
  | { scope: 'smt'; plannedDate: string; lineNo: number }
  | { scope: 'post'; plannedDate: string; team: string }

type ProductionPlanOrderPickerModalProps = {
  target: ProductionPlanPickerTarget | null
  pendingLines: UnifiedPlanSheetLine[]
  allRows: ProductionPlanBoardRow[]
  onClose: () => void
  onPick: (row: ProductionPlanBoardRow) => void
}

function formatQty(value: number) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString('ko-KR')
}

function SideQty({
  split,
  single,
  isDouble,
}: {
  split: { top: number; bot: number } | null
  single: number
  isDouble: boolean
}) {
  if (split) {
    return (
      <span className="inline-flex flex-col items-end gap-0.5 text-xs leading-tight">
        <span>
          <span className="mr-1 text-[10px] font-semibold text-sky-600">T</span>
          {formatQty(split.top)}
        </span>
        <span>
          <span className="mr-1 text-[10px] font-semibold text-indigo-600">B</span>
          {formatQty(split.bot)}
        </span>
      </span>
    )
  }
  return (
    <span className="text-xs">
      <span
        className={`mr-1 text-[10px] font-semibold ${isDouble ? 'text-amber-600' : 'text-slate-500'}`}
      >
        {isDouble ? 'D' : 'S'}
      </span>
      {formatQty(single)}
    </span>
  )
}

function matchesSearch(fields: Array<string | null | undefined>, query: string) {
  if (!query) return true
  return fields
    .map((value) => String(value || '').toLowerCase())
    .join(' ')
    .includes(query)
}

export function ProductionPlanOrderPickerModal({
  target,
  pendingLines,
  allRows,
  onClose,
  onPick,
}: ProductionPlanOrderPickerModalProps) {
  const [search, setSearch] = useState('')
  const scope = target?.scope ?? 'smt'

  const items = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pendingLines
      .map((line) => {
        const planRow = pickPlanningRowForLine(line, scope)
        if (!planRow) return null
        const sideUnplanned =
          scope === 'smt' && line.rep.splitPcbSides
            ? computeSmtSideUnplannedQty(allRows, line.targetId, line.rep.orderQty)
            : null
        const unplanned = lineUnplannedQty(line)
        if (sideUnplanned) {
          if (sideUnplanned.top <= 0 && sideUnplanned.bot <= 0) return null
        } else if (unplanned <= 0) {
          return null
        }
        if (
          !matchesSearch(
            [
              line.rep.orderNumber,
              line.rep.customerPoNumber,
              line.rep.customer,
              line.rep.productName,
              line.rep.productCode,
            ],
            q,
          )
        ) {
          return null
        }
        const blocked =
          (scope === 'post' && !canPlanPost(planRow, allRows)) ||
          (scope === 'smt' && !canPlanSmt(planRow))
        let plannedQty = 0
        const sidePlanned = { top: 0, bot: 0 }
        for (const row of allRows) {
          if (row.scope !== scope || row.targetId !== line.targetId) continue
          if (!isProductionPlanScheduleRow(row)) continue
          const qty = Math.max(0, Math.round(Number(row.plannedQuantity) || 0))
          plannedQty += qty
          if (row.pcbSide === 'TOP' || row.pcbSide === 'BOTH') sidePlanned.top += qty
          if (row.pcbSide === 'BOT' || row.pcbSide === 'BOTH') sidePlanned.bot += qty
        }
        return {
          line,
          planRow,
          sideUnplanned,
          sidePlanned: sideUnplanned ? sidePlanned : null,
          unplanned,
          plannedQty,
          blocked,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
      .sort((a, b) => {
        if (a.blocked !== b.blocked) return Number(a.blocked) - Number(b.blocked)
        const aDate = String(a.line.rep.deliveryDate || '').slice(0, 10) || '9999-12-31'
        const bDate = String(b.line.rep.deliveryDate || '').slice(0, 10) || '9999-12-31'
        return aDate.localeCompare(bDate)
      })
  }, [pendingLines, scope, allRows, search])

  if (!target) return null

  const today = todayYmdSeoul()

  const slotLabel = target.scope === 'smt' ? `라인 ${target.lineNo}` : target.team
  const title = `${target.scope === 'smt' ? 'SMT' : '후공정'} 배정 — ${formatCalendarDayLabel(target.plannedDate)} (${formatWeekdayLabel(target.plannedDate)}) · ${slotLabel}`
  const blockedReason =
    scope === 'smt' ? '자재 준비 후 배정 가능' : 'SMD 계획 확정 후 배정 가능'

  return (
    <ErpModal open title={title} onClose={onClose} size="xl">
      <div className="space-y-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="발주번호·고객사·모델명 검색…"
          autoFocus
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />

        <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className={ERP_TABLE_HEAD_CLASS}>
              <tr className="text-xs font-semibold text-slate-500">
                <th className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2">발주번호</th>
                <th className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2">고객사</th>
                <th className="border-b border-slate-200 bg-slate-50 px-3 py-2">모델명</th>
                <th className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-right">목표수량</th>
                <th className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-right">계획수량</th>
                <th className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-right">미계획</th>
                <th className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-center">납기일</th>
              </tr>
            </thead>
            <tbody>
              {!items.length ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-400">
                    {search.trim() ? '검색 결과 없음' : '배정할 발주가 없습니다'}
                  </td>
                </tr>
              ) : (
                items.map(({ line, planRow, sideUnplanned, sidePlanned, unplanned, plannedQty, blocked }) => {
                  const orderLabel =
                    displayOrderPoNumber(line.rep.customerPoNumber, line.rep.orderNumber) ||
                    line.rep.orderNumber
                  const deliveryDate = String(line.rep.deliveryDate || '').slice(0, 10)
                  const isDouble =
                    !sideUnplanned &&
                    formatPlanPcbSideBadge({
                      pcbSideMode: line.rep.pcbSideMode,
                      pcbSide: 'SINGLE',
                      splitPcbSides: line.rep.splitPcbSides,
                    }) === 'DOUBLE'
                  return (
                    <tr
                      key={line.key}
                      onClick={blocked ? undefined : () => onPick(planRow)}
                      title={blocked ? blockedReason : '클릭하여 배정'}
                      className={`border-b border-slate-100 last:border-b-0 ${
                        blocked
                          ? 'cursor-not-allowed bg-slate-50 text-slate-400'
                          : scope === 'smt'
                            ? 'cursor-pointer hover:bg-sky-50'
                            : 'cursor-pointer hover:bg-violet-50'
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold">
                        {orderLabel || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{line.rep.customer || '—'}</td>
                      <td className="px-3 py-2 font-semibold">
                        {line.rep.productName || '—'}
                        {blocked ? (
                          <span className="ml-2 text-[11px] font-semibold text-amber-700">
                            {blockedReason}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {formatQty(planRow.orderQty)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        <SideQty split={sidePlanned} single={plannedQty} isDouble={isDouble} />
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums ${
                          blocked ? '' : 'text-slate-900'
                        }`}
                      >
                        <SideQty split={sideUnplanned} single={unplanned} isDouble={isDouble} />
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-2 text-center tabular-nums ${
                          !blocked && deliveryDate && deliveryDate < today
                            ? 'font-semibold text-rose-600'
                            : ''
                        }`}
                      >
                        {deliveryDate || '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">
          행을 클릭하면 계획 수량·기간을 입력하는 창이 열립니다.
        </p>
      </div>
    </ErpModal>
  )
}
