export const POST_PROCESS_TEAMS = ['생산2팀', '생산3팀', '생산4팀'] as const

export type PostProcessTeam = (typeof POST_PROCESS_TEAMS)[number]

export const DEFAULT_POST_PROCESS_TEAM: PostProcessTeam = POST_PROCESS_TEAMS[0]

export function isPostProcessTeam(value: string | null | undefined): value is PostProcessTeam {
  return POST_PROCESS_TEAMS.includes(value as PostProcessTeam)
}

export function normalizePostProcessTeam(value: string | null | undefined): PostProcessTeam {
  const raw = String(value || '').trim()
  if (isPostProcessTeam(raw)) return raw
  return DEFAULT_POST_PROCESS_TEAM
}

/** 로그인 부서 → 후공정 팀. SMT·품질·관리는 null */
export function postProcessTeamFromDepartment(department: string | null | undefined): PostProcessTeam | null {
  if (department === 'production2') return '생산2팀'
  if (department === 'production3') return '생산3팀'
  if (department === 'production4') return '생산4팀'
  return null
}
