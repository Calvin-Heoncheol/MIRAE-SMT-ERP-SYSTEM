import Link from 'next/link'
import { createSupabaseClient } from '@/lib/supabase'
import { APP_NAME } from '@/lib/app-config'

type ConnectionState =
  | { ok: true; message: string }
  | { ok: false; reason: 'env' | 'query'; detail: string }

async function checkSupabaseConnection(): Promise<ConnectionState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase.from('health_check').select('message').eq('id', 1).maybeSingle()

    if (error) {
      return {
        ok: false,
        reason: 'query',
        detail: error.message,
      }
    }

    return {
      ok: true,
      message: data?.message || 'connected',
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'query',
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

export default async function SetupPage() {
  const connection = await checkSupabaseConnection()

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <header>
          <p className="text-sm font-medium text-blue-700">{APP_NAME}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Supabase 연결 확인</h1>
          <p className="mt-3 text-slate-600">
            Vercel 환경변수 설정 후, Supabase와 통신되는지 확인하는 페이지입니다.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">연결 상태</h2>
          {connection.ok ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
              <p className="font-semibold">연결 성공</p>
              <p className="mt-1 text-sm">health_check: {connection.message}</p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <p className="font-semibold">
                {connection.reason === 'env' ? '환경변수 필요' : 'DB 연결 대기'}
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{connection.detail}</p>
            </div>
          )}
        </section>

        <p className="text-sm text-slate-600">
          <Link href="/" className="font-medium text-blue-700 hover:underline">
            대시보드로 돌아가기
          </Link>
        </p>
      </main>
    </div>
  )
}
