'use client'

import { useCallback, useMemo, useState } from 'react'
import { PostProcessPlanCalendar } from '@/components/post-process/post-process-plan-calendar'
import { PostProcessPlanFetchError } from '@/components/post-process/post-process-plan-fetch-error'
import {
  PostProcessPlanFormModal,
  type PostProcessPlanFormValues,
} from '@/components/post-process/post-process-plan-form-modal'
import {
  filterPostProcessPlanOrderCandidates,
  PostProcessPlanOrderSidebar,
} from '@/components/post-process/post-process-plan-order-sidebar'
import { PostProcessTeamSwitcher } from '@/components/post-process/post-process-team-switcher'
import { addDaysYmd } from '@/lib/orders/utils'
import {
  deletePostProcessProductionPlan,
  fetchPostProcessPlanPageData,
  upsertPostProcessProductionPlan,
  type FetchPostProcessPlanPageResult,
} from '@/lib/post-process/plan/repository'
import type {
  PostProcessPlanBlock,
  PostProcessPlanOrderCandidate,
  PostProcessPlanPageData,
} from '@/lib/post-process/plan/types'
import { formatWeekRangeLabel, getWeekStartMondayYmd } from '@/lib/post-process/plan/utils'
import { DEFAULT_POST_PROCESS_TEAM, type PostProcessTeam } from '@/lib/post-process/teams'

type ModalState =
  | { open: false }
  | {
      open: true
      mode: 'create' | 'edit' | 'move'
      order: PostProcessPlanOrderCandidate | PostProcessPlanBlock
      initialValues: PostProcessPlanFormValues
      maxQuantity?: number
    }

type PostProcessPlanWorkspaceProps = {
  initialResult: FetchPostProcessPlanPageResult
  initialWeekStart: string
  initialTeam?: PostProcessTeam
}

