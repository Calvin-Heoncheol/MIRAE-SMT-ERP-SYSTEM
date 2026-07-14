'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ProductionFetchError } from '@/components/production-input/production-fetch-error'
import { ProductionInputPanel } from '@/components/production-input/production-input-panel'
import { ProductionOrderSidebar } from '@/components/production-input/production-order-sidebar'
import { PostProcessTeamSwitcher } from '@/components/post-process/post-process-team-switcher'
import {
  buildDefaultSmtInputLineCards,
  SmtLineMachineCards,
} from '@/components/smt/smt-line-machine-cards'
import { buildPostProcessPlanProgressKey } from '@/lib/post-process/count-keys'
import type { PostProcessPlanBlock } from '@/lib/post-process/plan/types'
import { resolveSmtPlanExecutionStatus } from '@/lib/post-process/plan/utils'
import { DEFAULT_POST_PROCESS_TEAM, type PostProcessTeam } from '@/lib/post-process/teams'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { FetchProductionInputPageResult } from '@/lib/production-input/repository'
import type { ProductionInputConfig, ProductionOrderLine } from '@/lib/production-input/types'
import { filterProductionOrders } from '@/lib/production-input/utils'
import { buildSmtPlanProgressKey } from '@/lib/smt/count-keys'
import type { SmtPlanBlock } from '@/lib/smt/plan/types'
import {
  resolveSmtLinePlanExecutionStatus,
  resolveSmtPlanExecutionStatus as resolveSmtExec,
} from '@/lib/smt/plan/utils'

type ProductionInputWorkspaceProps = {
  result: FetchProductionInputPageResult
  config: ProductionInputConfig
  /** false면 등록 패널만 표시 (SMT·후공정 생산입력) */
  showOrderSidebar?: boolean
  initialUiKey?: string
  /** SMT 생산입력 — 오늘 라인별 계획 */
  todayPlans?: SmtPlanBlock[]
  /** 후공정 생산입력 — 오늘 계획 (라인 없음) */
  todayPostProcessPlans?: PostProcessPlanBlock[]
  /** 오늘 계획 대비 이미 등록한 수량 */
  initialPlanProgress?: Record<string, number>
}

function findOrderForSmtPlan(
  orders: ProductionOrderLine[],
  plan: SmtPlanBlock | undefined,
): ProductionOrderLine | null {
  if (!plan) return null
  if (plan.orderLineId) {
    return orders.find((order) => order.orderLineId === plan.orderLineId) ?? null
  }
  return orders.find((order) => order.orderId === plan.orderId) ?? null
}

function findOrderForPostProcessPlan(
  orders: ProductionOrderLine[],
  plan: PostProcessPlanBlock | undefined,
): ProductionOrderLine | null {
  if (!plan) return null
  return (
    orders.find(
      (order) =>
        order.assemblyGroupId === plan.assemblyGroupId ||
        order.orderLineId === plan.assemblyGroupId,
    ) ?? null
  )
}

function smtPlanProgressKey(plan: SmtPlanBlock, today: string = todayYmdSeoul()) {
  return buildSmtPlanProgressKey(plan.orderLineId, plan.pcbSide, plan.lineNo, today)
}

function postProcessPlanProgressKey(plan: PostProcessPlanBlock, today: string = todayYmdSeoul()) {
  return buildPostProcessPlanProgressKey(plan.assemblyGroupId, today, plan.team)
}

function formatSmtPlanChipLabel(plan: SmtPlanBlock) {
  const side = plan.pcbSide === 'TOP' || plan.pcbSide === 'BOT' ? plan.pcbSide : '단면'
  return `${plan.productSummary || plan.orderNumber} · ${side} · ${plan.plannedQuantity.toLocaleString('ko-KR')}대`
}

function planCardStatusClass(status: 'ready' | 'progress' | 'done') {
  if (status === 'done') return 'border-emerald-300 bg-emerald-50 ring-emerald-100'
  if (status === 'progress') return 'border-amber-300 bg-amber-50 ring-amber-100'
  return 'border-sky-200 bg-sky-50 ring-sky-100'
}

