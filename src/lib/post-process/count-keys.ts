import type { PostProcessTeam } from '@/lib/post-process/teams'

/** 계획 대비 실적 키 — 일자 · 조립 그룹 · 팀 */
export function buildPostProcessPlanProgressKey(
  assemblyGroupId: string,
  recordDate: string,
  team: string,
) {
  return `${recordDate}:${assemblyGroupId}:${team}`
}

export type { PostProcessTeam }
