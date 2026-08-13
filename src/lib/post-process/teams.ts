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
