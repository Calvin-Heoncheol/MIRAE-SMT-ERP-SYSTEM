'use client'

import { useEffect, useMemo, useState } from 'react'
import { ProductionFetchError } from '@/components/production-input/production-fetch-error'
import { ProductionInputModal } from '@/components/production-input/production-input-modal'
import { ProductionInputPanel } from '@/components/production-input/production-input-panel'
import { ProductionInputTable } from '@/components/production-input/production-input-table'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { buildPostProcessPlanProgressKey } from '@/lib/post-process/count-keys'
import type { PostProcessPlanBlock } from '@/lib/post-process/plan/types'
import { DEFAULT_POST_PROCESS_TEAM, type PostProcessTeam } from '@/lib/post-process/teams'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { FetchProductionInputPageResult } from '@/lib/production-input/repository'
import type {
  ProductionInputConfig,
  ProductionOrderLine,
  ProductionOrderState,
} from '@/lib/production-input/types'
import {
  filterProductionOrders,
  getProductionOrderState,
} from '@/lib/production-input/utils'
import { formatEmptyListMessage } from '@/lib/ui/tokens'
import { buildSmtPlanProgressKey } from '@/lib/smt/count-keys'
import type { SmtPlanBlock } from '@/lib/smt/plan/types'
import type { SmtPcbSide } from '@/lib/smt/types'

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
  /** 후공정 — 내비(생산2/3/4)에서 URL로 결정되는 팀 */
  postProcessTeam?: PostProcessTeam
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

type ProductionStatusFilter = 'all' | ProductionOrderState

function countProductionOrderStates(
  orders: ProductionOrderLine[],
  counts: Record<string, number>,
) {
  let none = 0
  let progress = 0
  let full = 0
  for (const order of orders) {
    const state = getProductionOrderState(order, counts)
    if (state === 'none') none += 1
    else if (state === 'progress') progress += 1
    else full += 1
  }
  return { all: orders.length, none, progress, full }
}

