import { SmtPlanWorkspace } from '@/components/smt/smt-plan-workspace'
import { fetchSmtPlanPageData } from '@/lib/smt/plan/repository'
import { getWeekStartMondayYmd } from '@/lib/smt/plan/utils'
import { todayYmdSeoul } from '@/lib/orders/utils'

export default async function SmtPlanPage() {
  const weekStart = getWeekStartMondayYmd(todayYmdSeoul())
  const result = await fetchSmtPlanPageData(weekStart)

  return <SmtPlanWorkspace initialResult={result} initialWeekStart={weekStart} />
}
