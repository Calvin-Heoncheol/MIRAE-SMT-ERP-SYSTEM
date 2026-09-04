'use client'

import { useMemo } from 'react'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'
import { formatCalendarDayLabel, formatWeekdayLabel } from '@/lib/smt/plan/utils'
import { ERP_TABLE_HEAD_CLASS } from '@/lib/ui/tokens'

type ProductionPlanSmtWeekCalendarProps = {
  weekDates: string[]
  scheduledRows: ProductionPlanBoardRow[]
  onSelectRow?: (row: ProductionPlanBoardRow) => void
  onCellClick?: (target: { plannedDate: string; lineNo: number }) => void
}

function cellKey(plannedDate: string, lineNo: number) {
  return `${plannedDate}:${lineNo}`
}

export function ProductionPlanSmtWeekCalendar({
  weekDates,
  scheduledRows,
  onSelectRow,
  onCellClick,
}: ProductionPlanSmtWeekCalendarProps) {
  const today = todayYmdSeoul()
  const lineNos = SMT_PLAN_LINE_NOS

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

                return (
                  <td
                    key={key}
                    className={`min-h-[110px] cursor-pointer border-r align-top p-1.5 last:border-r-0 hover:bg-slate-50/80 ${
                      isToday ? 'border-sky-200 bg-sky-50/70' : 'border-slate-100'
                    }`}
                    onClick={() => onCellClick?.({ plannedDate, lineNo })}
                  >
                    <div className="flex min-h-[96px] flex-col gap-1">
                      {cellRows.map((row) => (
                        <button
                          key={row.key}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onSelectRow?.(row)
                          }}
                          className="w-full rounded-md border border-sky-200 bg-sky-50 px-1.5 py-1.5 text-left text-[10px] leading-snug text-sky-900 shadow-sm transition hover:brightness-95"
                        >
                          <div className="flex min-w-0 items-center gap-1">
                            <p className="min-w-0 truncate font-semibold">{row.productName || '—'}</p>
                            {row.pcbSide === 'TOP' || row.pcbSide === 'BOT' ? (
                              <span className="shrink-0 rounded bg-white/80 px-1 py-0.5 text-[9px] font-bold text-sky-800">
                                {row.pcbSide}
                              </span>
                            ) : null}
                          </div>
                          {row.plannedQuantity ? (
                            <p className="mt-0.5 tabular-nums opacity-90">
                              {row.plannedQuantity.toLocaleString('ko-KR')}대
                            </p>
                          ) : null}
                        </button>
                      ))}
                      {cellRows.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 px-1 py-6 text-[11px] text-slate-400">
                          클릭하여 배정
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
