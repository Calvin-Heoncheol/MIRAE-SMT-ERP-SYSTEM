'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ProductionPlanFetchError } from '@/components/production-plan/production-plan-fetch-error'
import {
  ProductionPlanOrderPickerModal,
  type ProductionPlanPickerTarget,
} from '@/components/production-plan/production-plan-order-picker-modal'
import {
  buildScheduleFormValues,
  ProductionPlanScheduleModal,
  type ProductionPlanScheduleFormValues,
} from '@/components/production-plan/production-plan-schedule-modal'
import {
  ProductionPlanStageScheduleModal,
  type ProductionPlanStageValues,
} from '@/components/production-plan/production-plan-stage-schedule-modal'
import { useDashboardChrome } from '@/components/dashboard/dashboard-chrome'
import { useToast } from '@/components/ui/toast-provider'
import { addDaysYmd, todayYmdSeoul } from '@/lib/orders/utils'
import {
  ProductionPlanWeekGantt,
  type ProductionPlanGanttSlot,
} from '@/components/production-plan/production-plan-week-gantt'
import {
  addWeeksYmd,
  formatWeekLabel,
  getWeekStartYmd,
  planCoversYmd,
} from '@/lib/production-plan/calendar'
import { getWeekDates } from '@/lib/smt/plan/utils'
import {
  confirmProductionPlanItem,
  fetchProductionPlanBoard,
  unconfirmProductionPlanItem,
} from '@/lib/production-plan/repository'
import type {
  FetchProductionPlanBoardResult,
  ProductionPlanBoardRow,
} from '@/lib/production-plan/types'
import { buildUnifiedPlanSheetLines } from '@/lib/production-plan/unified-plan-lines'
import { isProductionPlanScheduleRow } from '@/lib/production-plan/utils'

type ProductionPlanUnifiedWorkspaceProps = {
  initialResult: FetchProductionPlanBoardResult
  initialWeekStart: string
}

type ModalState =
  | { open: false }
  | {
      open: true
      row: ProductionPlanBoardRow
      initialValues: ProductionPlanScheduleFormValues
    }

const ALL_CUSTOMERS = ''

type SlotDefaults = { lineNo?: number; team?: string }

type StageModalState = ({ row: ProductionPlanBoardRow; seedDate: string } & SlotDefaults) | null

const STAGE_LABELS: Record<ProductionPlanBoardRow['scope'], string> = {
  material: '자재',
  smt: 'SMD',
  post: '후공정',
}

