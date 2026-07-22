'use client'

import { useEffect, useMemo, useState } from 'react'
import { ProductionFetchError } from '@/components/production-input/production-fetch-error'
import { ProductionInputPanel } from '@/components/production-input/production-input-panel'
import { ProductionOrderSidebar } from '@/components/production-input/production-order-sidebar'
import { buildPostProcessPlanProgressKey } from '@/lib/post-process/count-keys'
import type { PostProcessPlanBlock } from '@/lib/post-process/plan/types'
import { DEFAULT_POST_PROCESS_TEAM, type PostProcessTeam } from '@/lib/post-process/teams'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { FetchProductionInputPageResult } from '@/lib/production-input/repository'
import type { ProductionInputConfig, ProductionOrderLine } from '@/lib/production-input/types'
import { filterProductionOrders } from '@/lib/production-input/utils'
import { buildSmtPlanProgressKey } from '@/lib/smt/count-keys'
import type { SmtPlanBlock } from '@/lib/smt/plan/types'

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
        filtered.find((order) => order.uiKey === selectedKey) ??
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

  function handleSearchChange(value: string) {
    setSearch(value)
  }

  function handleSelect(uiKey: string) {
    setSelectedKey(uiKey)
  }

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

  if (!result.ok) {
    return <ProductionFetchError result={result} config={config} />
  }

  /**
   * 탭 아래·main 패딩을 상쇄해 내비 오른쪽을 풀블리드 split처럼 씀 (생산입력 전용).
   * min-h-0 + flex-1 + overflow-hidden 으로 카드 0높이·스크롤 체인 깨짐 방지.
   */
  const flushShellClass =
    'flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-slate-200 bg-white -mx-4 -mb-4 -mt-4 lg:-mx-6 lg:-mb-5'

  if (!showOrderSidebar && isPostProcess) {
    const planProduced = selectedPostProcessPlan
      ? (planProgress[postProcessPlanProgressKey(selectedPostProcessPlan)] ?? 0)
      : 0

    return (
      <div className={flushShellClass}>
        <ProductionInputPanel
          order={selectedOrder}
          counts={counts}
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
          onCountUpdated={(countKey, cumulative) => {
            setCounts((current) => ({ ...current, [countKey]: cumulative }))
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
          onCountUpdated={(countKey, cumulative) => {
            setCounts((current) => ({ ...current, [countKey]: cumulative }))
          }}
          onPlanProgressUpdated={(progressKey, produced) => {
            setPlanProgress((current) => ({ ...current, [progressKey]: produced }))
          }}
        />
      </div>
    )
  }

  return (
    <div className={`${flushShellClass} lg:flex-row`}>
      <ProductionOrderSidebar
        orders={filtered}
        counts={counts}
        selectedKey={selectedKey}
        search={search}
        onSearchChange={handleSearchChange}
        onSelect={handleSelect}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-slate-200 bg-slate-100 lg:border-t-0">
        <ProductionInputPanel
          order={selectedOrder}
          counts={counts}
          config={config}
          showLineSelector={!isPostProcess}
          lineNo={!isPostProcess ? selectedLineNo : null}
          onLineNoChange={!isPostProcess ? handleSelectLine : undefined}
          postProcessTeam={isPostProcess ? selectedTeam : undefined}
          emptyPlanHint={selectedKey ? undefined : '주문서를 선택하세요'}
          onCountUpdated={(countKey, cumulative) => {
            setCounts((current) => ({ ...current, [countKey]: cumulative }))
          }}
        />
      </div>
    </div>
  )
}
