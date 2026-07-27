import { POST_PROCESS_TEAMS, type PostProcessTeam } from '@/lib/post-process/teams'

export type ProductionPlanTabId = 'smt' | PostProcessTeam

export function resolveProductionPlanTab(raw: string | null | undefined): ProductionPlanTabId {
  const value = String(raw || '').trim()
  if (value === 'smt' || value === '생산1팀' || value === 'SMT') return 'smt'
  if ((POST_PROCESS_TEAMS as readonly string[]).includes(value)) {
    return value as PostProcessTeam
  }
  return 'smt'
}
