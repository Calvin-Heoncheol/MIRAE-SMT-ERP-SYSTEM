import { ProductionInputWorkspace } from '@/components/production-input/production-input-workspace'
import { fetchProductionInputPageData } from '@/lib/production-input/repository'
import { POST_PROCESS_PRODUCTION_INPUT_CONFIG } from '@/lib/post-process/config'
import { normalizePostProcessTeam } from '@/lib/post-process/teams'

export const dynamic = 'force-dynamic'

type PostProcessInputPageProps = {
  searchParams?: Promise<{ uiKey?: string | string[]; team?: string | string[] }>
}

export default async function PostProcessInputPage({ searchParams }: PostProcessInputPageProps) {
  const params = searchParams ? await searchParams : {}
  const raw = params.uiKey
  const initialUiKey = Array.isArray(raw) ? raw[0] || '' : raw || ''
  const rawTeam = params.team
  const team = normalizePostProcessTeam(Array.isArray(rawTeam) ? rawTeam[0] : rawTeam)

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
