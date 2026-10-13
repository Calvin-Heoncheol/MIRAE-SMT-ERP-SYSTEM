'use client'

import { useMemo } from 'react'
import { ProductionPlanBoardCard } from '@/components/production-plan/production-plan-board-card'
import {
  PRODUCTION_PLAN_DAY_CAPACITY_HOURS,
  formatCellLoadLabel,
  summarizeCellLoad,
} from '@/lib/production-plan/capacity'
import { planCoversYmd } from '@/lib/production-plan/calendar'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'
import { formatCalendarDayLabel, formatWeekdayLabel } from '@/lib/smt/plan/utils'
import { ERP_TABLE_HEAD_CLASS } from '@/lib/ui/tokens'

type ProductionPlanSmtWeekCalendarProps = {
  weekDates: string[]
  scheduledRows: ProductionPlanBoardRow[]
  onSelectRow?: (row: ProductionPlanBoardRow) => void
  /** 있으면 칸 클릭으로 발주 배정 */
  onCellClick?: (target: { plannedDate: string; lineNo: number }) => void
  onStartMove?: (row: ProductionPlanBoardRow) => void
  /** 이동 모드 — 카드 클릭도 칸 클릭으로 처리 */
  movingRowKey?: string | null
}

function cellKey(plannedDate: string, lineNo: number) {
  return `${plannedDate}:${lineNo}`
}

export function ProductionPlanSmtWeekCalendar({
  weekDates,
  scheduledRows,
  onSelectRow,
  onCellClick,
  onStartMove,
  movingRowKey = null,
}: ProductionPlanSmtWeekCalendarProps) {
  const moving = Boolean(movingRowKey)
  const today = todayYmdSeoul()
  const lineNos = SMT_PLAN_LINE_NOS

  const rowsByCell = useMemo(() => {
    const map = new Map<string, ProductionPlanBoardRow[]>()
    for (const row of scheduledRows) {
      if (row.scope !== 'smt') continue
      const lineNo = row.lineNo != null && row.lineNo >= 1 ? row.lineNo : 0
      if (lineNo < 1) continue
      for (const date of weekDates) {
        if (!planCoversYmd(row.plannedDate, row.plannedEndDate, date)) continue
        const key = cellKey(date, lineNo)
        const list = map.get(key) ?? []
        list.push(row)
        map.set(key, list)
      }
    }
    return map
  }, [scheduledRows, weekDates])

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
                const loadRows = cellRows.filter(
                  (entry) => entry.plannedDate.slice(0, 10) === plannedDate,
                )
                const load = summarizeCellLoad(loadRows)
                const isToday = plannedDate === today

                return (
                  <td
                    key={key}
                    className={`group min-h-[110px] border-r align-top p-1.5 last:border-r-0 ${
                      load.overCapacity
                        ? 'border-rose-200 bg-rose-50/60'
                        : isToday
                          ? 'border-sky-200 bg-sky-50/70'
                          : 'border-slate-100'
                    } ${
                      onCellClick
                        ? moving
                          ? 'cursor-copy hover:bg-amber-50'
                          : 'cursor-pointer hover:bg-sky-50'
                        : ''
                    }`}
                    onClick={onCellClick ? () => onCellClick({ plannedDate, lineNo }) : undefined}
                  >
                    <div className="flex min-h-[96px] flex-col gap-1">
                      {load.quantity > 0 ? (
                        <p
                          className={`px-0.5 text-[11px] font-semibold tabular-nums ${
                            load.overCapacity ? 'text-rose-700' : 'text-slate-500'
                          }`}
                          title={
                            load.quantityOnly
                              ? 'Tech Time 미입력 — 수량만 표시'
                              : `일 가동 ${PRODUCTION_PLAN_DAY_CAPACITY_HOURS}시간 기준`
                          }
                        >
                          {formatCellLoadLabel(load)}
                          {load.overCapacity ? ' · 초과' : ''}
                        </p>
                      ) : null}
                      {cellRows.map((row) => (
                        <ProductionPlanBoardCard
                          key={row.key}
                          row={row}
                          tone="smt"
                          onSelect={
                            moving ? () => onCellClick?.({ plannedDate, lineNo }) : onSelectRow
                          }
                          spanDay={row.plannedDate.slice(0, 10) !== plannedDate}
                          highlighted={row.key === movingRowKey}
                          onStartMove={moving ? undefined : onStartMove}
                        />
                      ))}
                      {onCellClick ? (
                        <div
                          className={`flex items-center justify-center rounded-md border border-dashed px-1 text-[11px] ${
                            moving
                              ? 'border-amber-200 text-amber-500 group-hover:border-amber-400 group-hover:text-amber-700'
                              : 'border-slate-200 text-slate-400 group-hover:border-sky-300 group-hover:text-sky-700'
                          } ${cellRows.length === 0 ? 'flex-1 py-6' : 'py-1.5'}`}
                        >
                          {moving ? '여기로 이동' : '+ 배정'}
                        </div>
                      ) : cellRows.length === 0 ? (
                        <div className="min-h-[48px] flex-1" />
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
