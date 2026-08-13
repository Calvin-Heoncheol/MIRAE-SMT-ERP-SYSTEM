import type { PostProcessTeam } from '@/lib/post-process/teams'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'

export type ProductionPlanTabId = 'smt' | PostProcessTeam

export function resolveProductionPlanTab(raw: string | null | undefined): ProductionPlanTabId {
  const value = String(raw || '').trim()
  if (value === 'smt' || value === '생산1팀' || value === 'SMT' || value === 'week') return 'smt'
  if ((POST_PROCESS_TEAMS as readonly string[]).includes(value)) {
    return value as PostProcessTeam
  }
  // scope=post 등 구버전 → 기본 후공정 팀
  if (value === 'post' || value === '후공정' || value === 'overview' || value === 'all') {
    return POST_PROCESS_TEAMS[0]
  }
  return 'smt'
}
