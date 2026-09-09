'use client'

import { useEffect, useMemo, useState } from 'react'
import { ProductionPlanSmtWeekCalendar } from '@/components/production-plan/production-plan-smt-week-calendar'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { getWeekStartYmd, isYmdInWeek } from '@/lib/production-plan/calendar'
import { fetchProductionPlanBoard } from '@/lib/production-plan/repository'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import { isProductionPlanScheduleRow } from '@/lib/production-plan/utils'
import { getWeekDates } from '@/lib/smt/plan/utils'

type ProductionInputPlanCalendarPanelProps = {
  active: boolean
  onSelectPlan: (row: ProductionPlanBoardRow) => void
}

export function ProductionInputPlanCalendarPanel({
  active,
  onSelectPlan,
}: ProductionInputPlanCalendarPanelProps) {
  const weekStart = useMemo(() => getWeekStartYmd(todayYmdSeoul()), [])
  const [rows, setRows] = useState<ProductionPlanBoardRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  const scheduledRows = useMemo(() => {
    return rows.filter((row) => {
      if (!isProductionPlanScheduleRow(row)) return false
      if (row.scope !== 'smt') return false
      return isYmdInWeek(row.plannedDate, weekStart)
    })
  }, [rows, weekStart])

  useEffect(() => {
    if (!active) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      const result = await fetchProductionPlanBoard()
      if (cancelled) return
      setLoading(false)
      if (!result.ok) {
        setError(result.detail)
        setRows([])
        return
      }
      setRows(result.data.rows)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [active])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      {loading ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">불러오는 중…</p>
      ) : error ? (
        <p className="px-4 py-8 text-center text-sm text-rose-600">{error}</p>
      ) : (
        <ProductionPlanSmtWeekCalendar
          weekDates={weekDates}
          scheduledRows={scheduledRows}
          cardDraggable={false}
          onSelectRow={onSelectPlan}
        />
      )}
    </div>
  )
}
