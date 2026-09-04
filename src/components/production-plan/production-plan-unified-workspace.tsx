'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ProductionPlanAssignModal,
  type ProductionPlanAssignTarget,
} from '@/components/production-plan/production-plan-assign-modal'
import { ProductionPlanFetchError } from '@/components/production-plan/production-plan-fetch-error'
import { ProductionPlanPostWeekCalendar } from '@/components/production-plan/production-plan-post-week-calendar'
import { ProductionPlanSmtWeekCalendar } from '@/components/production-plan/production-plan-smt-week-calendar'
import {
  buildScheduleFormValues,
  ProductionPlanScheduleModal,
  type ProductionPlanScheduleFormValues,
} from '@/components/production-plan/production-plan-schedule-modal'
import { useToast } from '@/components/ui/toast-provider'
import { todayYmdSeoul } from '@/lib/orders/utils'
import {
  addWeeksYmd,
  formatWeekLabel,
  getWeekStartYmd,
  isYmdInWeek,
} from '@/lib/production-plan/calendar'
import { canPlanPost, validatePostPlanDate } from '@/lib/production-plan/pipeline'
import {
  confirmProductionPlanItem,
  fetchProductionPlanBoard,
  unconfirmProductionPlanItem,
} from '@/lib/production-plan/repository'
import type {
  FetchProductionPlanBoardResult,
  ProductionPlanBoardRow,
} from '@/lib/production-plan/types'
import {
  buildUnifiedPlanSheetLines,
  filterUnifiedPlanSheetLines,
  pickPlanningRowForLine,
} from '@/lib/production-plan/unified-plan-lines'
import { isProductionPlanRemainderRow, isProductionPlanScheduleRow } from '@/lib/production-plan/utils'
import type { PostProcessTeam } from '@/lib/post-process/teams'
import { getWeekDates } from '@/lib/smt/plan/utils'

type ProductionPlanUnifiedWorkspaceProps = {
  initialResult: FetchProductionPlanBoardResult
  initialWeekStart: string
}

type ScopeFilter = 'smt' | 'post'

type ModalState =
  | { open: false }
  | {
      open: true
      row: ProductionPlanBoardRow
      initialValues: ProductionPlanScheduleFormValues
    }

const SCOPE_FILTER_OPTIONS: { value: ScopeFilter; label: string }[] = [
  { value: 'smt', label: 'SMT' },
  { value: 'post', label: '후공정' },
]

function lastCommittedQtyKey(row: ProductionPlanBoardRow) {
  return `${row.targetId}:${row.scope}`
}

function defaultNewQuantity(row: ProductionPlanBoardRow, lastByTarget: Record<string, number>) {
  const cap = Math.max(1, row.unplannedQty ?? row.remainingQty)
  const last = lastByTarget[lastCommittedQtyKey(row)]
  if (last != null && last >= 1) {
    return Math.max(1, Math.min(cap, last))
  }
  return cap
}

