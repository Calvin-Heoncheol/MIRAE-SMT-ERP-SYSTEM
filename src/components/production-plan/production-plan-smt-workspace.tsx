'use client'

import { useCallback, useMemo, useState } from 'react'
import { ProductionPlanFetchError } from '@/components/production-plan/production-plan-fetch-error'
import { ProductionPlanMonthCalendar } from '@/components/production-plan/production-plan-month-calendar'
import {
  buildScheduleFormValues,
  ProductionPlanScheduleModal,
  type ProductionPlanScheduleFormValues,
} from '@/components/production-plan/production-plan-schedule-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { FilterChipBar } from '@/components/ui/filter-chip'
import { formatInternalCodeLabel, todayYmdSeoul } from '@/lib/orders/utils'
import {
  addMonthsYmd,
  buildMonthGrid,
  formatMonthLabel,
  getMonthStartYmd,
  isYmdInMonth,
} from '@/lib/production-plan/calendar'
import {
  confirmProductionPlanItem,
  fetchProductionPlanBoard,
  unconfirmProductionPlanItem,
} from '@/lib/production-plan/repository'
import {
  buildSmtPlanLineGroups,
  filterSmtPlanLineGroups,
  progressRatio,
  searchSmtPlanLineGroups,
  type SmtPlanLineFilter,
  type SmtPlanLineGroup,
} from '@/lib/production-plan/smt-plan-lines'
import type { FetchProductionPlanBoardResult, ProductionPlanBoardRow } from '@/lib/production-plan/types'
import {
  deliveryUrgencyClass,
  formatDeliveryCountdown,
  isProductionPlanScheduleRow,
} from '@/lib/production-plan/utils'

type ProductionPlanSmtWorkspaceProps = {
  initialResult: FetchProductionPlanBoardResult
  initialMonthStart: string
}

type PanelMode = 'list' | 'calendar'

type ModalState =
  | { open: false }
  | {
      open: true
      row: ProductionPlanBoardRow
      initialValues: ProductionPlanScheduleFormValues
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
  lineNo: null,
  team: '',
  pcbSide: 'SINGLE',
  plannedQuantity: null,
}

function scheduleChipLabel(row: ProductionPlanBoardRow) {
  const date = row.plannedDate.slice(0, 10) || '-'
  const qty = row.plannedQuantity?.toLocaleString('ko-KR') ?? '-'
  const line = row.lineNo ? ` · L${row.lineNo}` : ''
  return `${date} · ${qty}${line}`
}

function materialChipLabel(row: ProductionPlanBoardRow) {
  const date = row.plannedDate.slice(0, 10) || '-'
  const qty = row.plannedQuantity?.toLocaleString('ko-KR') ?? '-'
  return `입고 ${date} · ${qty}`
}

function Metric({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
        {value.toLocaleString('ko-KR')}
        <span className="ml-1 text-xs font-medium text-slate-400">
          / {total.toLocaleString('ko-KR')}
        </span>
      </p>
    </div>
  )
}

function ProgressBar({ value, total, tone }: { value: number; total: number; tone: 'amber' | 'sky' }) {
  const ratio = progressRatio(value, total)
  const bar = tone === 'amber' ? 'bg-amber-500' : 'bg-sky-500'
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full ${bar}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  )
}

