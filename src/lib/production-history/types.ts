import type { PostProcessTeam } from '@/lib/post-process/teams'
import type { SmtPcbSide } from '@/lib/smt/types'

export const PRODUCTION_HISTORY_TEAMS = [
  '생산1팀',
  '생산2팀',
  '생산3팀',
  '생산4팀',
] as const

export type ProductionHistoryTeam = (typeof PRODUCTION_HISTORY_TEAMS)[number]

export type ProductionHistoryModule = 'smt' | 'post_process'

export type ProductionHistoryRow = {
  id: string
  module: ProductionHistoryModule
  team: ProductionHistoryTeam
  recordDate: string
  createdAt: string
  orderNumber: string
  customer: string
  productName: string
  productCode: string
  quantity: number
  defectQuantity: number
  note: string
  createdByName: string
  /** SMT 전용 */
  lineNo: number | null
  pcbSide: SmtPcbSide | null
}

export type ProductionHistoryTeamFilter = 'all' | ProductionHistoryTeam

export function isProductionHistoryTeam(value: string): value is ProductionHistoryTeam {
  return (PRODUCTION_HISTORY_TEAMS as readonly string[]).includes(value)
}

export function postProcessTeamToHistoryTeam(team: string): ProductionHistoryTeam {
  const trimmed = team.trim()
  if (isProductionHistoryTeam(trimmed) && trimmed !== '생산1팀') {
    return trimmed
  }
  // 후공정 기본 팀
  return '생산2팀' satisfies PostProcessTeam
}
