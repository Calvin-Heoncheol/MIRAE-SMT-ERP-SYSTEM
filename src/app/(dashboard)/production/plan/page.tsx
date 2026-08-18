import { PostProcessPlanWorkspace } from '@/components/post-process/post-process-plan-workspace'
import { ProductionTeamTabs } from '@/components/production/production-team-tabs'
import { SmtPlanWorkspace } from '@/components/smt/smt-plan-workspace'
import { PageShell } from '@/components/ui/page-shell'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { fetchPostProcessPlanPageData } from '@/lib/post-process/plan/repository'
import { getWeekStartMondayYmd as getPostWeekStart } from '@/lib/post-process/plan/utils'
import { POST_PROCESS_TEAMS, type PostProcessTeam } from '@/lib/post-process/teams'
import {
  resolveProductionPlanTab,
  type ProductionPlanTabId,
} from '@/lib/production-plan/tabs'
import { fetchSmtPlanPageData } from '@/lib/smt/plan/repository'
import { getWeekStartMondayYmd as getSmtWeekStart } from '@/lib/smt/plan/utils'

const PLAN_TEAM_TABS: { id: ProductionPlanTabId; label: string; href: string }[] = [
  { id: 'smt', label: '생산1 SMT', href: '/production/plan?tab=smt' },
  ...POST_PROCESS_TEAMS.map((team) => ({
    id: team,
    label: team,
    href: `/production/plan?tab=${encodeURIComponent(team)}`,
  })),
]

export const dynamic = 'force-dynamic'

type ProductionPlanPageProps = {
  searchParams?: Promise<{ tab?: string | string[]; scope?: string | string[] }>
}

export default async function ProductionPlanPage({ searchParams }: ProductionPlanPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab
  const rawScope = Array.isArray(params.scope) ? params.scope[0] : params.scope
  const activeTab = resolveProductionPlanTab(rawTab || rawScope)

  const tabs = (
    <ProductionTeamTabs tabs={PLAN_TEAM_TABS} activeId={activeTab} ariaLabel="생산계획 팀" />
  )

  if (activeTab === 'smt') {
    const weekStart = getSmtWeekStart(todayYmdSeoul())
    const result = await fetchSmtPlanPageData(weekStart)
    return (
      <PageShell>
        {tabs}
        <SmtPlanWorkspace initialResult={result} initialWeekStart={weekStart} />
      </PageShell>
    )
  }

  const team = activeTab as PostProcessTeam
  const weekStart = getPostWeekStart(todayYmdSeoul())
  const result = await fetchPostProcessPlanPageData(weekStart)
  return (
    <PageShell>
      {tabs}
      <PostProcessPlanWorkspace
        key={team}
        initialResult={result}
        initialWeekStart={weekStart}
        team={team}
      />
    </PageShell>
  )
}