function SmtPlanLineCard({
  group,
  onQuickPlan,
  onEditSchedule,
  onAddMaterial,
  onEditMaterial,
}: {
  group: SmtPlanLineGroup
  onQuickPlan: (group: SmtPlanLineGroup) => void
  onEditSchedule: (row: ProductionPlanBoardRow) => void
  onAddMaterial: (group: SmtPlanLineGroup) => void
  onEditMaterial: (row: ProductionPlanBoardRow) => void
}) {
  const countdown = formatDeliveryCountdown(group.daysUntilDelivery)
  const orderCap = Math.max(group.remainingQty, group.orderQty, 1)
  const materialCap = group.materialShort
    ? Math.max(group.materialReadyQty, 1)
    : orderCap

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-500">
            {formatInternalCodeLabel(group.orderNumber)}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-bold text-slate-900">{group.productName}</h3>
          <p className="text-xs text-slate-600">
            {group.customer}
            {group.productCode ? ` · ${group.productCode}` : ''}
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="text-slate-600">납기 {group.deliveryDate || '—'}</p>
          {countdown ? (
            <p className={`mt-0.5 tabular-nums ${deliveryUrgencyClass(group.daysUntilDelivery)}`}>
              {countdown}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Metric label="주문 잔량" value={group.remainingQty} total={orderCap} />
        <Metric label="입고(가용)" value={group.materialReadyQty} total={orderCap} />
        <Metric label="SMT 계획" value={group.plannedTotal} total={orderCap} />
      </div>

      <div className="mb-3 space-y-1.5">
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
            <span>{group.materialLabel}</span>
            <span className="tabular-nums">
              {group.materialReadyQty.toLocaleString('ko-KR')} / {orderCap.toLocaleString('ko-KR')}
            </span>
          </div>
          <ProgressBar value={group.materialReadyQty} total={materialCap} tone="amber" />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
            <span>SMT 계획</span>
            <span className="tabular-nums">
              {group.plannedTotal.toLocaleString('ko-KR')} / {orderCap.toLocaleString('ko-KR')}
            </span>
          </div>
          <ProgressBar value={group.plannedTotal} total={orderCap} tone="sky" />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {group.materialSchedules.map((schedule) => (
          <button
            key={schedule.key}
            type="button"
            onClick={() => onEditMaterial(schedule)}
            className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
          >
            {materialChipLabel(schedule)}
          </button>
        ))}
        {group.materialUnplannedQty > 0 ? (
          <button
            type="button"
            onClick={() => onAddMaterial(group)}
            className="rounded-full border border-dashed border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-50"
          >
            + 입고 입력
          </button>
        ) : group.materialReadyQty <= 0 ? (
          <ErpButton type="button" variant="secondary" onClick={() => onAddMaterial(group)}>
            입고 입력
          </ErpButton>
        ) : null}
      </div>

      {group.schedules.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {group.schedules.map((schedule) => (
            <button
              key={schedule.key}
              type="button"
              onClick={() => onEditSchedule(schedule)}
              className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-900 hover:bg-sky-100"
            >
              {scheduleChipLabel(schedule)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {group.canPlan ? (
          <>
            <ErpButton type="button" onClick={() => onQuickPlan(group)}>
              {group.availableQty.toLocaleString('ko-KR')}대 SMT 잡기
            </ErpButton>
            {group.unplannedQty > group.availableQty ? (
              <span className="text-xs text-slate-500">
                입고 {group.materialReadyQty.toLocaleString('ko-KR')}대분 · 잔여{' '}
                {group.unplannedQty.toLocaleString('ko-KR')}대
              </span>
            ) : null}
          </>
        ) : group.smtComplete ? (
          <span className="text-xs font-semibold text-emerald-700">SMT 계획 완료</span>
        ) : group.blockReason ? (
          <span className="text-xs font-medium text-slate-500">{group.blockReason}</span>
        ) : (
          <span className="text-xs text-slate-400">배정 대기</span>
        )}
      </div>
    </article>
  )
}

export function ProductionPlanSmtWorkspace({
  initialResult,
  initialMonthStart,
}: ProductionPlanSmtWorkspaceProps) {
  const [panelMode, setPanelMode] = useState<PanelMode>('list')
  const [lineFilter, setLineFilter] = useState<SmtPlanLineFilter>('now')
  const [monthStart, setMonthStart] = useState(initialMonthStart)
  const [rows, setRows] = useState<ProductionPlanBoardRow[]>(
    initialResult.ok ? initialResult.data.rows : [],
  )
  const [error, setError] = useState(initialResult.ok ? '' : initialResult.detail)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })

  const lineGroups = useMemo(() => buildSmtPlanLineGroups(rows), [rows])
  const filteredGroups = useMemo(() => {
    return searchSmtPlanLineGroups(filterSmtPlanLineGroups(lineGroups, lineFilter), search)
  }, [lineFilter, lineGroups, search])

  const scheduledSmtRows = useMemo(() => {
    return rows.filter(
      (row) =>
        row.scope === 'smt' &&
        row.status === 'confirmed' &&
        isYmdInMonth(row.plannedDate, monthStart),
    )
  }, [rows, monthStart])

  const monthCells = useMemo(() => buildMonthGrid(monthStart), [monthStart])

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await fetchProductionPlanBoard()
    setLoading(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }
    setRows(result.data.rows)
  }, [])

  function openScheduleModal(
    row: ProductionPlanBoardRow,
    overrides?: Partial<ProductionPlanScheduleFormValues>,
  ) {
    const dateSeed = isProductionPlanScheduleRow(row)
      ? row.plannedDate.slice(0, 10)
      : todayYmdSeoul()
    const initialValues = {
      ...buildScheduleFormValues(row, dateSeed),
      ...overrides,
    }
    setModal({ open: true, row, initialValues })
  }

  function openQuickPlan(group: SmtPlanLineGroup) {
    openScheduleModal(group.planRow, {
      plannedDate: todayYmdSeoul(),
      plannedQuantity: Math.max(1, group.availableQty),
    })
  }

  function materialRowForGroup(group: SmtPlanLineGroup): ProductionPlanBoardRow {
    if (group.materialPlanRow) return group.materialPlanRow
    return {
      ...group.planRow,
      scope: 'material',
      key: `material:${group.targetId}`,
      status: 'waiting',
      rowKind: 'remainder',
      plannedDate: '',
      plannedQuantity: null,
      lineNo: null,
      team: '',
      pcbSide: 'SINGLE',
      plannedTotalQty: 0,
      unplannedQty: group.remainingQty,
    }
  }

  function openMaterialEntry(group: SmtPlanLineGroup) {
    const row = materialRowForGroup(group)
    openScheduleModal(row, {
      plannedDate: todayYmdSeoul(),
      plannedQuantity: Math.max(1, group.materialUnplannedQty || group.remainingQty),
      lineNo: 1,
    })
  }

  function openMaterialEdit(row: ProductionPlanBoardRow) {
    openScheduleModal(row)
  }

  async function handleModalSubmit(values: ProductionPlanScheduleFormValues) {
    if (!modal.open) return
    const row = modal.row

    setSaving(true)
    setStatusMessage('')
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
    setSaving(false)

    if (!result.ok) {
      setStatusMessage(result.detail)
      return
    }

    setModal({ open: false })
    setStatusMessage(
      row.scope === 'material' ? '자재 입고를 저장했습니다.' : 'SMT 생산계획을 저장했습니다.',
    )
    await reload()
  }

  async function handleModalDelete() {
    if (!modal.open) return
    const row = modal.row

    setDeleting(true)
    setStatusMessage('')
    const result = await unconfirmProductionPlanItem({
      scope: row.scope,
      targetId: row.targetId,
      planId: row.planId,
      boardItemId: row.boardItemId,
    })
    setDeleting(false)

    if (!result.ok) {
      setStatusMessage(result.detail)
      return
    }

    setModal({ open: false })
    setStatusMessage(
      row.scope === 'material' ? '자재 입고 기록을 삭제했습니다.' : 'SMT 계획을 삭제했습니다.',
    )
    await reload()
  }

  const filterChips = [
    {
      value: 'now' as const,
      label: '지금 잡기',
      count: filterSmtPlanLineGroups(lineGroups, 'now').length,
    },
    { value: 'all' as const, label: '전체', count: lineGroups.length },
  ]

  if (!initialResult.ok && !rows.length) {
    return <ProductionPlanFetchError result={initialResult} />
  }

  return (
    <>
      {error ? <ProductionPlanFetchError result={{ ok: false, reason: 'query', detail: error }} /> : null}
      {statusMessage ? (
        <div className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {statusMessage}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">SMT 생산계획</h2>
            <p className="text-xs text-slate-500">
              자재팀이 입고일·수량을 입력하면, 그만큼 SMT 일정을 잡을 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
              <button
                type="button"
                onClick={() => setPanelMode('list')}
                className={`px-3 py-1.5 text-sm font-semibold ${
                  panelMode === 'list' ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                목록
              </button>
              <button
                type="button"
                onClick={() => setPanelMode('calendar')}
                className={`border-l border-slate-300 px-3 py-1.5 text-sm font-semibold ${
                  panelMode === 'calendar'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                주간 캘린더
              </button>
            </div>
            {panelMode === 'calendar' ? (
              <>
                <span className="text-sm font-bold text-slate-800">{formatMonthLabel(monthStart)}</span>
                <button
                  type="button"
                  onClick={() => setMonthStart(addMonthsYmd(monthStart, -1))}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  이전
                </button>
                <button
                  type="button"
                  onClick={() => setMonthStart(getMonthStartYmd(todayYmdSeoul()))}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  이번 달
                </button>
                <button
                  type="button"
                  onClick={() => setMonthStart(addMonthsYmd(monthStart, 1))}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  다음
                </button>
              </>
            ) : null}
            <ErpButton type="button" variant="secondary" onClick={() => reload()} disabled={loading}>
              {loading ? '새로고침…' : '새로고침'}
            </ErpButton>
          </div>
        </div>

        {panelMode === 'list' ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2.5">
              <FilterChipBar options={filterChips} value={lineFilter} onChange={setLineFilter} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="발주번호, 고객사, 제품명 검색…"
                className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  불러오는 중…
                </div>
              ) : !filteredGroups.length ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  {search.trim()
                    ? '검색 결과 없음'
                    : lineFilter === 'now'
                      ? '지금 SMT를 잡을 발주가 없습니다'
                      : '표시할 발주가 없습니다'}
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {filteredGroups.map((group) => (
                    <SmtPlanLineCard
                      key={group.targetId}
                      group={group}
                      onQuickPlan={openQuickPlan}
                      onEditSchedule={(row) => openScheduleModal(row)}
                      onAddMaterial={openMaterialEntry}
                      onEditMaterial={openMaterialEdit}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <ProductionPlanMonthCalendar
            cells={monthCells}
            scheduledRows={scheduledSmtRows}
            onSelectRow={(row) => openScheduleModal(row)}
          />
        )}
      </div>

      <ProductionPlanScheduleModal
        open={modal.open}
        row={modal.open ? modal.row : null}
        allRows={rows}
        initialValues={
          modal.open ? modal.initialValues : buildScheduleFormValues(EMPTY_ROW, todayYmdSeoul())
        }
        saving={saving}
        deleting={deleting}
        onClose={() => setModal({ open: false })}
        onSubmit={handleModalSubmit}
        onUnassign={modal.open && isProductionPlanScheduleRow(modal.row) ? handleModalDelete : undefined}
      />
    </>
  )
}
