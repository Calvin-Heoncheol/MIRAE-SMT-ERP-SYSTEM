import Link from 'next/link'
import { PageShell } from '@/components/ui/page-shell'

type ForbiddenPageProps = {
  searchParams?: Promise<{ from?: string | string[] }>
}

export default async function ForbiddenPage({ searchParams }: ForbiddenPageProps) {
  const params = searchParams ? await searchParams : {}
  const raw = params.from
  const from = Array.isArray(raw) ? raw[0] || '' : raw || ''

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-sm font-bold tracking-wide text-rose-600 uppercase">Access denied</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">접근 권한이 없습니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          이 페이지는 현재 계정 부서로 열 수 없습니다.
          <br />
          삭제·직접재고 조정은 팀장 이상 역할이 필요합니다.
          <br />
          필요하면 관리자에게 부서·역할을 요청해 주세요.
        </p>
        {from ? (
          <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-500">
            {from}
          </p>
        ) : null}
        <Link
          href="/"
          className="mt-8 inline-flex rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          대시보드로 돌아가기
        </Link>
      </div>
    </PageShell>
  )
}
