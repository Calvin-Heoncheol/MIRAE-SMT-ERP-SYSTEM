import { ProductionTeamTabs } from '@/components/production/production-team-tabs'
import { ProductionInputWorkspace } from '@/components/production-input/production-input-workspace'
import { getAuthProfile } from '@/lib/auth/session'
import { fetchProductionInputPageData } from '@/lib/production-input/repository'
import { POST_PROCESS_PRODUCTION_INPUT_CONFIG } from '@/lib/post-process/config'
import {
  POST_PROCESS_TEAMS,
  isPostProcessTeam,
  normalizePostProcessTeam,
  postProcessTeamFromDepartment,
} from '@/lib/post-process/teams'

export const dynamic = 'force-dynamic'

const POST_PROCESS_INPUT_TABS = POST_PROCESS_TEAMS.map((team) => ({
  id: team,
  label: team,
  href: `/post-process/input?team=${encodeURIComponent(team)}`,
}))

type PostProcessInputPageProps = {
  searchParams?: Promise<{ uiKey?: string | string[]; team?: string | string[] }>
}

export default async function PostProcessInputPage({ searchParams }: PostProcessInputPageProps) {
  const params = searchParams ? await searchParams : {}
  const raw = params.uiKey
  const initialUiKey = Array.isArray(raw) ? raw[0] || '' : raw || ''
  const rawTeam = params.team
  const requestedTeam = Array.isArray(rawTeam) ? rawTeam[0] : rawTeam
  const profile = await getAuthProfile()
  const team = isPostProcessTeam(requestedTeam)
    ? requestedTeam
    : postProcessTeamFromDepartment(profile?.department) ?? normalizePostProcessTeam(requestedTeam)

  const result = await fetchProductionInputPageData(POST_PROCESS_PRODUCTION_INPUT_CONFIG)

  return (
    <>
      <ProductionTeamTabs
        tabs={POST_PROCESS_INPUT_TABS}
        activeId={team}
        ariaLabel="후공정 팀"
      />
      <ProductionInputWorkspace
        result={result}
        config={POST_PROCESS_PRODUCTION_INPUT_CONFIG}
        showOrderSidebar
        initialUiKey={initialUiKey}
        postProcessTeam={team}
      />
    </>
  )
}
