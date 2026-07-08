import type { TodayProductionStageKey } from './types'

export type ProductionTodayStageDef = {
  key: TodayProductionStageKey
  label: string
  /** 후공정 카드만 사용 — 생산2~4팀 필터 */
  postTeam?: string
}

export const PRODUCTION_TODAY_STAGE_DEFS: ProductionTodayStageDef[] = [
  { key: 'smt', label: '생산1' },
  { key: 'post_process_2', label: '생산2', postTeam: '생산2팀' },
  { key: 'post_process_3', label: '생산3', postTeam: '생산3팀' },
  { key: 'post_process_4', label: '생산4', postTeam: '생산4팀' },
]
