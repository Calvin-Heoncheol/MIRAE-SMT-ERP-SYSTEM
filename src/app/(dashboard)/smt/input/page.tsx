import { redirect } from 'next/navigation'

type SmtInputPageProps = {
  searchParams?: Promise<{ uiKey?: string | string[] }>
}

/** 생산등록은 /production/input 으로 통합 */
export default async function SmtInputPage({ searchParams }: SmtInputPageProps) {
  const params = searchParams ? await searchParams : {}
  const raw = params.uiKey
  const uiKey = Array.isArray(raw) ? raw[0] || '' : raw || ''
  const qs = new URLSearchParams()
  qs.set('team', '생산1팀')
  if (uiKey) qs.set('uiKey', uiKey)
  redirect(`/production/input?${qs.toString()}`)
}
