import { redirect } from 'next/navigation'
import { normalizePostProcessTeam } from '@/lib/post-process/teams'

export const dynamic = 'force-dynamic'

type PostProcessHistoryPageProps = {
  searchParams?: Promise<{ team?: string | string[] }>
}

/** 구 후공정 생산이력 → 팀별 생산이력 */
export default async function PostProcessHistoryRedirectPage({
  searchParams,
}: PostProcessHistoryPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawTeam = params.team
  const team = normalizePostProcessTeam(Array.isArray(rawTeam) ? rawTeam[0] : rawTeam)
  redirect(`/production/history?team=${encodeURIComponent(team)}`)
}
