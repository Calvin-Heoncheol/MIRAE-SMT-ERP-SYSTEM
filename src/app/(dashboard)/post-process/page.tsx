import { redirect } from 'next/navigation'
import { isPostProcessTeam } from '@/lib/post-process/teams'

type PostProcessIndexPageProps = {
  searchParams?: Promise<{ team?: string | string[] }>
}

export default async function PostProcessIndexPage({ searchParams }: PostProcessIndexPageProps) {
  const params = searchParams ? await searchParams : {}
  const raw = params.team
  const team = Array.isArray(raw) ? raw[0] || '' : raw || ''

  redirect(
    isPostProcessTeam(team)
      ? `/post-process/input?team=${encodeURIComponent(team)}`
      : '/post-process/input',
  )
}
