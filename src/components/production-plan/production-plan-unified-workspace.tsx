'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ProductionPlanBadgeAssignModal,
  type PlanBadgeValues,
} from '@/components/production-plan/production-plan-badge-assign-modal'
import {
  ProductionPlanEventModal,
  type ProductionPlanEventValues,
} from '@/components/production-plan/production-plan-event-modal'
import { ProductionPlanFetchError } from '@/components/production-plan/production-plan-fetch-error'
import { ProductionPlanMonthCalendar } from '@/components/production-plan/production-plan-month-calendar'
import {
  ProductionPlanOrderPickerModal,
  type ProductionPlanPickerTarget,
} from '@/components/production-plan/production-plan-order-picker-modal'
import {
  planItemFromBoardRow,
  planItemFromEvent,
  type PlanCalendarItem,
} from '@/components/production-plan/production-plan-plan-bars'
import {
  buildScheduleFormValues,
  ProductionPlanScheduleModal,
  type ProductionPlanScheduleFormValues,
} from '@/components/production-plan/production-plan-schedule-modal'
import { useDashboardChrome } from '@/components/dashboard/dashboard-chrome'
import { useToast } from '@/components/ui/toast-provider'
import { addDaysYmd, todayYmdSeoul } from '@/lib/orders/utils'
import {
  addMonthsYmd,
  buildMonthGrid,
  formatMonthLabel,
  getMonthStartYmd,
  isWeekendYmd,
} from '@/lib/production-plan/calendar'
import {
  deleteProductionPlanEvent,
  fetchProductionPlanEvents,
  saveProductionPlanEvent,
  type FetchProductionPlanEventsResult,
  type ProductionPlanEvent,
} from '@/lib/production-plan/events'
import {
  PLAN_BADGE_GROUPS,
  PLAN_BADGE_GROUP_STYLE,
  PLAN_BADGE_META,
  isPlanEventKind,
} from '@/lib/production-plan/plan-badges'
import {
  confirmProductionPlanItem,
  fetchProductionPlanBoard,
  unconfirmProductionPlanItem,
} from '@/lib/production-plan/repository'
import type {
  ConfirmProductionPlanScheduleInput,
  FetchProductionPlanBoardResult,
  ProductionPlanBoardRow,
} from '@/lib/production-plan/types'
import { buildUnifiedPlanSheetLines } from '@/lib/production-plan/unified-plan-lines'
import { isProductionPlanScheduleRow } from '@/lib/production-plan/utils'

type ProductionPlanUnifiedWorkspaceProps = {
  initialResult: FetchProductionPlanBoardResult
  initialEvents: FetchProductionPlanEventsResult
  initialMonthStart: string
}

type ModalState =
  | { open: false }
  | {
      open: true
      row: ProductionPlanBoardRow
      initialValues: ProductionPlanScheduleFormValues
    }

type AssignModalState = { row: ProductionPlanBoardRow; seedDate: string } | null

const ALL_CUSTOMERS = ''

