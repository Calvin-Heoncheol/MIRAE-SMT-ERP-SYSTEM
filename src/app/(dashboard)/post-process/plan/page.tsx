import { redirect } from 'next/navigation'
import { normalizePostProcessTeam } from '@/lib/post-process/teams'

export const dynamic = 'force-dynamic'

type PostProcessPlanPageProps = {
  searchParams?: Promise<{ team?: string | string[] }>
}

/** 생산계획은 /production/plan 탭으로 통합 */
export default async function PostProcessPlanPageRedirect({
  searchParams,
}: PostProcessPlanPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawTeam = params.team
  const team = normalizePostProcessTeam(Array.isArray(rawTeam) ? rawTeam[0] : rawTeam)
  redirect(`/production/plan?tab=${encodeURIComponent(team)}`)
}
