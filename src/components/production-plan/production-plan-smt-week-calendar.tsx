'use client'

import { useMemo, useState, type DragEvent } from 'react'
import { ProductionPlanBoardCard } from '@/components/production-plan/production-plan-board-card'
import {
  readProductionPlanDragPayloadFromDataTransfer,
  type ProductionPlanDragPayload,
} from '@/lib/production-plan/config'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'
import { formatCalendarDayLabel, formatWeekdayLabel } from '@/lib/smt/plan/utils'
import { ERP_TABLE_HEAD_CLASS } from '@/lib/ui/tokens'

type ProductionPlanSmtWeekCalendarProps = {
  weekDates: string[]
  scheduledRows: ProductionPlanBoardRow[]
  onSelectRow?: (row: ProductionPlanBoardRow) => void
  onDropOrder?: (
    payload: ProductionPlanDragPayload,
    target: { plannedDate: string; lineNo: number },
  ) => void
}

function cellKey(plannedDate: string, lineNo: number) {
  return `${plannedDate}:${lineNo}`
}

export function ProductionPlanSmtWeekCalendar({
  weekDates,
  scheduledRows,
  onSelectRow,
  onDropOrder,
}: ProductionPlanSmtWeekCalendarProps) {
  const today = todayYmdSeoul()
  const lineNos = SMT_PLAN_LINE_NOS
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const rowsByCell = useMemo(() => {
    const map = new Map<string, ProductionPlanBoardRow[]>()
    for (const row of scheduledRows) {
      if (row.scope !== 'smt') continue
      const date = row.plannedDate.trim().slice(0, 10)
      const lineNo = row.lineNo != null && row.lineNo >= 1 ? row.lineNo : 0
      if (!date || lineNo < 1) continue
      const key = cellKey(date, lineNo)
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return map
  }, [scheduledRows])

  function handleDragOver(event: DragEvent, key: string) {
    if (!onDropOrder) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragOverKey(key)
  }

  function handleDrop(event: DragEvent, plannedDate: string, lineNo: number) {
    if (!onDropOrder) return
    event.preventDefault()
    setDragOverKey(null)
    const payload = readProductionPlanDragPayloadFromDataTransfer(event.dataTransfer)
    if (!payload || payload.scope !== 'smt') return
    onDropOrder(payload, { plannedDate, lineNo })
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white">
      <table className="min-w-[960px] w-full border-collapse">
        <thead className={ERP_TABLE_HEAD_CLASS}>
          <tr>
            <th className="sticky left-0 z-[1] w-20 border-b border-r border-slate-200 bg-slate-50 px-2 py-3 text-left text-xs font-semibold text-slate-500">
              라인
            </th>
            {weekDates.map((date) => {
              const isToday = date === today
              return (
                <th
                  key={date}
                  className={`min-w-[120px] border-b border-r px-2 py-2 text-center last:border-r-0 ${
                    isToday
                      ? 'border-sky-300 bg-sky-100 ring-2 ring-inset ring-sky-400'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <p
                    className={`text-[11px] font-semibold ${isToday ? 'text-sky-700' : 'text-slate-500'}`}
                  >
                    {formatWeekdayLabel(date)}
                    {isToday ? ' · 오늘' : ''}
                  </p>
                  <p
                    className={`text-sm font-extrabold tabular-nums ${isToday ? 'text-sky-950' : 'text-slate-800'}`}
                  >
                    {formatCalendarDayLabel(date)}
                  </p>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {lineNos.map((lineNo) => (
            <tr key={lineNo} className="border-b border-slate-100 last:border-b-0">
              <td className="sticky left-0 z-[1] border-r border-slate-200 bg-slate-50 px-2 py-3 align-top text-xs font-bold text-slate-700">
                라인 {lineNo}
              </td>
              {weekDates.map((plannedDate) => {
                const key = cellKey(plannedDate, lineNo)
                const cellRows = rowsByCell.get(key) ?? []
                const isToday = plannedDate === today
                const isDropTarget = dragOverKey === key

                return (
                  <td
                    key={key}
                    className={`min-h-[110px] border-r align-top p-1.5 last:border-r-0 ${
                      isDropTarget
                        ? 'border-sky-300 bg-sky-100 ring-2 ring-inset ring-sky-400'
                        : isToday
                          ? 'border-sky-200 bg-sky-50/70'
                          : 'border-slate-100'
                    }`}
                    onDragOver={(event) => handleDragOver(event, key)}
                    onDragLeave={() => setDragOverKey((current) => (current === key ? null : current))}
                    onDrop={(event) => handleDrop(event, plannedDate, lineNo)}
                  >
                    <div className="flex min-h-[96px] flex-col gap-1">
                      {cellRows.map((row) => (
                        <ProductionPlanBoardCard
                          key={row.key}
                          row={row}
                          tone="smt"
                          onSelect={onSelectRow}
                        />
                      ))}
                      {cellRows.length === 0 ? (
                        <div
                          className={`flex flex-1 items-center justify-center rounded-lg border border-dashed px-1 py-6 text-[11px] ${
                            isDropTarget
                              ? 'border-sky-400 bg-sky-50 text-sky-700'
                              : 'border-slate-200 text-slate-400'
                          }`}
                        >
                          {isDropTarget ? '여기에 놓기' : '끌어다 놓기'}
                        </div>
                      ) : isDropTarget ? (
                        <div className="rounded-md border border-dashed border-sky-400 bg-sky-50 px-1 py-2 text-center text-[10px] font-semibold text-sky-700">
                          여기에 추가
                        </div>
                      ) : null}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