function ymdDiffDays(from: string, to: string) {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

function customerOf(row: { customer?: string | null }) {
  return String(row.customer || '').trim()
}

const EMPTY_ROW: ProductionPlanBoardRow = {
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
}

export function ProductionPlanUnifiedWorkspace({
  initialResult,
  initialWeekStart,
}: ProductionPlanUnifiedWorkspaceProps) {
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [pickerSlot, setPickerSlot] = useState<SlotDefaults>({})
  const [customer, setCustomer] = useState(ALL_CUSTOMERS)
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
  const [stageModal, setStageModal] = useState<StageModalState>(null)
  const [stageSaving, setStageSaving] = useState(false)
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

  const allOrderLines = useMemo(() => {
    return buildUnifiedPlanSheetLines(rows)
      .filter(
        (line) =>
          line.kind === 'main' &&
          line.rowKind === 'smt_work' &&
          line.rep.remainingQty > 0 &&
          // 한 번이라도 출하된 주문은 배정 목록에서 숨김 (이미 잡힌 계획은 달력에 유지)
          (line.rep.shippedQty ?? 0) <= 0,
      )
      .map((line) => line.rep)
  }, [rows])

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  const allScheduledRows = useMemo(() => {
    return rows.filter((row) => {
      if (!isProductionPlanScheduleRow(row) || !row.plannedDate) return false
      return weekDates.some((ymd) => planCoversYmd(row.plannedDate, row.plannedEndDate, ymd))
    })
  }, [rows, weekDates])

  const customerOptions = useMemo(() => {
    const planCounts = new Map<string, number>()
    for (const row of allScheduledRows) {
      const name = customerOf(row)
      if (name) planCounts.set(name, (planCounts.get(name) ?? 0) + 1)
    }
    const names = new Set(planCounts.keys())
    for (const row of allOrderLines) {
      const name = customerOf(row)
      if (name) names.add(name)
    }
    if (customer) names.add(customer)
    return [...names]
      .sort((a, b) => a.localeCompare(b, 'ko'))
      .map((name) => ({ name, planCount: planCounts.get(name) ?? 0 }))
  }, [allScheduledRows, allOrderLines, customer])

  const orderLines = useMemo(
    () =>
      customer ? allOrderLines.filter((row) => customerOf(row) === customer) : allOrderLines,
    [allOrderLines, customer],
  )

  const scheduledRows = useMemo(
    () =>
      customer ? allScheduledRows.filter((row) => customerOf(row) === customer) : allScheduledRows,
    [allScheduledRows, customer],
  )

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

  function openScheduleModal(row: ProductionPlanBoardRow, dateSeed?: string) {
    const seed =
      dateSeed ?? (isProductionPlanScheduleRow(row) ? row.plannedDate.slice(0, 10) : todayYmdSeoul())
    setModal({
      open: true,
      row,
      initialValues: buildScheduleFormValues(row, seed, rows),
    })
  }

  function handlePickOrder(row: ProductionPlanBoardRow) {
    if (!pickerTarget) return
    const seedDate = pickerTarget.plannedDate
    setPickerTarget(null)
    setStageModal({ row, seedDate, ...pickerSlot })
  }

  function handleGanttCellClick(slot: ProductionPlanGanttSlot) {
    if (moveSource) {
      // 다른 공정 줄로는 옮기지 않고 날짜만 반영
      const sameScope = moveSource.scope === slot.scope
      void handleMoveTo(slot.plannedDate, sameScope ? { lineNo: slot.lineNo, team: slot.team } : {})
      return
    }
    setPickerSlot({ lineNo: slot.lineNo, team: slot.team })
    setPickerTarget({ plannedDate: slot.plannedDate })
  }

  async function handleStageSubmit(stages: ProductionPlanStageValues[]) {
    if (!stageModal) return
    const row = stageModal.row
    setStageSaving(true)
    const saved: string[] = []
    for (const stage of stages) {
      const targetId = stage.scope === 'post' ? row.postTargetId || '' : row.targetId
      const result = await confirmProductionPlanItem({
        scope: stage.scope,
        orderId: row.orderId,
        targetId,
        plannedDate: stage.plannedDate,
        plannedEndDate: stage.plannedEndDate,
        planStatus: 'confirmed',
        plannedQuantity: stage.plannedQuantity,
        lineNo: stage.scope === 'smt' ? stage.lineNo : undefined,
        pcbSide: stage.scope === 'smt' ? (row.splitPcbSides ? 'BOTH' : 'SINGLE') : undefined,
        team: stage.scope === 'post' ? stage.team : undefined,
      })
      if (!result.ok) {
        setStageSaving(false)
        toast.error(
          '배정 실패',
          `${saved.length ? `${saved.join('·')}은 저장됐지만 ` : ''}${STAGE_LABELS[stage.scope]} 저장에 실패했습니다. ${result.detail}`,
        )
        await reload({ background: true })
        return
      }
      saved.push(STAGE_LABELS[stage.scope])
    }
    setStageSaving(false)
    setStageModal(null)
    toast.success('생산계획', `${saved.join('·')} 일정을 배정했습니다.`)
    await reload({ background: true })
  }

  async function handleMoveTo(plannedDate: string, slot: SlotDefaults = {}) {
    const row = moveSource
    if (!row || moveSaving) return
    const startDate = row.plannedDate.slice(0, 10)
    const lineNo = row.scope === 'smt' ? (slot.lineNo ?? row.lineNo ?? 1) : undefined
    const team = row.scope === 'post' ? (slot.team ?? row.team ?? '') : undefined
    if (
      plannedDate === startDate &&
      (row.scope !== 'smt' || lineNo === row.lineNo) &&
      (row.scope !== 'post' || team === row.team)
    ) {
      setMoveSource(null)
      return
    }

    const spanDays = ymdDiffDays(startDate, row.plannedEndDate || startDate)
    setMoveSaving(true)
    const result = await confirmProductionPlanItem({
      scope: row.scope,
      orderId: row.orderId,
      targetId: row.targetId,
      plannedDate,
      plannedEndDate: addDaysYmd(plannedDate, spanDays),
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
    toast.success('생산계획', '이동했습니다.')
    await reload({ background: true })
  }

  async function handleModalSubmit(values: ProductionPlanScheduleFormValues) {
    if (!modal.open) return
    const row = modal.row

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
            <label className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-600">고객사</span>
              <select
                value={customer}
                onChange={(event) => {
                  setCustomer(event.target.value)
                  setMoveSource(null)
                }}
                className="min-w-[10rem] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400"
              >
                <option value={ALL_CUSTOMERS}>전체 ({allScheduledRows.length})</option>
                {customerOptions.map((option) => (
                  <option key={option.name} value={option.name}>
                    {option.name} ({option.planCount})
                  </option>
                ))}
              </select>
            </label>

            <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => setWeekStart(addWeeksYmd(weekStart, -1))}
                aria-label="이전 주"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-600 hover:bg-slate-50"
              >
                ‹
              </button>
              <p className="min-w-[11rem] px-1 text-center text-sm font-bold tabular-nums text-slate-900">
                {formatWeekLabel(weekStart)}
              </p>
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

            <div className="ml-auto flex items-center gap-3">
              <span className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden />
                  자재
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" aria-hidden />
                  SMD
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" aria-hidden />
                  후공정
                </span>
              </span>
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
              옮길 칸을 클릭하세요. 같은 공정 줄이면 라인·팀도 바뀌고, 다른 주로 넘겨서 옮길 수도 있습니다. (Esc 취소)
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

        <ProductionPlanWeekGantt
          weekDates={weekDates}
          scheduledRows={scheduledRows}
          onCellClick={handleGanttCellClick}
          onSelectRow={(row) => openScheduleModal(row)}
          onStartMove={setMoveSource}
          movingRowKey={moveSource?.key ?? null}
        />
      </div>

      <ProductionPlanOrderPickerModal
        key={pickerTarget ? pickerTarget.plannedDate : 'closed'}
        target={pickerTarget}
        orderLines={orderLines}
        onClose={() => setPickerTarget(null)}
        onPick={handlePickOrder}
      />

      {stageModal ? (
        <ProductionPlanStageScheduleModal
          key={`${stageModal.row.targetId}:${stageModal.seedDate}:${stageModal.lineNo ?? ''}:${stageModal.team ?? ''}`}
          row={stageModal.row}
          seedDate={stageModal.seedDate}
          defaultLineNo={stageModal.lineNo}
          defaultTeam={stageModal.team}
          allRows={rows}
          saving={stageSaving}
          onClose={() => setStageModal(null)}
          onSubmit={handleStageSubmit}
        />
      ) : null}

      <ProductionPlanScheduleModal
        open={modal.open}
        row={modal.open ? modal.row : null}
        allRows={rows}
        initialValues={
          modal.open ? modal.initialValues : buildScheduleFormValues(EMPTY_ROW, todayYmdSeoul(), [])
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
