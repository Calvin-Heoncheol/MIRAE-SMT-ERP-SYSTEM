import { redirect } from 'next/navigation'
import { isProductionHistoryTeam } from '@/lib/production-history/types'

type ProductionHistoryPageProps = {
  searchParams?: Promise<{ team?: string | string[] }>
}

/** 생산이력은 생산등록 탭으로 통합 — 기존 링크 호환용 리다이렉트 */
export default async function ProductionHistoryPage({ searchParams }: ProductionHistoryPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawTeam = params.team
  const team = Array.isArray(rawTeam) ? rawTeam[0] : rawTeam
  const teamQuery =
    team && isProductionHistoryTeam(team) ? `&team=${encodeURIComponent(team)}` : '&team=생산1팀'
  redirect(`/production/input?view=history${teamQuery}`)
}
