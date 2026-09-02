'use client'

import {
  MONTH_WEEKDAY_LABELS,
  type MonthCalendarCell,
} from '@/lib/production-plan/calendar'
import {
  PRODUCTION_PLAN_SCOPE_LABELS,
  type ProductionPlanBoardRow,
} from '@/lib/production-plan/types'
import { formatInternalCodeLabel } from '@/lib/orders/utils'

type ProductionPlanMonthCalendarProps = {
  cells: MonthCalendarCell[]
  scheduledRows: ProductionPlanBoardRow[]
  onSelectRow?: (row: ProductionPlanBoardRow) => void
}

function scopeTone(scope: ProductionPlanBoardRow['scope']) {
  if (scope === 'material') return 'border-amber-200 bg-amber-50 text-amber-900'
  if (scope === 'smt') return 'border-sky-200 bg-sky-50 text-sky-900'
  return 'border-violet-200 bg-violet-50 text-violet-900'
}

function scheduleMeta(row: ProductionPlanBoardRow) {
  if (row.scope === 'material') return '자재'
  if (row.scope === 'smt' && row.lineNo) {
    return `L${row.lineNo}`
  }
  if (row.scope === 'post' && row.team) {
    return row.team
  }
  return ''
}

export function ProductionPlanMonthCalendar({
  cells,
  scheduledRows,
  onSelectRow,
}: ProductionPlanMonthCalendarProps) {
  const rowsByDate = new Map<string, ProductionPlanBoardRow[]>()
  for (const row of scheduledRows) {
    const date = row.plannedDate.trim().slice(0, 10)
    if (!date) continue
    const list = rowsByDate.get(date) ?? []
    list.push(row)
    rowsByDate.set(date, list)
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
        일정 카드를 클릭하면 상세 보기·수정·삭제할 수 있습니다.
      </div>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {MONTH_WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            className={`px-2 py-2 text-center text-xs font-bold ${
              index === 0 ? 'text-rose-600' : index === 6 ? 'text-sky-600' : 'text-slate-600'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid min-h-[640px] flex-1 grid-cols-7 auto-rows-fr">
        {cells.map((cell) => {
          const dayRows = rowsByDate.get(cell.ymd) ?? []
          return (
            <div
              key={cell.ymd}
              className={`min-h-[110px] border-b border-r border-slate-100 p-1.5 ${
                cell.inMonth ? 'bg-white' : 'bg-slate-50/80'
              } ${cell.isToday ? 'bg-sky-50/80 ring-2 ring-inset ring-sky-300' : ''}`}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                    cell.isToday
                      ? 'bg-sky-600 text-white'
                      : cell.inMonth
                        ? 'text-slate-800'
                        : 'text-slate-300'
                  }`}
                >
                  {cell.day}
                </span>
                {dayRows.length > 0 ? (
                  <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                    {dayRows.length}
                  </span>
                ) : null}
              </div>

              <div className="space-y-1">
                {dayRows.map((row) => {
                  const meta = scheduleMeta(row)
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => onSelectRow?.(row)}
                      className={`w-full rounded-md border px-1.5 py-1 text-left text-[10px] leading-snug shadow-sm transition hover:brightness-95 ${scopeTone(row.scope)}`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="font-bold">{PRODUCTION_PLAN_SCOPE_LABELS[row.scope]}</span>
                        {meta ? <span className="opacity-80">{meta}</span> : null}
                      </div>
                      <p className="truncate font-semibold">{row.productName}</p>
                      <p className="truncate font-mono opacity-80">
                        {formatInternalCodeLabel(row.orderNumber)}
                      </p>
                      {row.plannedQuantity ? (
                        <p className="tabular-nums opacity-90">
                          {row.plannedQuantity.toLocaleString('ko-KR')}대
                        </p>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
