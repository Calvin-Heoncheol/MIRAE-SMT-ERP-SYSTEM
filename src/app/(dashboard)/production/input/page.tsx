import { ProductionTeamTabs } from '@/components/production/production-team-tabs'
import { ProductionInputWorkspace } from '@/components/production-input/production-input-workspace'
import { fetchProductionInputPageData } from '@/lib/production-input/repository'
import { POST_PROCESS_PRODUCTION_INPUT_CONFIG } from '@/lib/post-process/config'
import {
  POST_PROCESS_TEAMS,
  isPostProcessTeam,
  type PostProcessTeam,
} from '@/lib/post-process/teams'
import { SMT_PRODUCTION_INPUT_CONFIG } from '@/lib/smt/config'

export const dynamic = 'force-dynamic'

export type ProductionInputTeam = '생산1팀' | PostProcessTeam

const PRODUCTION_INPUT_TABS: { id: ProductionInputTeam; label: string; href: string }[] = [
  { id: '생산1팀', label: '생산1팀', href: '/production/input?team=생산1팀' },
  ...POST_PROCESS_TEAMS.map((team) => ({
    id: team,
    label: team,
    href: `/production/input?team=${encodeURIComponent(team)}`,
  })),
]

function parseProductionInputTeam(value: string | null | undefined): ProductionInputTeam | null {
  const raw = String(value || '').trim()
  if (raw === 'smt' || raw === '생산1팀') return '생산1팀'
  if (isPostProcessTeam(raw)) return raw
  return null
}

type ProductionInputPageProps = {
  searchParams?: Promise<{ uiKey?: string | string[]; team?: string | string[] }>
}

export default async function ProductionInputPage({ searchParams }: ProductionInputPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawUiKey = params.uiKey
  const initialUiKey = Array.isArray(rawUiKey) ? rawUiKey[0] || '' : rawUiKey || ''
  const rawTeam = params.team
  const requestedRaw = Array.isArray(rawTeam) ? rawTeam[0] : rawTeam
  const team = parseProductionInputTeam(requestedRaw)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <ProductionTeamTabs
        tabs={PRODUCTION_INPUT_TABS}
        activeId={team}
        ariaLabel="생산 팀"
      />

      {!team ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-slate-800">팀을 선택하세요</p>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            위에서 생산 팀을 고른 뒤 등록을 진행할 수 있습니다.
          </p>
        </div>
      ) : team === '생산1팀' ? (
        <SmtProductionInput initialUiKey={initialUiKey} />
      ) : (
        <PostProcessProductionInput team={team} initialUiKey={initialUiKey} />
      )}
    </div>
  )
}

async function SmtProductionInput({ initialUiKey }: { initialUiKey: string }) {
  const result = await fetchProductionInputPageData(SMT_PRODUCTION_INPUT_CONFIG)
  return (
    <ProductionInputWorkspace
      result={result}
      config={SMT_PRODUCTION_INPUT_CONFIG}
      showOrderSidebar
      initialUiKey={initialUiKey}
    />
  )
}

async function PostProcessProductionInput({
  team,
  initialUiKey,
}: {
  team: PostProcessTeam
  initialUiKey: string
}) {
  const result = await fetchProductionInputPageData(POST_PROCESS_PRODUCTION_INPUT_CONFIG)
  return (
    <ProductionInputWorkspace
      result={result}
      config={POST_PROCESS_PRODUCTION_INPUT_CONFIG}
      showOrderSidebar
      initialUiKey={initialUiKey}
      postProcessTeam={team}
    />
  )
}
