import { PostProcessPlanWorkspace } from '@/components/post-process/post-process-plan-workspace'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { fetchPostProcessPlanPageData } from '@/lib/post-process/plan/repository'
import { getWeekStartMondayYmd } from '@/lib/post-process/plan/utils'
import { normalizePostProcessTeam } from '@/lib/post-process/teams'

export const dynamic = 'force-dynamic'

type PostProcessPlanPageProps = {
  searchParams?: Promise<{ team?: string | string[] }>
}

export default async function PostProcessPlanPage({ searchParams }: PostProcessPlanPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawTeam = params.team
  const team = normalizePostProcessTeam(Array.isArray(rawTeam) ? rawTeam[0] : rawTeam)

  const weekStart = getWeekStartMondayYmd(todayYmdSeoul())
  const result = await fetchPostProcessPlanPageData(weekStart)

  return <PostProcessPlanWorkspace initialResult={result} initialWeekStart={weekStart} team={team} />
}
