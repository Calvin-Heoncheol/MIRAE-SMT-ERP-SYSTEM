'use client'

import { useMemo, useState } from 'react'
import { ErpModal } from '@/components/ui/erp-modal'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import { formatCalendarDayLabel, formatWeekdayLabel } from '@/lib/smt/plan/utils'
import { ERP_TABLE_HEAD_CLASS } from '@/lib/ui/tokens'

export type ProductionPlanPickerTarget = { plannedDate: string }

type ProductionPlanOrderPickerModalProps = {
  target: ProductionPlanPickerTarget | null
  /** 발주 품목 한 줄씩 (SMT 대상 대표 행) */
  orderLines: ProductionPlanBoardRow[]
  onClose: () => void
  onPick: (row: ProductionPlanBoardRow) => void
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
  orderLines,
  onClose,
  onPick,
}: ProductionPlanOrderPickerModalProps) {
  const [search, setSearch] = useState('')

  const items = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orderLines
      .filter((row) =>
        matchesSearch(
          [row.orderNumber, row.customerPoNumber, row.customer, row.productName, row.productCode],
          q,
        ),
      )
      .sort((a, b) => {
        const aDate = String(a.deliveryDate || '').slice(0, 10) || '9999-12-31'
        const bDate = String(b.deliveryDate || '').slice(0, 10) || '9999-12-31'
        return aDate.localeCompare(bDate)
      })
  }, [orderLines, search])

  if (!target) return null

  const title = `생산계획 배정 — ${formatCalendarDayLabel(target.plannedDate)} (${formatWeekdayLabel(target.plannedDate)})`

  return (
    <ErpModal open title={title} onClose={onClose} size="lg">
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
              </tr>
            </thead>
            <tbody>
              {!items.length ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-sm text-slate-400">
                    {search.trim() ? '검색 결과 없음' : '배정할 발주가 없습니다'}
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr
                    key={row.targetId}
                    onClick={() => onPick(row)}
                    title="클릭하여 자재·SMD·후공정 일정 배정"
                    className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-sky-50"
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold">
                      {displayOrderPoNumber(row.customerPoNumber, row.orderNumber) || row.orderNumber || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{row.customer || '—'}</td>
                    <td className="px-3 py-2 font-semibold">{row.productName || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums">
                      {Math.max(0, Math.round(row.orderQty || 0)).toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">
          행을 클릭하면 자재·SMD·후공정 일정을 입력하는 창이 열립니다.
        </p>
      </div>
    </ErpModal>
  )
}
