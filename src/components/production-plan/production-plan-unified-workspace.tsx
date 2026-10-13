'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ProductionPlanFetchError } from '@/components/production-plan/production-plan-fetch-error'
import {
  ProductionPlanOrderPickerModal,
  type ProductionPlanPickerTarget,
} from '@/components/production-plan/production-plan-order-picker-modal'
import { ProductionPlanPostWeekCalendar } from '@/components/production-plan/production-plan-post-week-calendar'
import { ProductionPlanSmtWeekCalendar } from '@/components/production-plan/production-plan-smt-week-calendar'
import {
  buildScheduleFormValues,
  ProductionPlanScheduleModal,
  type ProductionPlanScheduleFormValues,
} from '@/components/production-plan/production-plan-schedule-modal'
import { useDashboardChrome } from '@/components/dashboard/dashboard-chrome'
import { useToast } from '@/components/ui/toast-provider'
import { addDaysYmd, todayYmdSeoul } from '@/lib/orders/utils'
import {
  addWeeksYmd,
  formatWeekLabel,
  getWeekStartYmd,
  isYmdInWeek,
  planCoversYmd,
} from '@/lib/production-plan/calendar'
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

function ymdDiffDays(from: string, to: string) {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

type MoveTarget = { plannedDate: string; lineNo?: number; team?: string }

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
  const [pickerTarget, setPickerTarget] = useState<ProductionPlanPickerTarget | null>(null)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [moveSource, setMoveSource] = useState<ProductionPlanBoardRow | null>(null)
  const [moveSaving, setMoveSaving] = useState(false)
  const lastCommittedQtyRef = useRef<Record<string, number>>({})
  const toast = useToast()
  const { focusMode, toggleFocusMode, setFocusMode } = useDashboardChrome()

  useEffect(() => {
    return () => setFocusMode(false)
  }, [setFocusMode])

  useEffect(() => {
    if (!moveSource) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoveSource(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [moveSource])

  const allLines = useMemo(() => buildUnifiedPlanSheetLines(rows), [rows])

  const pendingLines = useMemo(() => {
    return filterUnifiedPlanSheetLines(allLines, 'now', weekStart, rows).filter((line) => {
      const planningRow = pickPlanningRowForLine(line, scopeFilter)
      if (!planningRow) return false
      // 한 번이라도 출하된 주문은 미배정 목록에서 숨김 (이미 잡힌 계획은 달력에 유지)
      return (planningRow.shippedQty ?? 0) <= 0
    })
  }, [allLines, weekStart, rows, scopeFilter])

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  const isSmtTab = scopeFilter === 'smt'
  const isPostTab = scopeFilter === 'post'

  const scheduledRows = useMemo(() => {
    return rows.filter((row) => {
      if (!isProductionPlanScheduleRow(row)) return false
      if (row.scope !== scopeFilter) return false
      return weekDates.some((ymd) => planCoversYmd(row.plannedDate, row.plannedEndDate, ymd))
    })
  }, [rows, weekDates, scopeFilter])

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

  function handlePickOrder(row: ProductionPlanBoardRow) {
    if (!pickerTarget) return
    const target = pickerTarget
    const validationError = validateBeforeSchedule(row, target.plannedDate)
    if (validationError) {
      toast.error('배정 불가', validationError)
      return
    }
    setPickerTarget(null)
    handleSelectDate(target.plannedDate)
    openScheduleModal(
      row,
      target.plannedDate,
      target.scope === 'smt' ? { lineNo: target.lineNo } : { team: target.team },
    )
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

  async function handleMoveTo(target: MoveTarget) {
    const row = moveSource
    if (!row || moveSaving) return
    const startDate = row.plannedDate.slice(0, 10)
    const lineNo = row.scope === 'smt' ? (target.lineNo ?? row.lineNo ?? 1) : undefined
    const team = row.scope === 'post' ? (target.team ?? row.team ?? '') : undefined
    if (
      target.plannedDate === startDate &&
      (row.scope === 'smt' ? lineNo === row.lineNo : team === row.team)
    ) {
      setMoveSource(null)
      return
    }

    const validationError = validateBeforeSchedule(row, target.plannedDate)
    if (validationError) {
      toast.error('이동 불가', validationError)
      return
    }

    const spanDays = ymdDiffDays(startDate, row.plannedEndDate || startDate)
    setMoveSaving(true)
    const result = await confirmProductionPlanItem({
      scope: row.scope,
      orderId: row.orderId,
      targetId: row.targetId,
      plannedDate: target.plannedDate,
      plannedEndDate: addDaysYmd(target.plannedDate, spanDays),
      planStatus: 'confirmed',
      plannedQuantity: Math.max(1, Math.round(Number(row.plannedQuantity) || 1)),
      lineNo,
      pcbSide: row.scope === 'smt' ? (row.pcbSide ?? 'SINGLE') : undefined,
      team,
      note: row.note ?? '',
      planId: row.planId,
      boardItemId: row.boardItemId,
    })
    setMoveSaving(false)

    if (!result.ok) {
      toast.error('이동 실패', result.detail)
      return
    }

    setMoveSource(null)
    setSelectedYmd(target.plannedDate)
    toast.success('생산계획', '이동했습니다.')
    await reload({ background: true })
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
      plannedEndDate: values.plannedEndDate || values.plannedDate,
      planStatus: 'confirmed',
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
                    onClick={() => {
                      setScopeFilter(option.value)
                      setMoveSource(null)
                    }}
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

        {moveSource ? (
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            <span className="font-semibold">
              {moveSource.productName || moveSource.orderNumber} 이동 중
            </span>
            <span className="text-xs text-amber-700">
              옮길 칸을 클릭하세요. 다른 주로 넘겨서 옮길 수도 있습니다. (Esc 취소)
            </span>
            {moveSaving ? <span className="text-xs text-amber-700">저장 중…</span> : null}
            <button
              type="button"
              onClick={() => setMoveSource(null)}
              className="ml-auto rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              이동 취소
            </button>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isSmtTab ? (
            <ProductionPlanSmtWeekCalendar
              weekDates={weekDates}
              scheduledRows={scheduledRows}
              onCellClick={({ plannedDate, lineNo }) =>
                moveSource
                  ? void handleMoveTo({ plannedDate, lineNo })
                  : setPickerTarget({ scope: 'smt', plannedDate, lineNo })
              }
              onSelectRow={(row) => openScheduleModal(row)}
              onStartMove={setMoveSource}
              movingRowKey={moveSource?.key ?? null}
            />
          ) : isPostTab ? (
            <ProductionPlanPostWeekCalendar
              weekDates={weekDates}
              scheduledRows={scheduledRows}
              onCellClick={({ plannedDate, team }) =>
                moveSource
                  ? void handleMoveTo({ plannedDate, team })
                  : setPickerTarget({ scope: 'post', plannedDate, team })
              }
              onSelectRow={(row) => openScheduleModal(row)}
              onStartMove={setMoveSource}
              movingRowKey={moveSource?.key ?? null}
            />
          ) : null}
        </div>
      </div>

      <ProductionPlanOrderPickerModal
        key={
          pickerTarget
            ? `${pickerTarget.plannedDate}:${pickerTarget.scope === 'smt' ? pickerTarget.lineNo : pickerTarget.team}`
            : 'closed'
        }
        target={pickerTarget}
        pendingLines={pendingLines}
        allRows={rows}
        onClose={() => setPickerTarget(null)}
        onPick={handlePickOrder}
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
                  plannedEndDate: '',
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