export function PostProcessPlanWorkspace({
  initialResult,
  initialWeekStart,
  initialTeam = DEFAULT_POST_PROCESS_TEAM,
}: PostProcessPlanWorkspaceProps) {
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [selectedTeam, setSelectedTeam] = useState<PostProcessTeam>(initialTeam)
  const [data, setData] = useState<PostProcessPlanPageData | null>(
    initialResult.ok ? initialResult.data : null,
  )
  const [error, setError] = useState(initialResult.ok ? '' : initialResult.detail)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [statusMessage, setStatusMessage] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedKey, setSelectedKey] = useState('')

  const candidateByGroupId = useMemo(() => {
    const map = new Map<string, PostProcessPlanOrderCandidate>()
    for (const candidate of data?.planCandidates ?? []) {
      map.set(candidate.assemblyGroupId, candidate)
    }
    for (const plan of data?.plans ?? []) {
      if (!plan.assemblyGroupId || map.has(plan.assemblyGroupId)) continue
      map.set(plan.assemblyGroupId, {
        orderId: plan.orderId,
        assemblyGroupId: plan.assemblyGroupId,
        orderNumber: plan.orderNumber,
        customer: plan.customer,
        productSummary: plan.productSummary,
        deliveryDate: plan.deliveryDate,
        target: 0,
        produced: 0,
        remaining: 0,
        plannedTotal: 0,
        unplannedRemaining: 0,
        daysUntilDelivery: null,
      })
    }
    return map
  }, [data])

  const filteredCandidates = useMemo(() => {
    const unplanned = (data?.planCandidates ?? []).filter(
      (candidate) => candidate.unplannedRemaining > 0,
    )
    return filterPostProcessPlanOrderCandidates(unplanned, search)
  }, [data?.planCandidates, search])

  const teamPlans = useMemo(
    () => (data?.plans ?? []).filter((plan) => plan.team === selectedTeam),
    [data?.plans, selectedTeam],
  )

  const reload = useCallback(async (nextWeekStart: string) => {
    setLoading(true)
    setError('')
    const result = await fetchPostProcessPlanPageData(nextWeekStart)
    setLoading(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }
    setData(result.data)
  }, [])

  async function changeWeek(nextWeekStart: string) {
    setWeekStart(nextWeekStart)
    await reload(nextWeekStart)
  }

  function openCreateModal(order: PostProcessPlanOrderCandidate, plannedDate: string) {
    const existing = teamPlans.find(
      (item) =>
        item.assemblyGroupId === order.assemblyGroupId && item.plannedDate === plannedDate,
    )
    if (existing) {
      openEditModal(existing)
      return
    }
    if (order.unplannedRemaining <= 0) {
      setStatusMessage('이 제품은 미배정 잔량이 없어 계획에 추가할 수 없습니다.')
      return
    }
    const maxQuantity = order.unplannedRemaining
    setModal({
      open: true,
      mode: 'create',
      order,
      maxQuantity,
      initialValues: {
        orderId: order.orderId,
        assemblyGroupId: order.assemblyGroupId,
        plannedDate,
        team: selectedTeam,
        plannedQuantity: Math.max(1, maxQuantity),
        note: '',
      },
    })
  }

  function openEditModal(plan: PostProcessPlanBlock) {
    const candidate = candidateByGroupId.get(plan.assemblyGroupId)
    const maxQuantity = candidate
      ? candidate.unplannedRemaining + plan.plannedQuantity
      : undefined
    setModal({
      open: true,
      mode: 'edit',
      order: candidate ?? plan,
      maxQuantity,
      initialValues: {
        id: plan.id,
        orderId: plan.orderId,
        assemblyGroupId: plan.assemblyGroupId,
        plannedDate: plan.plannedDate,
        team: plan.team,
        plannedQuantity: plan.plannedQuantity,
        note: plan.note,
      },
    })
  }

  function openMoveModal(plan: PostProcessPlanBlock, plannedDate: string) {
    const candidate = candidateByGroupId.get(plan.assemblyGroupId)
    setModal({
      open: true,
      mode: 'move',
      order: candidate ?? plan,
      initialValues: {
        id: plan.id,
        orderId: plan.orderId,
        assemblyGroupId: plan.assemblyGroupId,
        plannedDate,
        team: plan.team,
        plannedQuantity: plan.plannedQuantity,
        note: plan.note,
      },
    })
  }

  async function handleDrop(
    payload:
      | { kind: 'order'; orderId: string; assemblyGroupId: string }
      | { kind: 'plan'; planId: string },
    target: { plannedDate: string },
  ) {
    if (payload.kind === 'order') {
      const order = candidateByGroupId.get(payload.assemblyGroupId)
      if (!order) {
        setStatusMessage('주문 정보를 찾을 수 없습니다.')
        return
      }
      openCreateModal(order, target.plannedDate)
      return
    }

    const plan = teamPlans.find((item) => item.id === payload.planId)
    if (!plan) return

    if (plan.plannedDate === target.plannedDate) {
      return
    }

    const occupied = teamPlans.some(
      (item) =>
        item.id !== plan.id &&
        item.assemblyGroupId === plan.assemblyGroupId &&
        item.plannedDate === target.plannedDate,
    )
    if (occupied) {
      setStatusMessage(`해당 일에 이미 ${selectedTeam}의 같은 제품 계획이 있습니다.`)
      return
    }

    openMoveModal(plan, target.plannedDate)
  }

  async function handleSubmit(values: PostProcessPlanFormValues) {
    setSaving(true)
    setStatusMessage('')
    const result = await upsertPostProcessProductionPlan({
      ...values,
      team: values.team || selectedTeam,
    })
    setSaving(false)

    if (!result.ok) {
      setStatusMessage(result.detail)
      return
    }

    setModal({ open: false })
    await reload(weekStart)
  }

  async function handleDelete(planId: string) {
    setDeleting(true)
    setStatusMessage('')
    const result = await deletePostProcessProductionPlan(planId)
    setDeleting(false)

    if (!result.ok) {
      setStatusMessage(result.detail)
      return
    }

    setModal({ open: false })
    await reload(weekStart)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  if (!initialResult.ok && !data) {
    return <PostProcessPlanFetchError result={initialResult} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-sm font-bold text-slate-900">{formatWeekRangeLabel(weekStart)}</p>
          <p className="text-xs text-slate-500">주간 후공정 생산계획</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 flex flex-wrap gap-1 text-[10px] font-semibold text-slate-500">
            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700 ring-1 ring-sky-100">
              예정
            </span>
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800 ring-1 ring-amber-100">
              진행
            </span>
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 ring-1 ring-emerald-100">
              완료
            </span>
          </div>
          <button
            type="button"
            onClick={() => changeWeek(addDaysYmd(weekStart, -7))}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            이전 주
          </button>
          <button
            type="button"
            onClick={() => changeWeek(getWeekStartMondayYmd())}
            disabled={loading}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            이번 주
          </button>
          <button
            type="button"
            onClick={() => changeWeek(addDaysYmd(weekStart, 7))}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            다음 주
          </button>
        </div>
      </div>

      {error ? (
        <PostProcessPlanFetchError result={{ ok: false, reason: 'query', detail: error }} />
      ) : null}
      {statusMessage ? (
        <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {statusMessage}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md lg:flex-row">
        <PostProcessPlanOrderSidebar
          candidates={filteredCandidates}
          selectedAssemblyGroupId={selectedKey}
          search={search}
          page={page}
          onSearchChange={handleSearchChange}
          onSelect={setSelectedKey}
          onPageChange={setPage}
          onDragCandidate={() => setStatusMessage('')}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3">
          <PostProcessTeamSwitcher
            value={selectedTeam}
            onChange={setSelectedTeam}
            className="mb-3 shrink-0"
          />
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              불러오는 중…
            </div>
          ) : (
            <PostProcessPlanCalendar
              weekDates={data?.weekDates ?? []}
              plans={teamPlans}
              planProgress={data?.planProgress ?? {}}
              onDrop={handleDrop}
              onPlanClick={openEditModal}
              onDragPlan={() => setStatusMessage('')}
            />
          )}
        </div>
      </div>

      <PostProcessPlanFormModal
        open={modal.open}
        title={
          modal.open
            ? modal.mode === 'edit'
              ? '생산계획 수정'
              : modal.mode === 'move'
                ? '생산계획 이동'
                : '생산계획 등록'
            : ''
        }
        order={modal.open ? modal.order : null}
        initialValues={
          modal.open
            ? modal.initialValues
            : {
                orderId: '',
                assemblyGroupId: '',
                plannedDate: '',
                team: selectedTeam,
                plannedQuantity: 1,
                note: '',
              }
        }
        maxQuantity={modal.open ? modal.maxQuantity : undefined}
        saving={saving}
        deleting={deleting}
        onClose={() => setModal({ open: false })}
        onSubmit={handleSubmit}
        onDelete={
          modal.open && modal.mode !== 'create' && modal.initialValues.id
            ? () => handleDelete(modal.initialValues.id!)
            : undefined
        }
      />
    </div>
  )
}
