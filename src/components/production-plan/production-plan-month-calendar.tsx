'use client'

import { useState } from 'react'
import {
  MONTH_WEEKDAY_LABELS,
  type MonthCalendarCell,
} from '@/lib/production-plan/calendar'
import {
  parseProductionPlanDragPayload,
  SHARED_PRODUCTION_PLAN_DRAG_MIME,
  type ProductionPlanDragPayload,
} from '@/lib/production-plan/config'
import {
  PRODUCTION_PLAN_SCOPE_LABELS,
  type ProductionPlanBoardRow,
} from '@/lib/production-plan/types'
import { formatInternalCodeLabel } from '@/lib/orders/utils'

type ProductionPlanMonthCalendarProps = {
  cells: MonthCalendarCell[]
  scheduledRows: ProductionPlanBoardRow[]
  selectedYmd?: string
  onSelectDate?: (ymd: string) => void
  onSelectRow?: (row: ProductionPlanBoardRow) => void
  onDrop?: (payload: ProductionPlanDragPayload, ymd: string) => void
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
  selectedYmd = '',
  onSelectDate,
  onSelectRow,
  onDrop,
}: ProductionPlanMonthCalendarProps) {
  const [dragOverYmd, setDragOverYmd] = useState<string | null>(null)

  const rowsByDate = new Map<string, ProductionPlanBoardRow[]>()
  for (const row of scheduledRows) {
    const date = row.plannedDate.trim().slice(0, 10)
    if (!date) continue
    const list = rowsByDate.get(date) ?? []
    list.push(row)
    rowsByDate.set(date, list)
  }

  function handleDragOver(event: React.DragEvent, ymd: string) {
    if (!onDrop) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverYmd(ymd)
  }

  function handleDrop(event: React.DragEvent, ymd: string) {
    event.preventDefault()
    setDragOverYmd(null)
    if (!onDrop) return

    const payload = parseProductionPlanDragPayload(
      event.dataTransfer.getData(SHARED_PRODUCTION_PLAN_DRAG_MIME),
    )
    if (!payload) return
    onDrop(payload, ymd)
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
        왼쪽 발주 카드를 날짜 칸으로 드래그해 배정하거나, 날짜 클릭 후 카드를 눌러도 됩니다. 일정
        카드 클릭 → 수정·취소.
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

      <div className="grid min-h-[520px] flex-1 grid-cols-7 auto-rows-fr">
        {cells.map((cell) => {
          const dayRows = rowsByDate.get(cell.ymd) ?? []
          const isSelected = selectedYmd === cell.ymd
          const isDropTarget = dragOverYmd === cell.ymd
          return (
            <div
              key={cell.ymd}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDate?.(cell.ymd)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onSelectDate?.(cell.ymd)
              }}
              onDragOver={(event) => handleDragOver(event, cell.ymd)}
              onDragLeave={() =>
                setDragOverYmd((current) => (current === cell.ymd ? null : current))
              }
              onDrop={(event) => handleDrop(event, cell.ymd)}
              className={`min-h-[100px] cursor-pointer border-b border-r border-slate-100 p-1.5 text-left transition ${
                cell.inMonth ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/80 hover:bg-slate-100/80'
              } ${cell.isToday ? 'bg-sky-50/80' : ''} ${
                isSelected ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400' : ''
              } ${isDropTarget ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-400' : ''}`}
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
                    <span
                      key={row.key}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelectRow?.(row)
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        event.stopPropagation()
                        onSelectRow?.(row)
                      }}
                      className={`block w-full cursor-pointer rounded-md border px-1.5 py-1 text-[10px] leading-snug shadow-sm transition hover:brightness-95 ${scopeTone(row.scope)}`}
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
                    </span>
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
