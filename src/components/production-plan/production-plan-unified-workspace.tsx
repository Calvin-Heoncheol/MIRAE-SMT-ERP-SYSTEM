'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ProductionPlanFetchError } from '@/components/production-plan/production-plan-fetch-error'
import { ProductionPlanPendingSidebar } from '@/components/production-plan/production-plan-pending-sidebar'
import { ProductionPlanPostWeekCalendar } from '@/components/production-plan/production-plan-post-week-calendar'
import { ProductionPlanSmtWeekCalendar } from '@/components/production-plan/production-plan-smt-week-calendar'
import {
  buildScheduleFormValues,
  ProductionPlanScheduleModal,
  type ProductionPlanScheduleFormValues,
} from '@/components/production-plan/production-plan-schedule-modal'
import { useDashboardChrome } from '@/components/dashboard/dashboard-chrome'
import { useToast } from '@/components/ui/toast-provider'
import { todayYmdSeoul } from '@/lib/orders/utils'
import {
  addWeeksYmd,
  formatWeekLabel,
  getWeekStartYmd,
  isYmdInWeek,
} from '@/lib/production-plan/calendar'
import type { ProductionPlanDragPayload } from '@/lib/production-plan/config'
import { canPlanPost, canPlanSmt, validatePostPlanDate } from '@/lib/production-plan/pipeline'
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

function matchesSearchHaystack(
  fields: Array<string | null | undefined>,
  query: string,
) {
  if (!query) return true
  return fields
    .map((value) => String(value || '').toLowerCase())
    .join(' ')
    .includes(query)
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
  const [pendingSearch, setPendingSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const lastCommittedQtyRef = useRef<Record<string, number>>({})
  const toast = useToast()
  const { focusMode, toggleFocusMode, setFocusMode } = useDashboardChrome()

  useEffect(() => {
    return () => setFocusMode(false)
  }, [setFocusMode])

  const allLines = useMemo(() => buildUnifiedPlanSheetLines(rows), [rows])

  const pendingLines = useMemo(() => {
    const q = pendingSearch.trim().toLowerCase()
    return filterUnifiedPlanSheetLines(allLines, 'now', weekStart, rows).filter((line) => {
      if (!pickPlanningRowForLine(line, scopeFilter)) return false
      return matchesSearchHaystack(
        [
          line.rep.orderNumber,
          line.rep.customerPoNumber,
          line.rep.customer,
          line.rep.productName,
          line.rep.productCode,
          line.rep.deliveryDate,
        ],
        q,
      )
    })
  }, [allLines, weekStart, rows, scopeFilter, pendingSearch])

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const isSmtTab = scopeFilter === 'smt'
  const isPostTab = scopeFilter === 'post'

  const scheduledRows = useMemo(() => {
    return rows.filter((row) => {
      if (!isProductionPlanScheduleRow(row)) return false
      if (row.scope !== scopeFilter) return false
      return isYmdInWeek(row.plannedDate, weekStart)
    })
  }, [rows, weekStart, scopeFilter])

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
    const base = buildScheduleFormValues(row, seed, rows)
    const initialValues = {
      ...base,
      ...(options?.lineNo != null && options.lineNo >= 1 ? { lineNo: options.lineNo } : {}),
      ...(options?.team ? { team: options.team } : {}),
    }

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

  function resolveDropRow(payload: ProductionPlanDragPayload): ProductionPlanBoardRow | null {
    for (const line of pendingLines) {
      const planRow = pickPlanningRowForLine(line, payload.scope)
      if (planRow && planRow.key === payload.key) return planRow
    }
    return rows.find((row) => row.key === payload.key && row.scope === payload.scope) ?? null
  }

  function handleSmtDrop(
    payload: ProductionPlanDragPayload,
    target: { plannedDate: string; lineNo: number },
  ) {
    if (payload.scope !== 'smt') {
      toast.error('배정 불가', 'SMT 탭에는 SMT 미배정 발주만 놓을 수 있습니다.')
      return
    }
    const row = resolveDropRow(payload)
    if (!row) {
      toast.error('배정 불가', '해당 발주를 찾을 수 없습니다.')
      return
    }
    if (isProductionPlanRemainderRow(row) && !canPlanSmt(row)) {
      toast.error('배정 불가', '자재 준비 후 SMT 배정이 가능합니다.')
      return
    }
    handleSelectDate(target.plannedDate)
    openScheduleModal(row, target.plannedDate, { lineNo: target.lineNo })
  }

  function handlePostDrop(
    payload: ProductionPlanDragPayload,
    target: { plannedDate: string; team: PostProcessTeam },
  ) {
    if (payload.scope !== 'post') {
      toast.error('배정 불가', '후공정 탭에는 후공정 미배정 발주만 놓을 수 있습니다.')
      return
    }
    const row = resolveDropRow(payload)
    if (!row) {
      toast.error('배정 불가', '해당 발주를 찾을 수 없습니다.')
      return
    }
    const validationError = validateBeforeSchedule(row, target.plannedDate)
    if (validationError) {
      toast.error('배정 불가', validationError)
      return
    }
    handleSelectDate(target.plannedDate)
    openScheduleModal(row, target.plannedDate, { team: target.team })
  }

  function validateBeforeSchedule(row: ProductionPlanBoardRow, plannedDate: string) {
    if (row.scope === 'smt' && isProductionPlanRemainderRow(row) && !canPlanSmt(row)) {
      return '자재 준비 후 SMT 배정이 가능합니다.'
    }
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white">
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

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFocusMode}
                title={focusMode ? '전체화면 종료 (Esc)' : '전체화면 — 계획표만 보기'}
                aria-label={focusMode ? '전체화면 종료' : '전체화면'}
                aria-pressed={focusMode}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                  focusMode
                    ? 'border-slate-800 bg-slate-800 text-white hover:bg-slate-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {focusMode ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9H4V4M15 9h5V4M9 15H4v5M15 15h5v5" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <ProductionPlanPendingSidebar
            pendingLines={pendingLines}
            allRows={rows}
            scope={scopeFilter}
            search={pendingSearch}
            onSearchChange={setPendingSearch}
          />
          {isSmtTab ? (
            <ProductionPlanSmtWeekCalendar
              weekDates={weekDates}
              scheduledRows={scheduledRows}
              onDropOrder={handleSmtDrop}
              onSelectRow={(row) => openScheduleModal(row)}
            />
          ) : isPostTab ? (
            <ProductionPlanPostWeekCalendar
              weekDates={weekDates}
              scheduledRows={scheduledRows}
              onDropOrder={handlePostDrop}
              onSelectRow={(row) => openScheduleModal(row)}
            />
          ) : null}
        </div>
      </div>

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
                [],
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