export function ProductionPlanUnifiedWorkspace({
  initialResult,
  initialWeekStart,
}: ProductionPlanUnifiedWorkspaceProps) {
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('smt')
  const [selectedYmd, setSelectedYmd] = useState(todayYmdSeoul())
  const [rows, setRows] = useState<ProductionPlanBoardRow[]>(
    initialResult.ok ? initialResult.data.rows : [],
  )
  const [error, setError] = useState(initialResult.ok ? '' : initialResult.detail)
  const [refreshing, setRefreshing] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalDeleting, setModalDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [assignTarget, setAssignTarget] = useState<ProductionPlanAssignTarget | null>(null)
  const lastCommittedQtyRef = useRef<Record<string, number>>({})
  const toast = useToast()

  const allLines = useMemo(() => buildUnifiedPlanSheetLines(rows), [rows])

  const pendingLines = useMemo(() => {
    const q = search.trim().toLowerCase()
    return filterUnifiedPlanSheetLines(allLines, 'now', weekStart, rows).filter((line) => {
      if (!pickPlanningRowForLine(line, scopeFilter)) return false
      if (!q) return true
      const haystack = [
        line.rep.orderNumber,
        line.rep.customer,
        line.rep.productName,
        line.rep.deliveryDate,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [allLines, weekStart, rows, scopeFilter, search])

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const isSmtTab = scopeFilter === 'smt'
  const isPostTab = scopeFilter === 'post'

  const scheduledRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (!isProductionPlanScheduleRow(row)) return false
      if (row.scope !== scopeFilter) return false
      if (!isYmdInWeek(row.plannedDate, weekStart)) return false
      if (!q) return true
      const haystack = [row.orderNumber, row.customer, row.productName, row.deliveryDate]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [rows, weekStart, scopeFilter, search])

  const reload = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background ?? false
    if (background) {
      setRefreshing(true)
    }
    setError('')
    const result = await fetchProductionPlanBoard()
    if (background) {
      setRefreshing(false)
    }
    if (!result.ok) {
      setError(result.detail)
      return
    }
    setRows(result.data.rows)
  }, [])

  function openScheduleModal(
    row: ProductionPlanBoardRow,
    dateSeed?: string,
    options?: { lineNo?: number | null; team?: string | null },
  ) {
    const seed =
      dateSeed ?? (isProductionPlanScheduleRow(row) ? row.plannedDate.slice(0, 10) : selectedYmd)
    const base = buildScheduleFormValues(row, seed)
    const withTarget = {
      ...base,
      ...(options?.lineNo != null && options.lineNo >= 1 ? { lineNo: options.lineNo } : {}),
      ...(options?.team ? { team: options.team } : {}),
    }
    const initialValues = isProductionPlanRemainderRow(row)
      ? {
          ...withTarget,
          plannedQuantity: defaultNewQuantity(row, lastCommittedQtyRef.current),
        }
      : withTarget

    setModal({
      open: true,
      row,
      initialValues,
    })
  }

  function handleSelectDate(ymd: string) {
    setSelectedYmd(ymd)
    if (!isYmdInWeek(ymd, weekStart)) {
      setWeekStart(getWeekStartYmd(ymd))
    }
  }

  function handleSmtCellClick(target: { plannedDate: string; lineNo: number }) {
    handleSelectDate(target.plannedDate)
    setAssignTarget({ scope: 'smt', plannedDate: target.plannedDate, lineNo: target.lineNo })
  }

  function handlePostCellClick(target: { plannedDate: string; team: PostProcessTeam }) {
    handleSelectDate(target.plannedDate)
    setAssignTarget({ scope: 'post', plannedDate: target.plannedDate, team: target.team })
  }

  function handleAssignSelect(row: ProductionPlanBoardRow) {
    if (!assignTarget) return
    const target = assignTarget
    setAssignTarget(null)
    if (target.scope === 'smt') {
      openScheduleModal(row, target.plannedDate, { lineNo: target.lineNo })
      return
    }
    openScheduleModal(row, target.plannedDate, { team: target.team })
  }

  function validateBeforeSchedule(row: ProductionPlanBoardRow, plannedDate: string) {
    if (row.scope === 'post') {
      if (!canPlanPost(row, rows)) {
        return 'SMD 생산계획을 먼저 확정해 주세요.'
      }
      const timing = validatePostPlanDate(row, plannedDate, rows)
      if (!timing.ok) return timing.detail
    }
    return ''
  }

  async function handleModalSubmit(values: ProductionPlanScheduleFormValues) {
    if (!modal.open) return
    const row = modal.row

    const validationError = validateBeforeSchedule(row, values.plannedDate)
    if (validationError) {
      toast.error('배정 불가', validationError)
      return
    }

    setModalSaving(true)
    const result = await confirmProductionPlanItem({
      scope: row.scope,
      orderId: row.orderId,
      targetId: row.targetId,
      plannedDate: values.plannedDate,
      plannedQuantity: values.plannedQuantity,
      lineNo: row.scope === 'smt' ? values.lineNo : undefined,
      pcbSide: row.scope === 'smt' ? values.pcbSide : undefined,
      team: row.scope === 'post' ? values.team : undefined,
      note: values.note,
      planId: row.planId,
      boardItemId: row.boardItemId,
    })
    setModalSaving(false)

    if (!result.ok) {
      toast.error('저장 실패', result.detail)
      return
    }

    lastCommittedQtyRef.current[lastCommittedQtyKey(row)] = values.plannedQuantity
    setSelectedYmd(values.plannedDate.slice(0, 10))
    setModal({ open: false })
    toast.success('생산계획', '저장했습니다.')
    await reload({ background: true })
  }

  async function handleModalDelete() {
    if (!modal.open) return
    const row = modal.row

    setModalDeleting(true)
    const result = await unconfirmProductionPlanItem({
      scope: row.scope,
      targetId: row.targetId,
      planId: row.planId,
      boardItemId: row.boardItemId,
    })
    setModalDeleting(false)

    if (!result.ok) {
      toast.error('취소 실패', result.detail)
      return
    }

    setModal({ open: false })
    toast.success('생산계획', '계획을 취소했습니다.')
    await reload({ background: true })
  }

  if (!initialResult.ok && !rows.length) {
    return <ProductionPlanFetchError result={initialResult} />
  }

  return (
    <>
      {error ? <ProductionPlanFetchError result={{ ok: false, reason: 'query', detail: error }} /> : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white">
        <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {SCOPE_FILTER_OPTIONS.map((option) => {
                const active = scopeFilter === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setScopeFilter(option.value)}
                    className={`px-3.5 py-1.5 text-sm font-semibold transition ${
                      active
                        ? option.value === 'smt'
                          ? 'bg-sky-600 text-white'
                          : 'bg-violet-600 text-white'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => setWeekStart(addWeeksYmd(weekStart, -1))}
                aria-label="이전 주"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-600 hover:bg-slate-50"
              >
                ‹
              </button>
              <div className="min-w-[11rem] px-1 text-center">
                <p className="text-sm font-bold tabular-nums text-slate-900">
                  {formatWeekLabel(weekStart)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWeekStart(addWeeksYmd(weekStart, 1))}
                aria-label="다음 주"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-600 hover:bg-slate-50"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setWeekStart(getWeekStartYmd(todayYmdSeoul()))}
                className="ml-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                이번 주
              </button>
              {refreshing ? (
                <span className="ml-1 text-xs text-slate-400">동기화 중…</span>
              ) : null}
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="발주·고객사·제품 검색"
              className="h-8 w-full max-w-[14rem] rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:ml-auto"
            />
          </div>
        </div>

        {isSmtTab ? (
          <ProductionPlanSmtWeekCalendar
            weekDates={weekDates}
            scheduledRows={scheduledRows}
            onCellClick={handleSmtCellClick}
            onSelectRow={(row) => openScheduleModal(row)}
          />
        ) : isPostTab ? (
          <ProductionPlanPostWeekCalendar
            weekDates={weekDates}
            scheduledRows={scheduledRows}
            onCellClick={handlePostCellClick}
            onSelectRow={(row) => openScheduleModal(row)}
          />
        ) : null}
      </div>

      <ProductionPlanAssignModal
        open={assignTarget != null}
        target={assignTarget}
        pendingLines={pendingLines}
        onClose={() => setAssignTarget(null)}
        onSelectRow={handleAssignSelect}
      />

      <ProductionPlanScheduleModal
        open={modal.open}
        row={modal.open ? modal.row : null}
        allRows={rows}
        initialValues={
          modal.open
            ? modal.initialValues
            : buildScheduleFormValues(
                {
                  key: '',
                  scope: 'smt',
                  orderId: '',
                  orderNumber: '',
                  customer: '',
                  deliveryDate: '',
                  daysUntilDelivery: null,
                  productId: '',
                  productName: '',
                  productCode: '',
                  productKindLabel: '',
                  targetId: '',
                  splitPcbSides: false,
                  orderQty: 0,
                  producedQty: 0,
                  remainingQty: 0,
                  materialReadyQty: 0,
                  materialScheduledQty: 0,
                  materialExpectedReadyDate: '',
                  materialShort: false,
                  materialUnknown: false,
                  status: 'waiting',
                  confirmedAt: '',
                  confirmedByName: '',
                  plannedDate: '',
                  lineNo: null,
                  team: '',
                  pcbSide: 'SINGLE',
                  plannedQuantity: null,
                },
                todayYmdSeoul(),
              )
        }
        saving={modalSaving}
        deleting={modalDeleting}
        onClose={() => setModal({ open: false })}
        onSubmit={handleModalSubmit}
        onUnassign={
          modal.open && isProductionPlanScheduleRow(modal.row) ? handleModalDelete : undefined
        }
      />
    </>
  )
}