export function ProductionInputWorkspace({
  result,
  config,
  showOrderSidebar = true,
  initialUiKey = '',
  todayPlans = [],
  todayPostProcessPlans = [],
  initialPlanProgress = {},
}: ProductionInputWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedKey, setSelectedKey] = useState(initialUiKey)
  const [selectedLineNo, setSelectedLineNo] = useState<number | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<PostProcessTeam>(DEFAULT_POST_PROCESS_TEAM)
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    result.ok ? result.data.counts : {},
  )
  const [planProgress, setPlanProgress] = useState<Record<string, number>>(initialPlanProgress)

  const isPostProcess = config.productionModule === 'post_process'

  useEffect(() => {
    setSelectedKey(initialUiKey)
  }, [initialUiKey])

  const data = result.ok ? result.data : null
  const filtered = useMemo(
    () => filterProductionOrders(data?.orders ?? [], search),
    [data?.orders, search],
  )

  const plansByLine = useMemo(() => {
    const map = new Map<number, SmtPlanBlock[]>()
    for (const plan of todayPlans) {
      const list = map.get(plan.lineNo) ?? []
      list.push(plan)
      map.set(plan.lineNo, list)
    }
    return map
  }, [todayPlans])

  const lineCards = useMemo(() => {
    const today = todayYmdSeoul()
    const overrides: Partial<
      Record<
        number,
        {
          statusLabel: string
          jobLabel: string
          hasPlan: boolean
          planStatus: 'idle' | 'ready' | 'progress' | 'done'
        }
      >
    > = {}
    for (const [lineNo, plans] of plansByLine) {
      const first = plans[0]
      if (!first) continue
      const statuses = plans.map((plan) =>
        resolveSmtExec(plan.plannedQuantity, planProgress[smtPlanProgressKey(plan, today)] ?? 0),
      )
      const planStatus = resolveSmtLinePlanExecutionStatus(statuses)
      const statusLabel =
        planStatus === 'done'
          ? '완료'
          : planStatus === 'progress'
            ? '진행'
            : planStatus === 'ready'
              ? '예정'
              : '대기'
      const jobLabel =
        planStatus === 'done'
          ? '재배정 필요'
          : plans.length === 1
            ? [
                first.productSummary || first.orderNumber,
                first.pcbSide === 'TOP' || first.pcbSide === 'BOT' ? first.pcbSide : null,
                `${first.plannedQuantity.toLocaleString('ko-KR')}대`,
              ]
                .filter(Boolean)
                .join(' · ')
            : `${plans.length}건 계획`
      overrides[lineNo] = {
        statusLabel,
        jobLabel,
        hasPlan: true,
        planStatus,
      }
    }
    return buildDefaultSmtInputLineCards(overrides)
  }, [plansByLine, planProgress])

  useEffect(() => {
    if (isPostProcess || selectedLineNo != null) return
    const firstPlanned = lineCards.find((line) => line.hasPlan)
    if (firstPlanned) setSelectedLineNo(firstPlanned.lineNo)
  }, [lineCards, selectedLineNo, isPostProcess])

  const teamTodayPlans = useMemo(
    () => todayPostProcessPlans.filter((plan) => plan.team === selectedTeam),
    [todayPostProcessPlans, selectedTeam],
  )

  useEffect(() => {
    if (!isPostProcess || selectedPlanId || !teamTodayPlans.length) return
    setSelectedPlanId(teamTodayPlans[0]?.id ?? null)
  }, [isPostProcess, selectedPlanId, teamTodayPlans])

  const linePlans = selectedLineNo != null ? (plansByLine.get(selectedLineNo) ?? []) : []

  const selectedSmtPlan = useMemo(() => {
    if (isPostProcess || !linePlans.length) return undefined
    if (selectedPlanId) {
      return linePlans.find((plan) => plan.id === selectedPlanId) ?? linePlans[0]
    }
    return linePlans[0]
  }, [isPostProcess, linePlans, selectedPlanId])

  const selectedPostProcessPlan = useMemo(() => {
    if (!isPostProcess || !teamTodayPlans.length) return undefined
    if (selectedPlanId) {
      return teamTodayPlans.find((plan) => plan.id === selectedPlanId) ?? teamTodayPlans[0]
    }
    return teamTodayPlans[0]
  }, [isPostProcess, teamTodayPlans, selectedPlanId])

  useEffect(() => {
    if (isPostProcess) {
      if (!teamTodayPlans.length) {
        setSelectedPlanId(null)
        return
      }
      if (!selectedPlanId || !teamTodayPlans.some((plan) => plan.id === selectedPlanId)) {
        setSelectedPlanId(teamTodayPlans[0]?.id ?? null)
      }
      return
    }
    if (!linePlans.length) {
      setSelectedPlanId(null)
      return
    }
    if (!selectedPlanId || !linePlans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(linePlans[0]?.id ?? null)
    }
  }, [isPostProcess, linePlans, selectedPlanId, teamTodayPlans])

  const selectedOrder = useMemo(() => {
    const orders = data?.orders ?? []
    if (!showOrderSidebar) {
      if (isPostProcess) {
        return findOrderForPostProcessPlan(orders, selectedPostProcessPlan)
      }
      return findOrderForSmtPlan(orders, selectedSmtPlan)
    }
    if (selectedKey) {
      return (
        filtered.find((order) => order.uiKey === selectedKey) ??
        orders.find((order) => order.uiKey === selectedKey) ??
        null
      )
    }
    return isPostProcess
      ? findOrderForPostProcessPlan(orders, selectedPostProcessPlan)
      : findOrderForSmtPlan(orders, selectedSmtPlan)
  }, [
    data?.orders,
    filtered,
    selectedKey,
    selectedSmtPlan,
    selectedPostProcessPlan,
    showOrderSidebar,
    isPostProcess,
  ])

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleSelect(uiKey: string) {
    setSelectedKey(uiKey)
  }

  function handleSelectLine(lineNo: number) {
    setSelectedLineNo(lineNo)
    const plans = plansByLine.get(lineNo) ?? []
    const plan = plans[0]
    setSelectedPlanId(plan?.id ?? null)
    const order = findOrderForSmtPlan(data?.orders ?? [], plan)
    if (order) {
      setSelectedKey(order.uiKey)
    }
  }

  if (!result.ok) {
    return <ProductionFetchError result={result} config={config} />
  }

  if (!showOrderSidebar && isPostProcess) {
    const planProduced = selectedPostProcessPlan
      ? (planProgress[postProcessPlanProgressKey(selectedPostProcessPlan)] ?? 0)
      : 0

    return (
      <div className="flex h-[calc(100dvh-12.5rem)] min-h-[520px] w-full flex-col gap-4 overflow-hidden">
        <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">오늘 생산계획</h2>
              <p className="mt-0.5 text-xs text-slate-500">등록할 계획을 선택하세요</p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-500">
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
          </div>

          <PostProcessTeamSwitcher
            value={selectedTeam}
            onChange={(team) => {
              setSelectedTeam(team)
              setSelectedPlanId(null)
            }}
            className="mb-3"
          />

          {!teamTodayPlans.length ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              오늘 {selectedTeam}에 배정된 생산계획이 없습니다.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {teamTodayPlans.map((plan) => {
                const produced = planProgress[postProcessPlanProgressKey(plan)] ?? 0
                const status = resolveSmtPlanExecutionStatus(plan.plannedQuantity, produced)
                const active = plan.id === selectedPostProcessPlan?.id
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlanId(plan.id)
                      const order = findOrderForPostProcessPlan(data?.orders ?? [], plan)
                      if (order) setSelectedKey(order.uiKey)
                    }}
                    className={[
                      'rounded-xl border px-3 py-3 text-left shadow-sm ring-1 transition',
                      planCardStatusClass(status),
                      active ? 'ring-2 ring-sky-400' : 'hover:shadow',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-[11px] text-slate-500">
                        {plan.customer || '—'} · {plan.orderNumber}
                      </p>
                      <span className="shrink-0 rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                        {status === 'done' ? '완료' : status === 'progress' ? '진행' : '예정'}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-bold text-slate-900">
                      {plan.productSummary}
                    </p>
                    <p className="mt-1 text-xs font-semibold tabular-nums text-sky-800">
                      {produced.toLocaleString('ko-KR')}/
                      {plan.plannedQuantity.toLocaleString('ko-KR')}대
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md">
          {!selectedPostProcessPlan || !selectedOrder ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-base font-semibold text-slate-700">등록할 계획이 없습니다</p>
              <p className="max-w-md text-sm text-slate-500">
                오늘 {selectedTeam}에 배정된 생산계획이 없습니다. 생산계획에서 일정을 먼저 배치해
                주세요.
              </p>
              <Link
                href="/post-process/plan"
                className="mt-1 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                생산계획 열기
              </Link>
            </div>
          ) : (
            <ProductionInputPanel
              order={selectedOrder}
              counts={counts}
              config={config}
              plan={selectedPostProcessPlan}
              planProduced={planProduced}
              onCountUpdated={(countKey, cumulative) => {
                setCounts((current) => ({ ...current, [countKey]: cumulative }))
              }}
              onPlanProgressUpdated={(progressKey, produced) => {
                setPlanProgress((current) => ({ ...current, [progressKey]: produced }))
              }}
            />
          )}
        </div>
      </div>
    )
  }

  if (!showOrderSidebar) {
    const planProduced = selectedSmtPlan
      ? (planProgress[smtPlanProgressKey(selectedSmtPlan)] ?? 0)
      : 0

    return (
      <div className="flex h-[calc(100dvh-12.5rem)] min-h-[520px] w-full flex-col gap-4 overflow-hidden">
        <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">SMT 라인</h2>
              <p className="mt-0.5 text-xs text-slate-500">오늘 계획된 라인을 선택하세요</p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-500">
              <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700 ring-1 ring-sky-100">
                예정
              </span>
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800 ring-1 ring-amber-100">
                진행
              </span>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 ring-1 ring-emerald-100">
                완료 · 재배정
              </span>
            </div>
          </div>
          <SmtLineMachineCards
            lines={lineCards}
            selectedLineNo={selectedLineNo}
            onSelect={handleSelectLine}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md">
          {selectedLineNo == null ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-base font-semibold text-slate-700">라인을 선택하세요</p>
              <p className="text-sm text-slate-500">위 LINE 1~7 카드 중 작업 라인을 고릅니다.</p>
            </div>
          ) : !selectedSmtPlan || !selectedOrder ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-base font-semibold text-slate-700">
                LINE {selectedLineNo} · 등록할 계획이 없습니다
              </p>
              <p className="max-w-md text-sm text-slate-500">
                오늘 이 라인에 배정된 생산계획이 없습니다. 생산계획에서 일정을 먼저 배치해 주세요.
              </p>
              <Link
                href="/smt/plan"
                className="mt-1 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                생산계획 열기
              </Link>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              {linePlans.length > 1 ? (
                <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3">
                  {linePlans.map((plan) => {
                    const active = plan.id === selectedSmtPlan.id
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => {
                          setSelectedPlanId(plan.id)
                          const order = findOrderForSmtPlan(data?.orders ?? [], plan)
                          if (order) setSelectedKey(order.uiKey)
                        }}
                        className={[
                          'shrink-0 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition',
                          active
                            ? 'border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-200'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        {formatSmtPlanChipLabel(plan)}
                      </button>
                    )
                  })}
                </div>
              ) : null}
              <div className="min-h-0 flex-1 overflow-hidden">
                <ProductionInputPanel
                  order={selectedOrder}
                  counts={counts}
                  config={config}
                  lineNo={selectedLineNo}
                  plan={selectedSmtPlan}
                  planProduced={planProduced}
                  onCountUpdated={(countKey, cumulative) => {
                    setCounts((current) => ({ ...current, [countKey]: cumulative }))
                  }}
                  onPlanProgressUpdated={(progressKey, produced) => {
                    setPlanProgress((current) => ({ ...current, [progressKey]: produced }))
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid h-[calc(100dvh-12.5rem)] min-h-[480px] w-full grid-cols-1 grid-rows-[minmax(220px,42%)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] lg:grid-rows-none">
      <ProductionOrderSidebar
        orders={filtered}
        counts={counts}
        selectedKey={selectedKey}
        search={search}
        page={page}
        onSearchChange={handleSearchChange}
        onSelect={handleSelect}
        onPageChange={setPage}
      />
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <ProductionInputPanel
          order={selectedOrder}
          counts={counts}
          config={config}
          onCountUpdated={(countKey, cumulative) => {
            setCounts((current) => ({ ...current, [countKey]: cumulative }))
          }}
        />
      </div>
    </div>
  )
}
