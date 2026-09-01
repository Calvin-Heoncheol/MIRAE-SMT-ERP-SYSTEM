import { ProductionPlanWorkspace } from '@/components/production-plan/production-plan-workspace'
import { PageShell } from '@/components/ui/page-shell'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { getMonthStartYmd } from '@/lib/production-plan/calendar'
import { fetchProductionPlanBoard } from '@/lib/production-plan/repository'

export const dynamic = 'force-dynamic'

export default async function ProductionPlanPage() {
  const monthStart = getMonthStartYmd(todayYmdSeoul())
  const result = await fetchProductionPlanBoard()

  return (
    <PageShell>
      <ProductionPlanWorkspace initialResult={result} initialMonthStart={monthStart} />
    </PageShell>
  )
}
