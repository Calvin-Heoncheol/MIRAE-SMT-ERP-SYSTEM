import { PostProcessPlanWorkspace } from '@/components/post-process/post-process-plan-workspace'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { fetchPostProcessPlanPageData } from '@/lib/post-process/plan/repository'
import { getWeekStartMondayYmd } from '@/lib/post-process/plan/utils'

export const dynamic = 'force-dynamic'

export default async function PostProcessPlanPage() {
  const weekStart = getWeekStartMondayYmd(todayYmdSeoul())
  const result = await fetchPostProcessPlanPageData(weekStart)

  return <PostProcessPlanWorkspace initialResult={result} initialWeekStart={weekStart} />
}
