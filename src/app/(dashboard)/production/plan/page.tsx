import { ProductionPlanWorkspace } from '@/components/production-plan/production-plan-workspace'
import { PageShell } from '@/components/ui/page-shell'
import { fetchProductionPlanBoard } from '@/lib/production-plan/repository'

export default async function ProductionPlanPage() {
  const result = await fetchProductionPlanBoard()
  return (
    <PageShell>
      <ProductionPlanWorkspace result={result} />
    </PageShell>
  )
}
