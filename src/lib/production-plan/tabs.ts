import type { PostProcessTeam } from '@/lib/post-process/teams'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import type { ProductionPlanScope } from '@/lib/production-plan/types'
import { PRODUCTION_PLAN_SCOPE_LABELS } from '@/lib/production-plan/types'

export type ProductionPlanTabId = 'smt' | PostProcessTeam

/** 공유 생산계획 팀 탭 — 자재 / SMT / 후공정 */
export type ProductionPlanTeamTab = ProductionPlanScope

export const PRODUCTION_PLAN_TEAM_TABS: ProductionPlanTeamTab[] = ['material', 'smt', 'post']

export function productionPlanTeamTabLabel(tab: ProductionPlanTeamTab) {
  return PRODUCTION_PLAN_SCOPE_LABELS[tab]
}

export function resolveProductionPlanTeamTab(
  raw: string | null | undefined,
): ProductionPlanTeamTab {
  const value = String(raw || '').trim()
  if (value === 'material' || value === '자재') return 'material'
  if (value === 'post' || value === '후공정') return 'post'
  if (value === 'smt' || value === 'SMT') return 'smt'
  return 'material'
}

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