function ymdDiffDays(from: string, to: string) {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

function customerOf(row: { customer?: string | null }) {
  return String(row.customer || '').trim()
}

function overlaps(item: PlanCalendarItem, first: string, last: string) {
  return item.plannedDate <= last && (item.plannedEndDate || item.plannedDate) >= first
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
  initialEvents,
  initialMonthStart,
}: ProductionPlanUnifiedWorkspaceProps) {
  const [monthStart, setMonthStart] = useState(initialMonthStart)
  const [customer, setCustomer] = useState(ALL_CUSTOMERS)
  const [rows, setRows] = useState<ProductionPlanBoardRow[]>(
    initialResult.ok ? initialResult.data.rows : [],
  )
  const [events, setEvents] = useState<ProductionPlanEvent[]>(
    initialEvents.ok ? initialEvents.events : [],
  )
  const [eventsTableMissing, setEventsTableMissing] = useState(
    initialEvents.ok && initialEvents.tableMissing,
  )
  const [error, setError] = useState(
    !initialResult.ok ? initialResult.detail : !initialEvents.ok ? initialEvents.detail : '',
  )
  const [refreshing, setRefreshing] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalDeleting, setModalDeleting] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<ProductionPlanPickerTarget | null>(null)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [eventModal, setEventModal] = useState<ProductionPlanEvent | null>(null)
  const [moveSource, setMoveSource] = useState<PlanCalendarItem | null>(null)
  const [moveSaving, setMoveSaving] = useState(false)
  const [assignModal, setAssignModal] = useState<AssignModalState>(null)
  const [assignSaving, setAssignSaving] = useState(false)
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

  const allItems = useMemo(
    () => [
      ...rows
        .filter((row) => isProductionPlanScheduleRow(row) && row.plannedDate)
        .map(planItemFromBoardRow),
      ...events.map(planItemFromEvent),
    ],
    [rows, events],
  )

  const monthRange = useMemo(() => {
    const cells = buildMonthGrid(monthStart)
    return { first: cells[0]?.ymd ?? monthStart, last: cells[cells.length - 1]?.ymd ?? monthStart }
  }, [monthStart])

  const monthItems = useMemo(
    () => allItems.filter((item) => overlaps(item, monthRange.first, monthRange.last)),
    [allItems, monthRange],
  )

  const customerOptions = useMemo(() => {
    const planCounts = new Map<string, number>()
    for (const item of monthItems) {
      const name = customerOf(item)
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
  }, [monthItems, allOrderLines, customer])

  const orderLines = useMemo(
    () =>
      customer ? allOrderLines.filter((row) => customerOf(row) === customer) : allOrderLines,
    [allOrderLines, customer],
  )

  const visibleItems = useMemo(
    () => (customer ? monthItems.filter((item) => customerOf(item) === customer) : monthItems),
    [monthItems, customer],
  )

  const assignExistingItems = useMemo(() => {
    if (!assignModal) return []
    const { targetId, postTargetId } = assignModal.row
    return allItems.filter((item) => {
      if (item.event) return item.event.orderLineId === targetId
      const row = item.boardRow
      if (!row) return false
      return row.scope === 'post'
        ? Boolean(postTargetId) && row.targetId === postTargetId
        : row.targetId === targetId
    })
  }, [assignModal, allItems])

  const reload = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background ?? false
    if (background) setRefreshing(true)
    setError('')
    const [boardResult, eventsResult] = await Promise.all([
      fetchProductionPlanBoard(),
      fetchProductionPlanEvents(),
    ])
    if (background) setRefreshing(false)
    if (!boardResult.ok) {
      setError(boardResult.detail)
      return
    }
    setRows(boardResult.data.rows)
    if (!eventsResult.ok) {
      setError(eventsResult.detail)
      return
    }
    setEvents(eventsResult.events)
    setEventsTableMissing(eventsResult.tableMissing)
  }, [])

  function openScheduleModal(row: ProductionPlanBoardRow) {
    const seed = isProductionPlanScheduleRow(row) ? row.plannedDate.slice(0, 10) : todayYmdSeoul()
    setModal({
      open: true,
      row,
      initialValues: buildScheduleFormValues(row, seed, rows),
    })
  }

  function handleSelectItem(item: PlanCalendarItem) {
    if (item.event) setEventModal(item.event)
    else if (item.boardRow) openScheduleModal(item.boardRow)
  }

  function handleCellClick(plannedDate: string) {
    if (moveSource) {
      void handleMoveTo(plannedDate)
      return
    }
    setPickerTarget({ plannedDate })
  }

  function handlePickOrder(row: ProductionPlanBoardRow) {
    if (!pickerTarget) return
    const seedDate = pickerTarget.plannedDate
    setPickerTarget(null)
    setAssignModal({ row, seedDate })
  }

  function badgeToConfirmInput(
    row: ProductionPlanBoardRow,
    badge: PlanBadgeValues,
  ): ConfirmProductionPlanScheduleInput {
    const base = {
      orderId: row.orderId,
      plannedDate: badge.plannedDate,
      plannedEndDate: badge.plannedEndDate,
      planStatus: 'confirmed' as const,
      plannedQuantity: badge.plannedQuantity,
    }
    if (badge.kind === 'material_inbound') {
      return { ...base, scope: 'material', targetId: row.targetId }
    }
    if (badge.kind === 'post') {
      return { ...base, scope: 'post', targetId: row.postTargetId || '', team: badge.team }
    }
    return {
      ...base,
      scope: 'smt',
      targetId: row.targetId,
      lineNo: badge.lineNo,
      pcbSide: !row.splitPcbSides ? 'SINGLE' : badge.kind === 'smd_second' ? 'BOT' : 'TOP',
    }
  }

  async function handleAssignSubmit(badges: PlanBadgeValues[]) {
    if (!assignModal) return
    const row = assignModal.row
    setAssignSaving(true)
    const saved: string[] = []
    for (const badge of badges) {
      const label = PLAN_BADGE_META[badge.kind].short
      const result = isPlanEventKind(badge.kind)
        ? await saveProductionPlanEvent({
            kind: badge.kind,
            orderId: row.orderId,
            orderLineId: row.targetId,
            plannedDate: badge.plannedDate,
            plannedEndDate: badge.plannedEndDate,
            plannedQuantity: badge.plannedQuantity,
            orderNumber: row.orderNumber,
            customerPoNumber: row.customerPoNumber,
            customer: row.customer,
            productName: row.productName,
          })
        : await confirmProductionPlanItem(badgeToConfirmInput(row, badge))
      if (!result.ok) {
        setAssignSaving(false)
        toast.error(
          '배정 실패',
          `${saved.length ? `${saved.join('·')}은 저장됐지만 ` : ''}${label} 저장에 실패했습니다. ${result.detail}`,
        )
        await reload({ background: true })
        return
      }
      saved.push(label)
    }
    setAssignSaving(false)
    setAssignModal(null)
    toast.success('생산계획', `${saved.join('·')} 일정을 배정했습니다.`)
    await reload({ background: true })
  }

  async function handleMoveTo(plannedDate: string) {
    const item = moveSource
    if (!item || moveSaving) return
    if (plannedDate === item.plannedDate) {
      setMoveSource(null)
      return
    }
    const plannedEndDate = addDaysYmd(
      plannedDate,
      ymdDiffDays(item.plannedDate, item.plannedEndDate || item.plannedDate),
    )
    if (isWeekendYmd(plannedDate) || isWeekendYmd(plannedEndDate)) {
      toast.error('이동 불가', `종료일(${plannedEndDate})이 주말이 됩니다. 다른 날짜를 선택하세요.`)
      return
    }

    setMoveSaving(true)
    let result: { ok: true } | { ok: false; detail: string }
    if (item.event) {
      result = await saveProductionPlanEvent({
        ...item.event,
        plannedDate,
        plannedEndDate,
      })
    } else if (item.boardRow) {
      const row = item.boardRow
      result = await confirmProductionPlanItem({
        scope: row.scope,
        orderId: row.orderId,
        targetId: row.targetId,
        plannedDate,
        plannedEndDate,
        planStatus: 'confirmed',
        plannedQuantity: Math.max(1, Math.round(Number(row.plannedQuantity) || 1)),
        lineNo: row.scope === 'smt' ? (row.lineNo ?? 1) : undefined,
        pcbSide: row.scope === 'smt' ? (row.pcbSide ?? 'SINGLE') : undefined,
        team: row.scope === 'post' ? (row.team ?? '') : undefined,
        note: row.note ?? '',
        planId: row.planId,
        boardItemId: row.boardItemId,
      })
    } else {
      result = { ok: true }
    }
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

  async function handleEventSubmit(values: ProductionPlanEventValues) {
    if (!eventModal) return
    setModalSaving(true)
    const result = await saveProductionPlanEvent({ ...eventModal, ...values })
    setModalSaving(false)
    if (!result.ok) {
      toast.error('저장 실패', result.detail)
      return
    }
    setEventModal(null)
    toast.success('생산계획', '저장했습니다.')
    await reload({ background: true })
  }

  async function handleEventDelete() {
    if (!eventModal) return
    setModalDeleting(true)
    const result = await deleteProductionPlanEvent(eventModal.id)
    setModalDeleting(false)
    if (!result.ok) {
      toast.error('삭제 실패', result.detail)
      return
    }
    setEventModal(null)
    toast.success('생산계획', '일정을 삭제했습니다.')
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
                <option value={ALL_CUSTOMERS}>전체 ({monthItems.length})</option>
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
                onClick={() => setMonthStart(addMonthsYmd(monthStart, -1))}
                aria-label="이전 달"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-600 hover:bg-slate-50"
              >
                ‹
              </button>
              <p className="min-w-[8rem] px-1 text-center text-sm font-bold tabular-nums text-slate-900">
                {formatMonthLabel(monthStart)}
              </p>
              <button
                type="button"
                onClick={() => setMonthStart(addMonthsYmd(monthStart, 1))}
                aria-label="다음 달"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-600 hover:bg-slate-50"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setMonthStart(getMonthStartYmd(todayYmdSeoul()))}
                className="ml-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                이번 달
              </button>
              {refreshing ? (
                <span className="ml-1 text-xs text-slate-400">동기화 중…</span>
              ) : null}
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-500">
                {PLAN_BADGE_GROUPS.map(({ group, label }) => (
                  <span key={group} className="flex items-center gap-1">
                    <span className={`h-2.5 w-2.5 rounded-sm ${PLAN_BADGE_GROUP_STYLE[group].dot}`} aria-hidden />
                    {label}
                  </span>
                ))}
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

        {eventsTableMissing ? (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            입고예정·입고검사·출하 일정을 저장하려면 Supabase에서{' '}
            <code className="font-mono">migrate-production-plan-events.sql</code> 을 실행하세요.
          </div>
        ) : null}

        {moveSource ? (
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            <span className="font-semibold">
              {PLAN_BADGE_META[moveSource.kind].short} · {moveSource.productName || moveSource.orderLabel} 이동 중
            </span>
            <span className="text-xs text-amber-700">
              옮길 날짜를 클릭하세요. 다른 달로 넘겨서 옮길 수도 있습니다. (Esc 취소)
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

        <ProductionPlanMonthCalendar
          monthStart={monthStart}
          items={visibleItems}
          onCellClick={handleCellClick}
          onSelectItem={handleSelectItem}
          onStartMove={setMoveSource}
          movingKey={moveSource?.key ?? null}
        />
      </div>

      <ProductionPlanOrderPickerModal
        key={pickerTarget ? pickerTarget.plannedDate : 'closed'}
        target={pickerTarget}
        orderLines={orderLines}
        onClose={() => setPickerTarget(null)}
        onPick={handlePickOrder}
      />

      {assignModal ? (
        <ProductionPlanBadgeAssignModal
          key={`${assignModal.row.targetId}:${assignModal.seedDate}`}
          row={assignModal.row}
          seedDate={assignModal.seedDate}
          existingItems={assignExistingItems}
          saving={assignSaving}
          onClose={() => setAssignModal(null)}
          onSubmit={handleAssignSubmit}
        />
      ) : null}

      {eventModal ? (
        <ProductionPlanEventModal
          key={eventModal.id}
          event={eventModal}
          saving={modalSaving}
          deleting={modalDeleting}
          onClose={() => setEventModal(null)}
          onSubmit={handleEventSubmit}
          onDelete={handleEventDelete}
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
