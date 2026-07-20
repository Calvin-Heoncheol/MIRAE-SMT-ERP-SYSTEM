import { ProductionInputWorkspace } from '@/components/production-input/production-input-workspace'
import { fetchOrders } from '@/lib/orders/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { fetchProductionInputPageData } from '@/lib/production-input/repository'
import { POST_PROCESS_PRODUCTION_INPUT_CONFIG } from '@/lib/post-process/config'
import {
  closeIncompletePastPostProcessPlans,
  fetchPostProcessProductionPlansForDate,
} from '@/lib/post-process/plan/repository'
import { buildPostProcessPlanBlocks } from '@/lib/post-process/plan/utils'
import { fetchPostProcessDayPlanProgress } from '@/lib/post-process/repository'

export const dynamic = 'force-dynamic'

type PostProcessInputPageProps = {
  searchParams?: Promise<{ uiKey?: string | string[] }>
}

export default async function PostProcessInputPage({ searchParams }: PostProcessInputPageProps) {
  const params = searchParams ? await searchParams : {}
  const raw = params.uiKey
  const initialUiKey = Array.isArray(raw) ? raw[0] || '' : raw || ''
  const today = todayYmdSeoul()

  await closeIncompletePastPostProcessPlans(today)

  const [result, plansResult, ordersResult, progressResult] = await Promise.all([
    fetchProductionInputPageData(POST_PROCESS_PRODUCTION_INPUT_CONFIG),
    fetchPostProcessProductionPlansForDate(today),
    fetchOrders(),
    fetchPostProcessDayPlanProgress(today),
  ])

  const assemblyLines = result.ok ? result.data.orders : []
  const todayPlans =
    plansResult.ok && ordersResult.ok
      ? buildPostProcessPlanBlocks(plansResult.plans, ordersResult.orders, assemblyLines)
      : []

  return (
    <ProductionInputWorkspace
      result={result}
      config={POST_PROCESS_PRODUCTION_INPUT_CONFIG}
      showOrderSidebar={false}
      initialUiKey={initialUiKey}
      todayPostProcessPlans={todayPlans}
      initialPlanProgress={progressResult.ok ? progressResult.progress : {}}
    />
  )
}
