import { ProductionPlanUnifiedWorkspace } from '@/components/production-plan/production-plan-unified-workspace'
import { PageShell } from '@/components/ui/page-shell'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { getMonthStartYmd } from '@/lib/production-plan/calendar'
import { fetchProductionPlanEvents } from '@/lib/production-plan/events'
import { fetchProductionPlanBoard } from '@/lib/production-plan/repository'

export const dynamic = 'force-dynamic'

export default async function ProductionPlanPage() {
  const monthStart = getMonthStartYmd(todayYmdSeoul())
  const [result, events] = await Promise.all([
    fetchProductionPlanBoard(),
    fetchProductionPlanEvents(),
  ])

  return (
    <PageShell>
      <ProductionPlanUnifiedWorkspace
        initialResult={result}
        initialEvents={events}
        initialMonthStart={monthStart}
      />
    </PageShell>
  )
}