export function ProductionInputWorkspace({
  result,
  config,
  showOrderSidebar = true,
  initialUiKey = '',
  todayPlans = [],
  todayPostProcessPlans = [],
  initialPlanProgress = {},
  postProcessTeam = DEFAULT_POST_PROCESS_TEAM,
}: ProductionInputWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState(initialUiKey)
  const [selectedLineNo, setSelectedLineNo] = useState<number | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const selectedTeam = postProcessTeam
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    result.ok ? result.data.counts : {},
  )
  const [defectCounts, setDefectCounts] = useState<Record<string, number>>(() =>
    result.ok ? result.data.defectCounts : {},
  )
  const [planProgress, setPlanProgress] = useState<Record<string, number>>(initialPlanProgress)
  const [statusFilter, setStatusFilter] = useState<ProductionStatusFilter>('all')
  const [inputOpen, setInputOpen] = useState(false)
  const [initialPcbSide, setInitialPcbSide] = useState<SmtPcbSide | null>(null)

  const isPostProcess = config.productionModule === 'post_process'

  useEffect(() => {
    setSelectedKey(initialUiKey)
    if (initialUiKey) setInputOpen(true)
  }, [initialUiKey])

  const data = result.ok ? result.data : null
  const searched = useMemo(
    () => filterProductionOrders(data?.orders ?? [], search),
    [data?.orders, search],
  )

  const statusCounts = useMemo(
    () => countProductionOrderStates(searched, counts),
    [searched, counts],
  )

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return searched
    return searched.filter((order) => getProductionOrderState(order, counts) === statusFilter)
  }, [searched, counts, statusFilter])

  const plansByLine = useMemo(() => {
    const map = new Map<number, SmtPlanBlock[]>()
    for (const plan of todayPlans) {
      const list = map.get(plan.lineNo) ?? []
      list.push(plan)
      map.set(plan.lineNo, list)
    }
    return map
  }, [todayPlans])

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
    if (showOrderSidebar) {
      if (!selectedKey) return null
      return (
        searched.find((order) => order.uiKey === selectedKey) ??
        orders.find((order) => order.uiKey === selectedKey) ??
        null
      )
    }
    if (isPostProcess) {
      return findOrderForPostProcessPlan(orders, selectedPostProcessPlan)
    }
    return findOrderForSmtPlan(orders, selectedSmtPlan)
  }, [
    data?.orders,
    filtered,
    selectedKey,
    selectedSmtPlan,
    selectedPostProcessPlan,
    showOrderSidebar,
    isPostProcess,
  ])

  function handleSelectLine(lineNo: number | null) {
    setSelectedLineNo(lineNo)
    if (showOrderSidebar) return
    if (lineNo == null) {
      setSelectedPlanId(null)
      setSelectedKey('')
      return
    }
    const plans = plansByLine.get(lineNo) ?? []
    const plan = plans[0]
    setSelectedPlanId(plan?.id ?? null)
    const order = findOrderForSmtPlan(data?.orders ?? [], plan)
    if (order) {
      setSelectedKey(order.uiKey)
    } else {
      setSelectedKey('')
    }
  }

  function handleOrderClick(order: ProductionOrderLine, side?: 'TOP' | 'BOT') {
    setSelectedKey(order.uiKey)
    setInitialPcbSide(side ?? null)
    setInputOpen(true)
  }

  function closeInputModal() {
    setInputOpen(false)
    setInitialPcbSide(null)
  }

  if (!result.ok) {
    return <ProductionFetchError result={result} config={config} />
  }

  /**
   * 생산입력 전용 풀하이트 셸.
   * main 패딩·상단 위치 표기와 좌우를 맞추기 위해 음수 마진으로 풀블리드하지 않음.
   */
  const flushShellClass =
    'flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white'

  if (!showOrderSidebar && isPostProcess) {
    const planProduced = selectedPostProcessPlan
      ? (planProgress[postProcessPlanProgressKey(selectedPostProcessPlan)] ?? 0)
      : 0

    return (
      <div className={flushShellClass}>
        <ProductionInputPanel
          order={selectedOrder}
          counts={counts}
          defectCounts={defectCounts}
          config={config}
          showPostProcessPlanSelector
          postProcessTeam={selectedTeam}
          postProcessPlans={teamTodayPlans}
          selectedPlanId={selectedPostProcessPlan?.id ?? null}
          onSelectPlan={(planId) => {
            setSelectedPlanId(planId)
            const plan = teamTodayPlans.find((item) => item.id === planId)
            const matchedOrder = findOrderForPostProcessPlan(data?.orders ?? [], plan)
            if (matchedOrder) setSelectedKey(matchedOrder.uiKey)
          }}
          plan={selectedPostProcessPlan ?? null}
          planProduced={planProduced}
          planSetupHref={`/post-process/plan?team=${encodeURIComponent(selectedTeam)}`}
          onCountUpdated={(countKey, cumulative, defectCumulative) => {
            setCounts((current) => ({ ...current, [countKey]: cumulative }))
            if (defectCumulative != null) {
              setDefectCounts((current) => ({ ...current, [countKey]: defectCumulative }))
            }
          }}
          onPlanProgressUpdated={(progressKey, produced) => {
            setPlanProgress((current) => ({ ...current, [progressKey]: produced }))
          }}
        />
      </div>
    )
  }

  if (!showOrderSidebar) {
    const planProduced = selectedSmtPlan
      ? (planProgress[smtPlanProgressKey(selectedSmtPlan)] ?? 0)
      : 0

    return (
      <div className={flushShellClass}>
        <ProductionInputPanel
          order={selectedOrder}
          counts={counts}
          defectCounts={defectCounts}
          config={config}
          showLineSelector
          lineNo={selectedLineNo}
          onLineNoChange={handleSelectLine}
          smtLinePlans={linePlans}
          selectedPlanId={selectedSmtPlan?.id ?? null}
          onSelectPlan={(planId) => {
            setSelectedPlanId(planId)
            const plan = linePlans.find((item) => item.id === planId)
            const matchedOrder = findOrderForSmtPlan(data?.orders ?? [], plan)
            if (matchedOrder) setSelectedKey(matchedOrder.uiKey)
          }}
          plan={selectedSmtPlan ?? null}
          planProduced={planProduced}
          planSetupHref="/smt/plan"
          onCountUpdated={(countKey, cumulative, defectCumulative) => {
            setCounts((current) => ({ ...current, [countKey]: cumulative }))
            if (defectCumulative != null) {
              setDefectCounts((current) => ({ ...current, [countKey]: defectCumulative }))
            }
          }}
          onPlanProgressUpdated={(progressKey, produced) => {
            setPlanProgress((current) => ({ ...current, [progressKey]: produced }))
          }}
        />
      </div>
    )
  }

  if (showOrderSidebar) {
    const statusChips = [
      { value: 'all' as const, label: '전체', count: statusCounts.all },
      {
        value: 'none' as const,
        label: '대기',
        count: statusCounts.none,
        tone: STATUS_FILTER_TONES.waiting,
      },
      {
        value: 'progress' as const,
        label: '진행',
        count: statusCounts.progress,
        tone: STATUS_FILTER_TONES.progress,
      },
      {
        value: 'full' as const,
        label: '완료',
        count: statusCounts.full,
        tone: STATUS_FILTER_TONES.done,
      },
    ]

    return (
      <>
        <div className={`${flushShellClass} gap-3 p-3 sm:p-4`}>
          <WorkspaceHeader
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="발주번호, 품목코드, 품목명, 고객사 검색…"
            accent={isPostProcess ? 'emerald' : 'sky'}
            filters={
              <FilterChipBar
                options={statusChips}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            }
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ProductionInputTable
              orders={filtered}
              counts={counts}
              defectCounts={defectCounts}
              config={config}
              onOrderClick={handleOrderClick}
              emptyMessage={formatEmptyListMessage({
                hasQuery: Boolean(search.trim()) || statusFilter !== 'all',
                emptyLabel: '표시할 발주가 없습니다',
                actionHint: '발주를 선택하면 생산 등록 모달이 열립니다',
              })}
            />
          </div>
        </div>

        <ProductionInputModal
          open={inputOpen}
          order={selectedOrder}
          counts={counts}
          defectCounts={defectCounts}
          config={config}
          onClose={closeInputModal}
          showLineSelector={!isPostProcess}
          lineNo={!isPostProcess ? selectedLineNo : null}
          onLineNoChange={!isPostProcess ? handleSelectLine : undefined}
          postProcessTeam={isPostProcess ? selectedTeam : undefined}
          initialPcbSide={initialPcbSide}
          onCountUpdated={(countKey, cumulative, defectCumulative) => {
            setCounts((current) => ({ ...current, [countKey]: cumulative }))
            if (defectCumulative != null) {
              setDefectCounts((current) => ({ ...current, [countKey]: defectCumulative }))
            }
          }}
        />
      </>
    )
  }

  return null
}
