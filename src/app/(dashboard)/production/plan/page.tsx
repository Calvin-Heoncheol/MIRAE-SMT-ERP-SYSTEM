import { ProductionPlanUnifiedWorkspace } from '@/components/production-plan/production-plan-unified-workspace'
import { PageShell } from '@/components/ui/page-shell'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { getWeekStartYmd } from '@/lib/production-plan/calendar'
import { fetchProductionPlanBoard } from '@/lib/production-plan/repository'

export const dynamic = 'force-dynamic'

export default async function ProductionPlanPage() {
  const weekStart = getWeekStartYmd(todayYmdSeoul())
  const result = await fetchProductionPlanBoard()

  return (
    <PageShell>
      <ProductionPlanUnifiedWorkspace initialResult={result} initialWeekStart={weekStart} />
    </PageShell>
  )
}
