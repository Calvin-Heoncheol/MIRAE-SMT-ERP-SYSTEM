import { ProductionInputWorkspace } from '@/components/production-input/production-input-workspace'
import { fetchOrders } from '@/lib/orders/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { fetchProductionInputPageData } from '@/lib/production-input/repository'
import { SMT_PRODUCTION_INPUT_CONFIG } from '@/lib/smt/config'
import { fetchSmtDayPlanProgress } from '@/lib/smt/repository'
import {
  closeIncompletePastSmtPlans,
  fetchSmtProductionPlansForDate,
} from '@/lib/smt/plan/repository'
import { buildSmtPlanBlocks } from '@/lib/smt/plan/utils'

export const dynamic = 'force-dynamic'

type SmtInputPageProps = {
  searchParams?: Promise<{ uiKey?: string | string[] }>
}

export default async function SmtInputPage({ searchParams }: SmtInputPageProps) {
  const params = searchParams ? await searchParams : {}
  const raw = params.uiKey
  const initialUiKey = Array.isArray(raw) ? raw[0] || '' : raw || ''
  const today = todayYmdSeoul()

  await closeIncompletePastSmtPlans(today)

  const [result, plansResult, ordersResult, progressResult] = await Promise.all([
    fetchProductionInputPageData(SMT_PRODUCTION_INPUT_CONFIG),
    fetchSmtProductionPlansForDate(today),
    fetchOrders(),
    fetchSmtDayPlanProgress(today),
  ])

  const smtLines = result.ok ? result.data.orders : []
  const todayPlans =
    plansResult.ok && ordersResult.ok
      ? buildSmtPlanBlocks(plansResult.plans, ordersResult.orders, smtLines)
      : []

  return (
    <ProductionInputWorkspace
      result={result}
      config={SMT_PRODUCTION_INPUT_CONFIG}
      showOrderSidebar={false}
      initialUiKey={initialUiKey}
      todayPlans={todayPlans}
      initialPlanProgress={progressResult.ok ? progressResult.progress : {}}
    />
  )
}
