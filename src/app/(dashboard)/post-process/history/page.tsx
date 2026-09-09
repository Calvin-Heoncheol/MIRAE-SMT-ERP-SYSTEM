import { redirect } from 'next/navigation'
import { normalizePostProcessTeam } from '@/lib/post-process/teams'

export const dynamic = 'force-dynamic'

type PostProcessHistoryPageProps = {
  searchParams?: Promise<{ team?: string | string[] }>
}

/** 구 후공정 생산이력 → 생산등록 생산이력 탭 */
export default async function PostProcessHistoryRedirectPage({
  searchParams,
}: PostProcessHistoryPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawTeam = params.team
  const team = normalizePostProcessTeam(Array.isArray(rawTeam) ? rawTeam[0] : rawTeam)
  redirect(`/production/input?team=${encodeURIComponent(team)}&view=history`)
}
