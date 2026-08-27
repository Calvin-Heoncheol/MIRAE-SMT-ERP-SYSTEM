import { redirect } from 'next/navigation'
import {
  isPostProcessTeam,
  normalizePostProcessTeam,
  postProcessTeamFromDepartment,
} from '@/lib/post-process/teams'
import { getAuthProfile } from '@/lib/auth/session'

type PostProcessInputPageProps = {
  searchParams?: Promise<{ uiKey?: string | string[]; team?: string | string[] }>
}

/** 생산등록은 /production/input 으로 통합 */
export default async function PostProcessInputPage({ searchParams }: PostProcessInputPageProps) {
  const params = searchParams ? await searchParams : {}
  const raw = params.uiKey
  const uiKey = Array.isArray(raw) ? raw[0] || '' : raw || ''
  const rawTeam = params.team
  const requestedTeam = Array.isArray(rawTeam) ? rawTeam[0] : rawTeam
  const profile = await getAuthProfile()
  const team = isPostProcessTeam(requestedTeam)
    ? requestedTeam
    : postProcessTeamFromDepartment(profile?.department) ?? normalizePostProcessTeam(requestedTeam)

  const qs = new URLSearchParams()
  qs.set('team', team)
  if (uiKey) qs.set('uiKey', uiKey)
  redirect(`/production/input?${qs.toString()}`)
}
